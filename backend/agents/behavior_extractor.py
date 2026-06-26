"""
agents/behavior_extractor.py
============================
Gemini-powered agent that analyses a single question + user answer and
produces a structured ``BehaviorFeatures`` object.

The agent calls the Gemini 2.0 Flash REST API with a carefully engineered
prompt and parses the JSON response.  If the API call fails after three
exponential-backoff retries, the agent falls back to a deterministic
heuristic scorer that still returns a plausible (if less nuanced) result.

Usage
-----
::

    extractor = BehaviorExtractor(api_key="GEMINI_API_KEY_HERE")
    features = await extractor.extract(
        question="Describe how you would approach a complex problem...",
        answer="I usually start by breaking it into smaller parts...",
        question_id="q_001",
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

from models.event import BehaviorFeatures

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

GEMINI_URL = (
    "https://generativelanguage.googleapis.com/v1beta/models/"
    "gemini-2.0-flash:generateContent"
)

_TRAIT_NAMES = [
    "analytical",
    "strategic",
    "creative",
    "leadership",
    "execution",
    "adaptability",
    "curiosity",
    "systems_thinking",
]

_STRATEGIES = [
    "systematic_breakdown",
    "intuitive_leap",
    "first_principles",
    "analogical_reasoning",
    "divergent_exploration",
    "incremental_refinement",
]

_SYSTEM_PROMPT = """\
You are a cognitive profiling expert. Analyse the provided question and user
answer, then return ONLY a valid JSON object — no markdown, no prose — with
exactly this structure:

{
  "trait_signals": {
    "analytical":       <float 0-1>,
    "strategic":        <float 0-1>,
    "creative":         <float 0-1>,
    "leadership":       <float 0-1>,
    "execution":        <float 0-1>,
    "adaptability":     <float 0-1>,
    "curiosity":        <float 0-1>,
    "systems_thinking": <float 0-1>
  },
  "strategy":        "<one of: systematic_breakdown | intuitive_leap | first_principles | analogical_reasoning | divergent_exploration | incremental_refinement>",
  "risk_level":      "<low | medium | high>",
  "reasoning_style": "<convergent | divergent | lateral>",
  "key_insight":     "<single sentence, max 20 words>",
  "confidence_delta": <float 0.0-0.2>
}

Rules:
- trait_signals must reflect ACTUAL evidence in the answer, not assumptions.
- confidence_delta should be higher (up to 0.2) when the answer is detailed
  and unambiguous; lower (0.0–0.05) when vague or very short.
- key_insight must be a specific, evidence-based observation.
- Return ONLY the raw JSON object; no surrounding text.
"""


# ---------------------------------------------------------------------------
# BehaviorExtractor
# ---------------------------------------------------------------------------

class BehaviorExtractor:
    """
    Extracts structured behavioural features from a question/answer pair.

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
        timeout: float = 30.0,
        max_retries: int = 3,
    ) -> None:
        self.api_key = api_key or os.getenv("GEMINI_API_KEY", "")
        self.timeout = timeout
        self.max_retries = max_retries

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    async def extract(
        self,
        question: str,
        answer: str,
        question_id: str = "",
    ) -> BehaviorFeatures:
        """
        Extract BehaviorFeatures from *question* + *answer*.

        Attempts Gemini first; falls back to heuristic scoring on failure.

        Parameters
        ----------
        question:
            The question text shown to the user.
        answer:
            The user's answer text.
        question_id:
            Optional identifier for the question.

        Returns
        -------
        BehaviorFeatures
            Populated feature object.
        """
        if not answer.strip():
            return self._heuristic_fallback(question, answer, question_id)

        try:
            return await self._call_gemini(question, answer, question_id)
        except Exception as exc:
            logger.warning(
                "BehaviorExtractor Gemini call failed, using heuristic: %s", exc
            )
            return self._heuristic_fallback(question, answer, question_id)

    # ------------------------------------------------------------------
    # Gemini call with retry
    # ------------------------------------------------------------------

    async def _call_gemini(
        self,
        question: str,
        answer: str,
        question_id: str,
    ) -> BehaviorFeatures:
        """Call Gemini REST API with exponential backoff retry."""
        if not self.api_key:
            raise ValueError("No GEMINI_API_KEY configured")

        user_content = (
            f"QUESTION:\n{question}\n\nANSWER:\n{answer}"
        )

        payload: dict[str, Any] = {
            "system_instruction": {"parts": [{"text": _SYSTEM_PROMPT}]},
            "contents": [{"parts": [{"text": user_content}]}],
            "generationConfig": {
                "temperature": 0.2,
                "maxOutputTokens": 512,
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
                    return self._parse_response(resp.json(), answer, question_id)
                except (httpx.HTTPStatusError, httpx.RequestError) as exc:
                    last_exc = exc
                    wait = 2 ** attempt  # 1s, 2s, 4s
                    logger.warning(
                        "Gemini attempt %d/%d failed (%s), retrying in %ds",
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
        raw_answer: str,
        question_id: str,
    ) -> BehaviorFeatures:
        """Parse a Gemini API JSON response into BehaviorFeatures."""
        try:
            text = resp_json["candidates"][0]["content"]["parts"][0]["text"]
        except (KeyError, IndexError) as exc:
            raise ValueError(f"Unexpected Gemini response shape: {exc}") from exc

        # Strip markdown code fences if present
        text = re.sub(r"```(?:json)?", "", text).strip()

        try:
            data = json.loads(text)
        except json.JSONDecodeError as exc:
            # Last-ditch: attempt to extract JSON object substring
            match = re.search(r"\{.*\}", text, re.DOTALL)
            if match:
                data = json.loads(match.group())
            else:
                raise ValueError(f"Cannot parse Gemini JSON output: {exc}") from exc

        # Normalise and validate trait signals
        trait_signals: dict[str, float] = {}
        raw_signals = data.get("trait_signals", {})
        for trait in _TRAIT_NAMES:
            val = float(raw_signals.get(trait, 0.5))
            trait_signals[trait] = max(0.0, min(1.0, val))

        strategy = data.get("strategy", "systematic_breakdown")
        if strategy not in _STRATEGIES:
            strategy = "systematic_breakdown"

        risk_level = data.get("risk_level", "medium")
        if risk_level not in ("low", "medium", "high"):
            risk_level = "medium"

        reasoning_style = data.get("reasoning_style", "convergent")
        if reasoning_style not in ("convergent", "divergent", "lateral"):
            reasoning_style = "convergent"

        confidence_delta = float(data.get("confidence_delta", 0.05))
        confidence_delta = max(0.0, min(0.2, confidence_delta))

        return BehaviorFeatures(
            trait_signals=trait_signals,
            strategy=strategy,
            risk_level=risk_level,
            reasoning_style=reasoning_style,
            key_insight=str(data.get("key_insight", ""))[:200],
            confidence_delta=confidence_delta,
            raw_answer=raw_answer,
            question_id=question_id,
        )

    # ------------------------------------------------------------------
    # Heuristic fallback
    # ------------------------------------------------------------------

    def _heuristic_fallback(
        self,
        question: str,
        answer: str,
        question_id: str,
    ) -> BehaviorFeatures:
        """
        Deterministic heuristic scorer that runs without any API call.

        Scores are derived from simple text-feature analysis so that the
        system degrades gracefully when Gemini is unavailable.
        """
        text = (question + " " + answer).lower()
        words = text.split()
        word_count = max(len(words), 1)

        def _keyword_score(*keywords: str) -> float:
            hits = sum(1 for w in words if any(k in w for k in keywords))
            return min(hits / max(word_count * 0.05, 1), 1.0)

        trait_signals = {
            "analytical": _keyword_score(
                "analys", "data", "metric", "measur", "evidence", "logic", "reason"
            ),
            "strategic": _keyword_score(
                "strateg", "plan", "goal", "priorit", "long-term", "vision"
            ),
            "creative": _keyword_score(
                "creativ", "innovat", "novel", "original", "design", "imagine"
            ),
            "leadership": _keyword_score(
                "lead", "team", "mentor", "coach", "motivat", "inspir", "direct"
            ),
            "execution": _keyword_score(
                "execut", "deliver", "implement", "action", "complete", "ship", "deploy"
            ),
            "adaptability": _keyword_score(
                "adapt", "flexible", "pivot", "change", "adjust", "learn"
            ),
            "curiosity": _keyword_score(
                "curious", "wonder", "explor", "question", "learn", "research"
            ),
            "systems_thinking": _keyword_score(
                "system", "connect", "interact", "holistic", "architecture", "pattern"
            ),
        }

        # Ensure minimum baseline of 0.3
        for k in trait_signals:
            trait_signals[k] = max(trait_signals[k], 0.3)

        # Confidence delta: longer answers get slightly higher delta
        confidence_delta = min(word_count / 200.0, 0.1)

        # Risk heuristic: mentions of "risk" / "safe" / "stable"
        if any(k in text for k in ("risk", "uncertain", "venture", "bold")):
            risk_level = "high"
        elif any(k in text for k in ("safe", "stable", "conserv", "careful")):
            risk_level = "low"
        else:
            risk_level = "medium"

        # Strategy heuristic
        if any(k in text for k in ("step", "breakdown", "method", "process")):
            strategy = "systematic_breakdown"
        elif any(k in text for k in ("feel", "intuition", "gut", "sense")):
            strategy = "intuitive_leap"
        elif any(k in text for k in ("principle", "fundamental", "core")):
            strategy = "first_principles"
        else:
            strategy = "systematic_breakdown"

        # Reasoning style heuristic
        if any(k in text for k in ("many", "option", "possibility", "diverse")):
            reasoning_style = "divergent"
        elif any(k in text for k in ("lateral", "unexpected", "creative connect")):
            reasoning_style = "lateral"
        else:
            reasoning_style = "convergent"

        key_insight = f"Answer contains {word_count} words with {strategy} indicators."

        return BehaviorFeatures(
            trait_signals=trait_signals,
            strategy=strategy,
            risk_level=risk_level,
            reasoning_style=reasoning_style,
            key_insight=key_insight,
            confidence_delta=round(confidence_delta, 4),
            raw_answer=answer,
            question_id=question_id,
        )
