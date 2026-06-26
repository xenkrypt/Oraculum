"""
agents/orchestrator.py
======================
LangGraph-style agent orchestrator for FutureTwin.

Defines a sequential, stateful pipeline that transforms raw user responses
into a complete cognitive analysis report.

Pipeline stages
---------------
1. **extract_behavior**
   Run ``BehaviorExtractor`` on every question/answer pair in the session.
   Produces a list of ``BehaviorFeatures``.

2. **update_twin**
   Pass all extracted features through ``TwinUpdater``.
   Produces an updated ``ShadowTwin`` which is persisted.

3. **simulate_futures**
   Run ``FutureSimulator`` against the updated twin.
   Produces 5 career-path projections.

4. **generate_report**
   Call Gemini to produce a narrative explainability report that ties
   behaviour observations → trait updates → recommended futures.
   Falls back to a structured template if Gemini is unavailable.

The orchestrator stores all intermediate state in a ``PipelineState`` dict
so that individual stages can be retried or replayed independently.

Usage
-----
::

    orch = Orchestrator(api_key="GEMINI_KEY")
    result = await orch.run(
        session_id="sess_abc",
        user_id="user_123",
        responses=[
            {"question_id": "q_001", "question": "...", "answer": "..."},
        ],
    )
"""

from __future__ import annotations

import asyncio
import json
import logging
import os
import re
import time
from datetime import datetime
from typing import Any
from uuid import uuid4

import httpx

from agents.behavior_extractor import BehaviorExtractor
from agents.future_simulator import FutureSimulator
from agents.twin_updater import TwinUpdater
from db.store import append_event, get_twin, save_twin
from models.event import BehaviorEvent, BehaviorFeatures
from models.twin import ShadowTwin

logger = logging.getLogger(__name__)

GEMINI_URL = (
    "https://generativelanguage.googleapis.com/v1beta/models/"
    "gemini-2.0-flash:generateContent"
)

_REPORT_SYSTEM_PROMPT = """\
You are FutureTwin, an AI cognitive analyst.  Write a personalised
explainability report for the user based on the data provided.

Structure your response as a JSON object with exactly these keys:
{
  "headline":       "<one punchy sentence summarising the user's cognitive identity>",
  "cognitive_summary": "<3-4 sentences explaining the trait profile in plain language>",
  "top_strengths":  ["<strength 1>", "<strength 2>", "<strength 3>"],
  "growth_areas":   ["<area 1>", "<area 2>"],
  "behavioral_patterns": ["<observed pattern 1>", "<observed pattern 2>", "<pattern 3>"],
  "recommended_future": "<title of the best-fit career future>",
  "recommended_future_rationale": "<2 sentences explaining why>",
  "next_steps":     ["<actionable step 1>", "<step 2>", "<step 3>"]
}

Return ONLY the raw JSON object; no markdown or surrounding text.
"""


# ---------------------------------------------------------------------------
# Pipeline State
# ---------------------------------------------------------------------------

class PipelineState:
    """Mutable state container that flows through the pipeline stages."""

    def __init__(
        self,
        session_id: str,
        user_id: str,
        responses: list[dict[str, Any]],
    ) -> None:
        self.session_id = session_id
        self.user_id = user_id
        self.responses = responses
        self.started_at: float = time.time()

        # Populated by pipeline stages
        self.features_list: list[BehaviorFeatures] = []
        self.events: list[BehaviorEvent] = []
        self.original_twin: ShadowTwin | None = None
        self.updated_twin: ShadowTwin | None = None
        self.futures: list[dict[str, Any]] = []
        self.report: dict[str, Any] = {}
        self.errors: list[str] = []

    def elapsed_ms(self) -> int:
        return int((time.time() - self.started_at) * 1000)


# ---------------------------------------------------------------------------
# Orchestrator
# ---------------------------------------------------------------------------

class Orchestrator:
    """
    LangGraph-style sequential pipeline orchestrator.

    Parameters
    ----------
    api_key:
        Gemini API key.  Falls back to the ``GEMINI_API_KEY`` environment
        variable if not provided.
    """

    def __init__(self, api_key: str | None = None) -> None:
        self.api_key = api_key or os.getenv("GEMINI_API_KEY", "")
        self.extractor = BehaviorExtractor(api_key=self.api_key)
        self.updater = TwinUpdater()
        self.simulator = FutureSimulator(api_key=self.api_key)

    # ------------------------------------------------------------------
    # Public entry point
    # ------------------------------------------------------------------

    async def run(
        self,
        session_id: str,
        user_id: str,
        responses: list[dict[str, Any]],
    ) -> dict[str, Any]:
        """
        Execute the full agent pipeline.

        Parameters
        ----------
        session_id:
            Identifier for this assessment session.
        user_id:
            Identifier of the user being assessed.
        responses:
            List of response dicts.  Each should have:
            ``{"question_id": str, "question": str, "answer": str}``.

        Returns
        -------
        dict
            Full pipeline result containing twin state, futures, and report.
        """
        state = PipelineState(
            session_id=session_id or str(uuid4()),
            user_id=user_id,
            responses=responses,
        )

        # --- Stage 1 : extract_behavior -----------------------------------
        await self._stage_extract_behavior(state)

        # --- Stage 2 : update_twin ----------------------------------------
        await self._stage_update_twin(state)

        # --- Stage 3 : simulate_futures -----------------------------------
        await self._stage_simulate_futures(state)

        # --- Stage 4 : generate_report ------------------------------------
        await self._stage_generate_report(state)

        return self._build_result(state)

    # ------------------------------------------------------------------
    # Stage 1: Behavior extraction
    # ------------------------------------------------------------------

    async def _stage_extract_behavior(self, state: PipelineState) -> None:
        """
        Run BehaviorExtractor concurrently on all question/answer pairs.

        Failures are caught per-response; the pipeline continues even if
        some extractions fail.
        """
        logger.info(
            "[%s] Stage 1: extracting behavior from %d responses",
            state.session_id,
            len(state.responses),
        )

        tasks = [
            self._extract_one(state, resp)
            for resp in state.responses
        ]
        results = await asyncio.gather(*tasks, return_exceptions=True)

        for result in results:
            if isinstance(result, Exception):
                state.errors.append(f"BehaviorExtractor error: {result}")
                logger.error("Extraction error: %s", result)
            elif result is not None:
                state.features_list.append(result)

        logger.info(
            "[%s] Stage 1 complete: %d/%d features extracted",
            state.session_id,
            len(state.features_list),
            len(state.responses),
        )

    async def _extract_one(
        self,
        state: PipelineState,
        resp: dict[str, Any],
    ) -> BehaviorFeatures | None:
        """Extract features for a single response and create a BehaviorEvent."""
        question = resp.get("question", "")
        answer = resp.get("answer", "")
        question_id = resp.get("question_id", str(uuid4()))

        if not answer.strip():
            logger.debug("Skipping empty answer for question_id=%s", question_id)
            return None

        features = await self.extractor.extract(question, answer, question_id)

        # Persist event
        event = BehaviorEvent(
            user_id=state.user_id,
            session_id=state.session_id,
            question_id=question_id,
            features=features,
        )
        state.events.append(event)
        try:
            await append_event(event)
        except Exception as exc:
            logger.warning("Failed to persist event: %s", exc)

        return features

    # ------------------------------------------------------------------
    # Stage 2: Twin update
    # ------------------------------------------------------------------

    async def _stage_update_twin(self, state: PipelineState) -> None:
        """Load, update, and persist the ShadowTwin."""
        logger.info("[%s] Stage 2: updating twin", state.session_id)
        try:
            state.original_twin = await get_twin(state.user_id)
            state.updated_twin = await self.updater.update(
                twin=state.original_twin,
                features_list=state.features_list,
                session_id=state.session_id,
            )
            await save_twin(state.updated_twin)
            logger.info(
                "[%s] Stage 2 complete: overall_confidence=%.3f",
                state.session_id,
                state.updated_twin.overall_confidence,
            )
        except Exception as exc:
            err = f"TwinUpdater error: {exc}"
            state.errors.append(err)
            logger.error("[%s] %s", state.session_id, err)
            # Ensure updated_twin is set to something
            if state.updated_twin is None:
                state.updated_twin = state.original_twin or ShadowTwin.create_default(
                    state.user_id
                )

    # ------------------------------------------------------------------
    # Stage 3: Future simulation
    # ------------------------------------------------------------------

    async def _stage_simulate_futures(self, state: PipelineState) -> None:
        """Simulate 5 career futures for the updated twin."""
        logger.info("[%s] Stage 3: simulating futures", state.session_id)
        try:
            state.futures = await self.simulator.simulate(
                twin=state.updated_twin,  # type: ignore[arg-type]
            )
            logger.info(
                "[%s] Stage 3 complete: %d futures generated",
                state.session_id,
                len(state.futures),
            )
        except Exception as exc:
            err = f"FutureSimulator error: {exc}"
            state.errors.append(err)
            logger.error("[%s] %s", state.session_id, err)
            state.futures = []

    # ------------------------------------------------------------------
    # Stage 4: Report generation
    # ------------------------------------------------------------------

    async def _stage_generate_report(self, state: PipelineState) -> None:
        """Generate a narrative explainability report using Gemini."""
        logger.info("[%s] Stage 4: generating report", state.session_id)
        try:
            state.report = await self._call_gemini_report(state)
        except Exception as exc:
            logger.warning(
                "[%s] Report Gemini call failed, using template: %s",
                state.session_id,
                exc,
            )
            state.report = self._template_report(state)

    async def _call_gemini_report(self, state: PipelineState) -> dict[str, Any]:
        """Call Gemini to generate the narrative report."""
        if not self.api_key:
            raise ValueError("No GEMINI_API_KEY configured")

        twin = state.updated_twin
        context = self._build_report_context(state)

        payload: dict[str, Any] = {
            "system_instruction": {"parts": [{"text": _REPORT_SYSTEM_PROMPT}]},
            "contents": [{"parts": [{"text": context}]}],
            "generationConfig": {
                "temperature": 0.6,
                "maxOutputTokens": 1024,
                "responseMimeType": "application/json",
            },
        }

        url = f"{GEMINI_URL}?key={self.api_key}"
        last_exc: Exception = RuntimeError("No attempts made")

        async with httpx.AsyncClient(timeout=45.0) as client:
            for attempt in range(3):
                try:
                    resp = await client.post(url, json=payload)
                    resp.raise_for_status()
                    return self._parse_report_response(resp.json())
                except (httpx.HTTPStatusError, httpx.RequestError) as exc:
                    last_exc = exc
                    wait = 2 ** attempt
                    logger.warning(
                        "Report Gemini attempt %d/3 failed, retrying in %ds: %s",
                        attempt + 1, wait, exc,
                    )
                    if attempt < 2:
                        await asyncio.sleep(wait)

        raise last_exc

    @staticmethod
    def _build_report_context(state: PipelineState) -> str:
        """Build the Gemini prompt context from pipeline state."""
        twin = state.updated_twin
        if twin is None:
            return "No twin data available."

        lines = [
            "=== COGNITIVE PROFILE ===",
            f"dominant_strategy: {twin.dominant_strategy}",
            f"risk_profile: {twin.risk_profile}",
            f"reasoning_style: {twin.reasoning_style}",
            f"overall_confidence: {twin.overall_confidence:.3f}",
            "",
            "TRAITS:",
        ]
        for name, trait in sorted(twin.traits.items()):
            lines.append(f"  {name}: score={trait.score:.3f} conf={trait.confidence:.2f}")

        lines += ["", "=== KEY BEHAVIORAL INSIGHTS ==="]
        for i, feat in enumerate(state.features_list[:5], 1):
            lines.append(f"  Observation {i}: {feat.key_insight}")

        if state.futures:
            lines += ["", "=== TOP SIMULATED FUTURE ==="]
            top = state.futures[0]
            lines.append(f"  {top.get('title', 'N/A')} (prob={top.get('probability', 0):.2f})")

        return "\n".join(lines)

    @staticmethod
    def _parse_report_response(resp_json: dict[str, Any]) -> dict[str, Any]:
        """Parse the Gemini report response."""
        try:
            text = resp_json["candidates"][0]["content"]["parts"][0]["text"]
        except (KeyError, IndexError) as exc:
            raise ValueError(f"Unexpected Gemini response shape: {exc}") from exc

        text = re.sub(r"```(?:json)?", "", text).strip()

        try:
            return json.loads(text)
        except json.JSONDecodeError:
            match = re.search(r"\{.*\}", text, re.DOTALL)
            if match:
                return json.loads(match.group())
            raise ValueError("Cannot parse report JSON")

    @staticmethod
    def _template_report(state: PipelineState) -> dict[str, Any]:
        """Generate a template-based report when Gemini is unavailable."""
        twin = state.updated_twin
        if twin is None:
            return {"headline": "Analysis pending", "cognitive_summary": "Insufficient data."}

        top_trait = max(
            twin.traits.items(),
            key=lambda x: x[1].score,
            default=("analytical", None),
        )[0]

        bottom_trait = min(
            twin.traits.items(),
            key=lambda x: x[1].score,
            default=("execution", None),
        )[0]

        top_future_title = (
            state.futures[0].get("title", "your top career path")
            if state.futures
            else "your preferred career path"
        )

        return {
            "headline": (
                f"A {twin.dominant_strategy.replace('_', ' ')} thinker with "
                f"exceptional {top_trait} capabilities."
            ),
            "cognitive_summary": (
                f"Your assessment reveals strong {top_trait} and {twin.reasoning_style} "
                f"reasoning tendencies.  You approach problems with a "
                f"{twin.dominant_strategy.replace('_', ' ')} strategy and have a "
                f"{twin.risk_profile} risk orientation.  Your profile shows "
                f"{int(twin.overall_confidence * 100)}% confidence based on your "
                f"responses so far."
            ),
            "top_strengths": [top_trait, twin.dominant_strategy, twin.reasoning_style],
            "growth_areas": [bottom_trait, "cross-functional collaboration"],
            "behavioral_patterns": [
                f"Consistently applies {twin.dominant_strategy.replace('_', ' ')} when facing new challenges",
                f"Demonstrates {twin.risk_profile} risk appetite in decision-making",
                f"Uses {twin.reasoning_style} reasoning across multiple domains",
            ],
            "recommended_future": top_future_title,
            "recommended_future_rationale": (
                f"Your {top_trait} score and {twin.dominant_strategy.replace('_', ' ')} "
                f"approach align strongly with the demands of {top_future_title}."
            ),
            "next_steps": [
                f"Deepen expertise in your top strength: {top_trait}",
                f"Address your growth area: {bottom_trait}",
                "Explore the 12-month roadmap for your recommended future",
            ],
        }

    # ------------------------------------------------------------------
    # Final result assembly
    # ------------------------------------------------------------------

    @staticmethod
    def _build_result(state: PipelineState) -> dict[str, Any]:
        """Assemble the final pipeline result dict."""
        twin_dict = (
            state.updated_twin.model_dump(mode="json")
            if state.updated_twin
            else {}
        )
        original_dict = (
            state.original_twin.model_dump(mode="json")
            if state.original_twin
            else {}
        )

        return {
            "session_id": state.session_id,
            "user_id": state.user_id,
            "processed_at": datetime.utcnow().isoformat(),
            "elapsed_ms": state.elapsed_ms(),
            "responses_count": len(state.responses),
            "features_extracted": len(state.features_list),
            "twin": twin_dict,
            "twin_delta": _compute_delta(original_dict, twin_dict),
            "futures": state.futures,
            "report": state.report,
            "events_count": len(state.events),
            "pipeline_errors": state.errors,
            "pipeline_stages": [
                "extract_behavior",
                "update_twin",
                "simulate_futures",
                "generate_report",
            ],
        }


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _compute_delta(
    original: dict[str, Any],
    updated: dict[str, Any],
) -> dict[str, float]:
    """
    Compute trait-score deltas between the original and updated twin.

    Returns a dict mapping trait_name → delta_score.
    """
    if not original or not updated:
        return {}

    orig_traits = original.get("traits", {})
    upd_traits = updated.get("traits", {})
    delta: dict[str, float] = {}

    for trait_name in upd_traits:
        orig_score = orig_traits.get(trait_name, {}).get("score", 0.5)
        upd_score = upd_traits.get(trait_name, {}).get("score", 0.5)
        d = round(upd_score - orig_score, 6)
        if abs(d) > 1e-6:
            delta[trait_name] = d

    return delta
