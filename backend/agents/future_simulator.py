"""
agents/future_simulator.py
==========================
Generates 5 alternative future career paths for a user based on their
ShadowTwin cognitive profile.

Each simulated future contains:

- ``id``                  – stable slug identifier
- ``probability``         – likelihood ∈ [0, 1]
- ``title``               – career path name
- ``description``         – 2–3 sentence personalised overview
- ``12_month_roadmap``    – ordered list of milestone strings
- ``skills_to_acquire``   – list of skill names
- ``expected_salary_range`` – e.g. "$120k – $160k"
- ``lifestyle_fit``       – subjective fit score ∈ [0, 10]
- ``risk_factors``        – list of risk strings

The agent calls Gemini 2.0 Flash to generate rich, personalised content.
If the API call fails, a template-based fallback produces plausible (but
generic) alternatives.

Usage
-----
::

    simulator = FutureSimulator(api_key="GEMINI_KEY")
    futures = await simulator.simulate(twin=shadow_twin)
"""

from __future__ import annotations

import asyncio
import json
import logging
import os
import re
from typing import Any

import httpx

from models.twin import ShadowTwin

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

GEMINI_URL = (
    "https://generativelanguage.googleapis.com/v1beta/models/"
    "gemini-2.0-flash:generateContent"
)

_N_FUTURES = 5
_MAX_RETRIES = 3


def _build_system_prompt() -> str:
    return """\
You are a career futures analyst and life-design strategist.

Given a user's cognitive profile (trait scores 0–1), generate exactly 5
distinct, personalised career future paths.  Return ONLY a valid JSON array
— no markdown, no prose.

Each element must have EXACTLY these keys:
{
  "id":                    "<url-safe slug, e.g. 'tech-founder'>",
  "probability":           <float 0-1>,
  "title":                 "<career path title>",
  "description":           "<2-3 sentence personalised description>",
  "twelve_month_roadmap":  ["<milestone 1>", "<milestone 2>", ..., "<milestone 6>"],
  "skills_to_acquire":     ["<skill 1>", ..., "<skill 5>"],
  "expected_salary_range": "<e.g. $110k – $150k>",
  "lifestyle_fit":         <float 0-10>,
  "risk_factors":          ["<risk 1>", "<risk 2>", "<risk 3>"]
}

Rules:
- Probabilities must sum to approximately 1.0 across the 5 paths.
- Paths must be meaningfully different (not just slight variations).
- Personalise based on the dominant traits; a highly creative/curious user
  should not get purely administrative paths.
- Return ONLY the raw JSON array, no surrounding text.
"""


# ---------------------------------------------------------------------------
# Template futures for fallback
# ---------------------------------------------------------------------------

_TEMPLATE_FUTURES: list[dict[str, Any]] = [
    {
        "id": "tech-founder",
        "probability": 0.25,
        "title": "Tech Founder / Entrepreneur",
        "description": (
            "You build and lead a technology startup from zero to product-market fit. "
            "Your analytical and creative strengths enable you to identify gaps in "
            "the market and execute with precision."
        ),
        "twelve_month_roadmap": [
            "Validate problem with 20 customer interviews",
            "Build MVP in 8 weeks",
            "Acquire first 10 paying customers",
            "Raise pre-seed round ($250k–$500k)",
            "Hire first 2 engineers",
            "Reach $10k MRR",
        ],
        "skills_to_acquire": [
            "Fundraising pitch decks",
            "Growth marketing",
            "Technical product management",
            "Financial modelling",
            "Hiring & culture building",
        ],
        "expected_salary_range": "$0 → $150k+ (equity upside)",
        "lifestyle_fit": 7.5,
        "risk_factors": [
            "High failure rate (~90% startups fail)",
            "Financial instability in early stages",
            "Long hours and high stress",
        ],
    },
    {
        "id": "ai-ml-engineer",
        "probability": 0.22,
        "title": "AI / ML Engineer",
        "description": (
            "You specialise in building machine-learning systems at scale. "
            "Your systems-thinking and analytical traits make you an exceptionally "
            "effective AI practitioner at leading tech companies."
        ),
        "twelve_month_roadmap": [
            "Complete fast.ai or deeplearning.ai specialisation",
            "Build 3 portfolio ML projects on GitHub",
            "Contribute to one open-source ML library",
            "Land a senior ML role at a tier-1 company",
            "Lead a production model deployment end-to-end",
            "Publish one technical blog post or paper",
        ],
        "skills_to_acquire": [
            "PyTorch / TensorFlow",
            "MLOps & model serving",
            "Large Language Models",
            "Data pipeline engineering",
            "Distributed systems",
        ],
        "expected_salary_range": "$130k – $280k",
        "lifestyle_fit": 8.0,
        "risk_factors": [
            "Rapidly evolving field requires constant relearning",
            "High competition for top roles",
            "Risk of AI-driven commoditisation",
        ],
    },
    {
        "id": "product-leader",
        "probability": 0.20,
        "title": "Senior Product Manager / CPO",
        "description": (
            "You shape product strategy at a high-growth company, translating user "
            "insights into roadmap decisions.  Your leadership and strategic traits "
            "position you for C-suite trajectory."
        ),
        "twelve_month_roadmap": [
            "Complete product management certification (PMC / Reforge)",
            "Own a full product feature from ideation to launch",
            "Build a cross-functional stakeholder network",
            "Define and track 3 OKRs for your product area",
            "Present product strategy to executive team",
            "Mentor 1 junior PM",
        ],
        "skills_to_acquire": [
            "Product discovery & user research",
            "Data-driven decision making",
            "Stakeholder communication",
            "Agile / scrum mastery",
            "Strategic roadmapping",
        ],
        "expected_salary_range": "$120k – $200k",
        "lifestyle_fit": 7.0,
        "risk_factors": [
            "Role often tied to company success",
            "Influence without authority is challenging",
            "High accountability for outcomes you don't fully control",
        ],
    },
    {
        "id": "independent-consultant",
        "probability": 0.18,
        "title": "Independent Strategy Consultant",
        "description": (
            "You operate as a solo consultant, advising organisations on complex "
            "strategic and operational challenges.  Your adaptability and analytical "
            "traits make you a trusted advisor across industries."
        ),
        "twelve_month_roadmap": [
            "Identify 2–3 niche industries to focus on",
            "Land first 3 consulting clients via network",
            "Develop a signature methodology / framework",
            "Build a content presence (newsletter or LinkedIn)",
            "Raise day rate by 30%",
            "Create one productised offering (workshop / course)",
        ],
        "skills_to_acquire": [
            "Client relationship management",
            "Proposal & contract writing",
            "Facilitation & workshop design",
            "Personal brand building",
            "Financial self-management",
        ],
        "expected_salary_range": "$90k – $300k",
        "lifestyle_fit": 8.5,
        "risk_factors": [
            "Feast-or-famine revenue cycles",
            "Isolation without team collaboration",
            "Constant business development required",
        ],
    },
    {
        "id": "deep-researcher",
        "probability": 0.15,
        "title": "Research Scientist / Thought Leader",
        "description": (
            "You pursue deep expertise in a frontier domain — AI safety, biotech, "
            "climate tech — and translate findings into impact via publications, "
            "talks, and advisory roles.  Your curiosity is your superpower."
        ),
        "twelve_month_roadmap": [
            "Identify one frontier research question to own",
            "Publish a preprint or literature review",
            "Join a research lab or residency programme",
            "Present at one conference",
            "Build a public knowledge base on your topic",
            "Establish collaborations with 3 leading researchers",
        ],
        "skills_to_acquire": [
            "Scientific writing & peer review",
            "Experimental design",
            "Grant writing",
            "Science communication",
            "Statistical analysis",
        ],
        "expected_salary_range": "$70k – $160k (academia) / $200k+ (industry labs)",
        "lifestyle_fit": 7.5,
        "risk_factors": [
            "Long feedback cycles on work",
            "Academic pay often below industry",
            "Publish-or-perish culture in academia",
        ],
    },
]


# ---------------------------------------------------------------------------
# FutureSimulator
# ---------------------------------------------------------------------------

class FutureSimulator:
    """
    Simulates 5 alternative career futures based on a user's ShadowTwin.

    Parameters
    ----------
    api_key:
        Gemini API key.  Falls back to the ``GEMINI_API_KEY`` environment
        variable if not provided.
    timeout:
        HTTP timeout in seconds for each Gemini request.
    max_retries:
        Number of retry attempts with exponential backoff.
    """

    def __init__(
        self,
        api_key: str | None = None,
        timeout: float = 60.0,
        max_retries: int = 3,
    ) -> None:
        self.api_key = api_key or os.getenv("GEMINI_API_KEY", "")
        self.timeout = timeout
        self.max_retries = max_retries

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    async def simulate(
        self,
        twin: ShadowTwin,
        additional_context: str = "",
    ) -> list[dict[str, Any]]:
        """
        Generate 5 future career simulations personalised to *twin*.

        Parameters
        ----------
        twin:
            The ShadowTwin containing the user's trait profile.
        additional_context:
            Optional free-text context (e.g. user goals, constraints).

        Returns
        -------
        list[dict]
            A list of exactly 5 future path dicts.
        """
        try:
            return await self._call_gemini(twin, additional_context)
        except Exception as exc:
            logger.warning(
                "FutureSimulator Gemini call failed, using templates: %s", exc
            )
            return self._template_fallback(twin)

    # ------------------------------------------------------------------
    # Gemini call with retry
    # ------------------------------------------------------------------

    async def _call_gemini(
        self,
        twin: ShadowTwin,
        additional_context: str,
    ) -> list[dict[str, Any]]:
        """Call Gemini REST API with exponential backoff retry."""
        if not self.api_key:
            raise ValueError("No GEMINI_API_KEY configured")

        profile_summary = self._build_profile_summary(twin)
        user_text = f"USER COGNITIVE PROFILE:\n{profile_summary}"
        if additional_context:
            user_text += f"\n\nADDITIONAL CONTEXT:\n{additional_context}"

        payload: dict[str, Any] = {
            "system_instruction": {"parts": [{"text": _build_system_prompt()}]},
            "contents": [{"parts": [{"text": user_text}]}],
            "generationConfig": {
                "temperature": 0.7,
                "maxOutputTokens": 2048,
                "responseMimeType": "application/json",
            },
        }

        url = f"{GEMINI_URL}?key={self.api_key}"
        last_exc: Exception = RuntimeError("No attempts made")

        async with httpx.AsyncClient(timeout=self.timeout) as client:
            for attempt in range(self.max_retries):
                try:
                    resp = await client.post(url, json=payload)
                    resp.raise_for_status()
                    futures = self._parse_response(resp.json())
                    # Inject dominant traits as metadata
                    for f in futures:
                        f.setdefault("dominant_trait_basis", twin.dominant_strategy)
                    return futures
                except (httpx.HTTPStatusError, httpx.RequestError) as exc:
                    last_exc = exc
                    wait = 2 ** attempt
                    logger.warning(
                        "FutureSimulator attempt %d/%d failed (%s), retrying in %ds",
                        attempt + 1,
                        self.max_retries,
                        exc,
                        wait,
                    )
                    if attempt < self.max_retries - 1:
                        await asyncio.sleep(wait)

        raise last_exc

    # ------------------------------------------------------------------
    # Response parsing
    # ------------------------------------------------------------------

    def _parse_response(self, resp_json: dict[str, Any]) -> list[dict[str, Any]]:
        """Parse a Gemini API response into a list of future dicts."""
        try:
            text = resp_json["candidates"][0]["content"]["parts"][0]["text"]
        except (KeyError, IndexError) as exc:
            raise ValueError(f"Unexpected Gemini response shape: {exc}") from exc

        text = re.sub(r"```(?:json)?", "", text).strip()

        try:
            data = json.loads(text)
        except json.JSONDecodeError as exc:
            match = re.search(r"\[.*\]", text, re.DOTALL)
            if match:
                data = json.loads(match.group())
            else:
                raise ValueError(f"Cannot parse Gemini JSON output: {exc}") from exc

        if not isinstance(data, list):
            raise ValueError("Expected a JSON array from Gemini")

        validated: list[dict[str, Any]] = []
        for item in data[:_N_FUTURES]:
            validated.append(self._validate_future(item))

        # Pad with template futures if Gemini returned fewer than expected
        while len(validated) < _N_FUTURES:
            template = _TEMPLATE_FUTURES[len(validated)]
            validated.append(template)

        return validated

    @staticmethod
    def _validate_future(item: dict[str, Any]) -> dict[str, Any]:
        """Ensure required keys exist and types are correct."""
        return {
            "id": str(item.get("id", "unknown")),
            "probability": max(0.0, min(1.0, float(item.get("probability", 0.2)))),
            "title": str(item.get("title", "Unnamed Path")),
            "description": str(item.get("description", "")),
            "twelve_month_roadmap": [
                str(m) for m in item.get("twelve_month_roadmap", [])
            ],
            "skills_to_acquire": [
                str(s) for s in item.get("skills_to_acquire", [])
            ],
            "expected_salary_range": str(item.get("expected_salary_range", "N/A")),
            "lifestyle_fit": max(0.0, min(10.0, float(item.get("lifestyle_fit", 5.0)))),
            "risk_factors": [str(r) for r in item.get("risk_factors", [])],
        }

    # ------------------------------------------------------------------
    # Template fallback
    # ------------------------------------------------------------------

    def _template_fallback(self, twin: ShadowTwin) -> list[dict[str, Any]]:
        """
        Return personalised templates based on dominant traits.

        Reorders templates to put the most likely match first based on
        highest-scoring trait.
        """
        top_trait = max(
            twin.traits.items(),
            key=lambda x: x[1].score,
            default=("analytical", None),
        )[0]

        # Map top traits to preferred future orderings
        preference_map: dict[str, list[int]] = {
            "analytical": [1, 0, 3, 4, 2],       # AI engineer first
            "strategic": [2, 0, 3, 1, 4],         # Product leader first
            "creative": [0, 4, 1, 3, 2],           # Founder first
            "leadership": [0, 2, 1, 3, 4],         # Founder, then PM
            "execution": [2, 0, 1, 3, 4],          # PM first
            "adaptability": [3, 0, 2, 1, 4],       # Consultant first
            "curiosity": [4, 1, 0, 3, 2],          # Researcher first
            "systems_thinking": [1, 4, 0, 2, 3],   # AI engineer first
        }

        order = preference_map.get(top_trait, [0, 1, 2, 3, 4])
        futures = [_TEMPLATE_FUTURES[i] for i in order]

        # Adjust probabilities to reflect the ranking
        probs = [0.30, 0.25, 0.20, 0.15, 0.10]
        for future, prob in zip(futures, probs):
            future = dict(future)  # copy
            future["probability"] = prob
            future["dominant_trait_basis"] = top_trait

        return [dict(f) for f in futures]

    # ------------------------------------------------------------------
    # Profile summary builder
    # ------------------------------------------------------------------

    @staticmethod
    def _build_profile_summary(twin: ShadowTwin) -> str:
        """Convert ShadowTwin traits into a compact text summary for Gemini."""
        lines = [
            f"dominant_strategy: {twin.dominant_strategy}",
            f"risk_profile: {twin.risk_profile}",
            f"reasoning_style: {twin.reasoning_style}",
            f"overall_confidence: {twin.overall_confidence:.2f}",
            "",
            "TRAITS (score / confidence):",
        ]
        for name, trait in sorted(twin.traits.items()):
            lines.append(f"  {name}: {trait.score:.3f} (confidence: {trait.confidence:.2f})")
        return "\n".join(lines)
