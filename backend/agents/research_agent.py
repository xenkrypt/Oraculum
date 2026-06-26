"""
agents/research_agent.py
========================
Career research agent powered by Gemini 2.0 Flash.

Takes a career title + user profile summary and returns structured market
intelligence:

- ``job_market_demand``   – ``"growing"`` | ``"stable"`` | ``"declining"``
- ``avg_salary_range``    – e.g. ``"$120k – $180k"``
- ``key_skills``          – list of in-demand skills
- ``top_companies``       – list of notable employers
- ``future_outlook``      – 2–3 sentence outlook paragraph
- ``learning_resources``  – list of recommended resources
- ``market_trends``       – list of key trends shaping the field

If Gemini is unavailable, a structured fallback returns plausible data from
a built-in knowledge base.

Usage
-----
::

    agent = ResearchAgent(api_key="GEMINI_KEY")
    report = await agent.research(
        career_title="AI Engineer",
        user_profile="Strong in analytical and systems_thinking traits.",
    )
"""

from __future__ import annotations

import asyncio
import json
import logging
import os
import re
from typing import Any

import httpx

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

GEMINI_URL = (
    "https://generativelanguage.googleapis.com/v1beta/models/"
    "gemini-2.0-flash:generateContent"
)

_MAX_RETRIES = 3

_SYSTEM_PROMPT = """\
You are a career market intelligence analyst with deep knowledge of the 2024–2025
job market, salary data, and industry trends.

Given a career title and a user's cognitive profile, return ONLY a valid JSON
object — no markdown, no prose — with exactly this structure:

{
  "job_market_demand":    "<growing | stable | declining>",
  "avg_salary_range":     "<e.g. $120k – $180k USD>",
  "key_skills":           ["<skill 1>", "<skill 2>", ..., "<skill 8>"],
  "top_companies":        ["<company 1>", ..., "<company 6>"],
  "future_outlook":       "<2-3 sentence objective assessment of 3-5 year outlook>",
  "learning_resources":   ["<resource 1 with URL or book title>", ..., "<resource 5>"],
  "market_trends":        ["<trend 1>", "<trend 2>", "<trend 3>"]
}

Rules:
- Be specific and factual. Use real company names, real salary data, real resources.
- job_market_demand must be one of exactly: growing, stable, declining.
- Tailor key_skills and learning_resources to the user's cognitive profile when
  sensible (e.g. research-oriented users get academic resources).
- Return ONLY the raw JSON object; no surrounding text or markdown.
"""

# ---------------------------------------------------------------------------
# Static fallback knowledge base
# ---------------------------------------------------------------------------

_FALLBACK_DB: dict[str, dict[str, Any]] = {
    "default": {
        "job_market_demand": "growing",
        "avg_salary_range": "$90k – $150k",
        "key_skills": [
            "Communication",
            "Problem solving",
            "Data literacy",
            "Project management",
            "Collaboration",
            "Adaptability",
            "Domain expertise",
            "Continuous learning",
        ],
        "top_companies": [
            "Google", "Microsoft", "Amazon", "Meta", "Apple", "McKinsey",
        ],
        "future_outlook": (
            "This career path is expected to remain relevant over the next 5 years, "
            "driven by technological change and organisational demand.  Professionals "
            "who continuously update their skills will be best positioned."
        ),
        "learning_resources": [
            "Coursera – Professional Certificate programmes",
            "LinkedIn Learning – Role-specific paths",
            "O'Reilly Safari – Technical books & video",
            "Harvard Business Review – Strategy & leadership",
            "YouTube – curated playlists by practitioners",
        ],
        "market_trends": [
            "AI augmentation of knowledge work",
            "Remote-first talent markets",
            "Skills-based hiring replacing degree requirements",
        ],
    },
    "ai engineer": {
        "job_market_demand": "growing",
        "avg_salary_range": "$130k – $280k",
        "key_skills": [
            "Python", "PyTorch / TensorFlow", "LLM fine-tuning",
            "MLOps", "Distributed systems", "Data engineering",
            "Statistical modelling", "Cloud (AWS / GCP / Azure)",
        ],
        "top_companies": [
            "OpenAI", "DeepMind", "Google Brain", "Meta AI",
            "Anthropic", "Hugging Face",
        ],
        "future_outlook": (
            "AI/ML engineering is one of the fastest-growing technical disciplines. "
            "Demand for practitioners who can build, deploy, and maintain LLM-based "
            "systems is expected to outstrip supply through at least 2027."
        ),
        "learning_resources": [
            "fast.ai – Practical Deep Learning",
            "deeplearning.ai – ML Specialisation",
            "Hugging Face – NLP / LLM course (free)",
            "Papers With Code – research + implementation",
            "Stanford CS229 – ML lecture notes",
        ],
        "market_trends": [
            "LLM-native application development",
            "Edge AI & on-device inference",
            "Agentic AI systems & tool use",
        ],
    },
    "product manager": {
        "job_market_demand": "stable",
        "avg_salary_range": "$120k – $200k",
        "key_skills": [
            "Product strategy", "User research", "Data analytics",
            "Stakeholder management", "Roadmapping", "A/B testing",
            "Go-to-market planning", "Technical literacy",
        ],
        "top_companies": [
            "Google", "Meta", "Airbnb", "Stripe", "Shopify", "Figma",
        ],
        "future_outlook": (
            "Product management remains a critical discipline, though AI tools are "
            "automating parts of discovery and prioritisation.  PMs who combine "
            "strategic vision with AI fluency will command the highest salaries."
        ),
        "learning_resources": [
            "Reforge – PM career accelerator",
            "Lenny's Newsletter – weekly PM insights",
            "INSPIRED by Marty Cagan – core PM book",
            "ProductPlan blog – roadmapping guides",
            "Pragmatic Institute – PM certification",
        ],
        "market_trends": [
            "AI-assisted product discovery",
            "PLG (product-led growth) strategies",
            "Cross-functional PM roles blending design and engineering",
        ],
    },
    "founder": {
        "job_market_demand": "growing",
        "avg_salary_range": "$0 → $500k+ (equity dependent)",
        "key_skills": [
            "Fundraising", "Growth hacking", "Product vision",
            "Team building", "Sales & negotiation", "Financial modelling",
            "Resilience", "Customer development",
        ],
        "top_companies": [
            "Y Combinator", "Sequoia Capital", "a16z",
            "Stripe", "Notion", "Linear",
        ],
        "future_outlook": (
            "Entrepreneurship is increasingly accessible due to AI tools that "
            "reduce team size requirements.  Solo founders and micro-startups are "
            "gaining traction.  The market rewards niche, high-value solutions."
        ),
        "learning_resources": [
            "Y Combinator – Startup School (free)",
            "Paul Graham – essays on startups",
            "The Mom Test – customer discovery",
            "Zero to One – Peter Thiel",
            "Lean Startup – Eric Ries",
        ],
        "market_trends": [
            "AI-first startups with lean teams",
            "Vertical SaaS for niche industries",
            "Community-led growth models",
        ],
    },
    "consultant": {
        "job_market_demand": "stable",
        "avg_salary_range": "$90k – $300k",
        "key_skills": [
            "Problem structuring", "Data analysis", "Presentation design",
            "Client management", "Workshop facilitation", "Change management",
            "Industry expertise", "Proposal writing",
        ],
        "top_companies": [
            "McKinsey", "BCG", "Bain", "Deloitte",
            "Accenture", "KPMG",
        ],
        "future_outlook": (
            "Strategic consulting remains resilient to automation because it relies "
            "on judgment, relationships, and contextual wisdom.  Boutique and "
            "independent consultancies are growing rapidly as corporates prefer "
            "specialised expertise over generalist advice."
        ),
        "learning_resources": [
            "Case in Point – consulting case prep",
            "McKinsey Insights – free articles",
            "Coursera – Management Consulting specialisation",
            "Pyramid Principle – Barbara Minto",
            "Consulting.com – independent consulting",
        ],
        "market_trends": [
            "AI strategy consulting boom",
            "Rise of independent / boutique consultancies",
            "Data-driven consulting deliverables",
        ],
    },
    "researcher": {
        "job_market_demand": "growing",
        "avg_salary_range": "$70k – $200k",
        "key_skills": [
            "Literature review", "Experimental design", "Statistical analysis",
            "Scientific writing", "Grant writing", "Programming (Python/R)",
            "Domain expertise", "Peer collaboration",
        ],
        "top_companies": [
            "Google DeepMind", "OpenAI", "MIT CSAIL",
            "Stanford AI Lab", "Allen Institute", "Microsoft Research",
        ],
        "future_outlook": (
            "Research roles in AI and life sciences are experiencing strong demand. "
            "Industry research labs now offer academia-competitive compensation. "
            "Researchers who can bridge theory and application are highly sought."
        ),
        "learning_resources": [
            "arXiv.org – preprint repository",
            "Connected Papers – research network explorer",
            "Semantic Scholar – AI-powered paper search",
            "Nature / Science – flagship journals",
            "ResearchGate – academic networking",
        ],
        "market_trends": [
            "Industry labs rivalling academia in research output",
            "Open science & reproducibility movement",
            "Interdisciplinary AI × domain science research",
        ],
    },
}


# ---------------------------------------------------------------------------
# ResearchAgent
# ---------------------------------------------------------------------------

class ResearchAgent:
    """
    Researches career paths using Gemini 2.0 Flash.

    Parameters
    ----------
    api_key:
        Gemini API key.  Falls back to the ``GEMINI_API_KEY`` environment
        variable if not provided.
    timeout:
        HTTP timeout in seconds.
    max_retries:
        Number of retry attempts with exponential backoff.
    """

    def __init__(
        self,
        api_key: str | None = None,
        timeout: float = 45.0,
        max_retries: int = 3,
    ) -> None:
        self.api_key = api_key or os.getenv("GEMINI_API_KEY", "")
        self.timeout = timeout
        self.max_retries = max_retries

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    async def research(
        self,
        career_title: str,
        user_profile: str = "",
    ) -> dict[str, Any]:
        """
        Research a career path and return structured market intelligence.

        Parameters
        ----------
        career_title:
            The career to research (e.g. ``"AI Engineer"``).
        user_profile:
            Free-text summary of the user's profile for personalisation.

        Returns
        -------
        dict
            Structured career intelligence report.
        """
        try:
            return await self._call_gemini(career_title, user_profile)
        except Exception as exc:
            logger.warning(
                "ResearchAgent Gemini call failed, using fallback: %s", exc
            )
            return self._fallback_data(career_title)

    # ------------------------------------------------------------------
    # Gemini call with retry
    # ------------------------------------------------------------------

    async def _call_gemini(
        self,
        career_title: str,
        user_profile: str,
    ) -> dict[str, Any]:
        """Call Gemini REST API with exponential backoff retry."""
        if not self.api_key:
            raise ValueError("No GEMINI_API_KEY configured")

        user_text = f"CAREER TITLE: {career_title}"
        if user_profile:
            user_text += f"\n\nUSER PROFILE:\n{user_profile}"

        payload: dict[str, Any] = {
            "system_instruction": {"parts": [{"text": _SYSTEM_PROMPT}]},
            "contents": [{"parts": [{"text": user_text}]}],
            "generationConfig": {
                "temperature": 0.3,
                "maxOutputTokens": 1024,
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
                    return self._parse_response(resp.json(), career_title)
                except (httpx.HTTPStatusError, httpx.RequestError) as exc:
                    last_exc = exc
                    wait = 2 ** attempt
                    logger.warning(
                        "ResearchAgent attempt %d/%d failed (%s), retrying in %ds",
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

    def _parse_response(
        self,
        resp_json: dict[str, Any],
        career_title: str,
    ) -> dict[str, Any]:
        """Parse a Gemini API response into structured career data."""
        try:
            text = resp_json["candidates"][0]["content"]["parts"][0]["text"]
        except (KeyError, IndexError) as exc:
            raise ValueError(f"Unexpected Gemini response shape: {exc}") from exc

        text = re.sub(r"```(?:json)?", "", text).strip()

        try:
            data = json.loads(text)
        except json.JSONDecodeError as exc:
            match = re.search(r"\{.*\}", text, re.DOTALL)
            if match:
                data = json.loads(match.group())
            else:
                raise ValueError(f"Cannot parse Gemini JSON output: {exc}") from exc

        # Validate demand field
        demand = data.get("job_market_demand", "stable")
        if demand not in ("growing", "stable", "declining"):
            demand = "stable"

        return {
            "career_title": career_title,
            "job_market_demand": demand,
            "avg_salary_range": str(data.get("avg_salary_range", "N/A")),
            "key_skills": [str(s) for s in data.get("key_skills", [])],
            "top_companies": [str(c) for c in data.get("top_companies", [])],
            "future_outlook": str(data.get("future_outlook", "")),
            "learning_resources": [str(r) for r in data.get("learning_resources", [])],
            "market_trends": [str(t) for t in data.get("market_trends", [])],
            "source": "gemini",
        }

    # ------------------------------------------------------------------
    # Fallback
    # ------------------------------------------------------------------

    def _fallback_data(self, career_title: str) -> dict[str, Any]:
        """
        Return data from the static knowledge base.

        Matches by lowercased keyword; falls back to the ``"default"`` entry.
        """
        title_lower = career_title.lower()
        matched_key = "default"
        for key in _FALLBACK_DB:
            if key != "default" and key in title_lower:
                matched_key = key
                break

        data = dict(_FALLBACK_DB[matched_key])
        data["career_title"] = career_title
        data["source"] = "fallback"
        return data
