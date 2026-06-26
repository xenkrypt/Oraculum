"""
main.py
=======
Oraculum FastAPI Application Entry Point.

Exposes the multi-agent cognitive profiling pipeline as a REST API.

Routes
------
POST /orchestrate           – Full agent pipeline (assessment → twin → futures)
POST /behavior-extract      – Extract features from a single Q&A pair
POST /next-question         – Adaptive question selection
GET  /twin/{user_id}        – Retrieve current shadow twin
POST /twin/{user_id}/update – Manually update shadow twin traits
POST /future-simulate       – Simulate career futures for a twin
POST /research              – Research a career path
POST /chat                  – Chat with the shadow twin (Gemini-powered)
GET  /health                – Health check

CORS
----
Allowed origins: http://localhost:3000, http://localhost:3001

Run
---
::

    uvicorn main:app --reload --port 8000
"""

from __future__ import annotations

import asyncio
import json
import logging
import os
import re
import time
from contextlib import asynccontextmanager
from datetime import datetime
from typing import Any
from uuid import uuid4

import httpx
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

# Load .env before any agent imports so env vars are available
load_dotenv()

# ---------------------------------------------------------------------------
# Agents and DB (imported after env is loaded)
# ---------------------------------------------------------------------------
from agents.behavior_extractor import BehaviorExtractor
from agents.future_simulator import FutureSimulator
from agents.orchestrator import Orchestrator
from agents.planner import DEFAULT_QUESTION_POOL, QuestionPlanner
from agents.research_agent import ResearchAgent
from agents.twin_updater import TwinUpdater
from db.store import append_event, get_events, get_twin, save_twin
from models.event import BehaviorEvent, BehaviorFeatures
from models.twin import ShadowTwin, TraitState, TwinSnapshot

# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger("Oraculum.api")

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

GEMINI_URL = (
    "https://generativelanguage.googleapis.com/v1beta/models/"
    "gemini-2.0-flash:generateContent"
)

_CHAT_SYSTEM_PROMPT = """\
You are a Oraculum — the AI cognitive double of the user described below.
You have deeply internalised their cognitive profile, behavioural tendencies,
and potential futures.  Speak in first-person as the twin, offering insightful,
personalised guidance.

When answering, draw on:
1. The user's trait profile (scores and what they mean)
2. Their dominant problem-solving strategy
3. Their most likely career futures
4. Any observations from their past behaviour

Be warm, insightful, and specific.  Do not be generic.
Keep responses under 200 words unless the user asks for elaboration.

PROFILE:
{profile}
"""


# ---------------------------------------------------------------------------
# Lifespan (startup / shutdown)
# ---------------------------------------------------------------------------

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Initialise shared resources at startup."""
    api_key = os.getenv("GEMINI_API_KEY", "")
    if not api_key:
        logger.warning(
            "GEMINI_API_KEY not set — AI agents will use fallback responses."
        )
    else:
        logger.info("GEMINI_API_KEY loaded ✓")

    # Attach singletons to app state for use in route handlers
    app.state.api_key = api_key
    app.state.orchestrator = Orchestrator(api_key=api_key)
    app.state.extractor = BehaviorExtractor(api_key=api_key)
    app.state.updater = TwinUpdater()
    app.state.planner = QuestionPlanner(question_pool=DEFAULT_QUESTION_POOL)
    app.state.simulator = FutureSimulator(api_key=api_key)
    app.state.researcher = ResearchAgent(api_key=api_key)

    logger.info("Oraculum backend started on port 8000")
    yield
    logger.info("Oraculum backend shutting down")


# ---------------------------------------------------------------------------
# Application
# ---------------------------------------------------------------------------

app = FastAPI(
    title="Oraculum AI — Cognitive Operating System",
    description=(
        "Multi-agent FastAPI backend that builds and queries a living "
        "cognitive model (Shadow Twin) for every user."
    ),
    version="1.0.0",
    lifespan=lifespan,
)

# ---------------------------------------------------------------------------
# CORS
# ---------------------------------------------------------------------------

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://localhost:3001",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ===========================================================================
# Request / Response schemas
# ===========================================================================

class ResponseItem(BaseModel):
    """A single question/answer pair from an assessment session."""
    question_id: str = Field(default_factory=lambda: str(uuid4()))
    question: str = Field(..., min_length=1)
    answer: str = Field(..., min_length=1)


class OrchestrateRequest(BaseModel):
    """Request body for the full orchestration pipeline."""
    session_id: str = Field(default_factory=lambda: str(uuid4()))
    user_id: str = Field(..., min_length=1)
    responses: list[ResponseItem] = Field(..., min_length=1)


class OrchestrateResponse(BaseModel):
    """Response from the full orchestration pipeline."""
    session_id: str
    user_id: str
    processed_at: str
    elapsed_ms: int
    responses_count: int
    features_extracted: int
    twin: dict[str, Any]
    twin_delta: dict[str, float]
    futures: list[dict[str, Any]]
    report: dict[str, Any]
    events_count: int
    pipeline_errors: list[str]
    pipeline_stages: list[str]


class BehaviorExtractRequest(BaseModel):
    """Request body for single-response behavior extraction."""
    question_id: str = Field(default_factory=lambda: str(uuid4()))
    question: str = Field(..., min_length=1)
    answer: str = Field(..., min_length=1)


class BehaviorExtractResponse(BaseModel):
    """Response from behavior extraction."""
    question_id: str
    features: dict[str, Any]
    extraction_method: str = "gemini"


class NextQuestionRequest(BaseModel):
    """Request body for adaptive question selection."""
    user_id: str
    asked_ids: list[str] = Field(default_factory=list)


class NextQuestionResponse(BaseModel):
    """Response from the adaptive planner."""
    question: dict[str, Any] | None
    reason: str
    asked_count: int
    pool_size: int


class TwinUpdateRequest(BaseModel):
    """Manual trait update request."""
    trait_updates: dict[str, float] = Field(
        ...,
        description="Map of trait_name → new_score (0–1)",
    )
    reason: str = Field(default="manual_update")


class FutureSimulateRequest(BaseModel):
    """Request body for future simulation."""
    user_id: str
    additional_context: str = Field(default="")


class FutureSimulateResponse(BaseModel):
    """Response from future simulation."""
    user_id: str
    futures: list[dict[str, Any]]
    simulated_at: str
    twin_confidence: float


class ResearchRequest(BaseModel):
    """Request body for career research."""
    career_title: str = Field(..., min_length=1)
    user_id: str = Field(default="")


class ResearchResponse(BaseModel):
    """Response from the research agent."""
    career_title: str
    job_market_demand: str
    avg_salary_range: str
    key_skills: list[str]
    top_companies: list[str]
    future_outlook: str
    learning_resources: list[str]
    market_trends: list[str]
    source: str


class ChatRequest(BaseModel):
    """Request body for shadow twin chat."""
    user_id: str
    message: str = Field(..., min_length=1)
    conversation_history: list[dict[str, str]] = Field(default_factory=list)


class ChatResponse(BaseModel):
    """Response from the shadow twin chat."""
    reply: str
    user_id: str
    model: str = "gemini-2.0-flash"
    twin_confidence: float


class HealthResponse(BaseModel):
    """Health check response."""
    status: str
    timestamp: str
    version: str
    gemini_configured: bool
    store_path: str


# ===========================================================================
# Routes
# ===========================================================================


# ---------------------------------------------------------------------------
# GET /health
# ---------------------------------------------------------------------------

@app.get(
    "/health",
    response_model=HealthResponse,
    summary="Health check",
    tags=["System"],
)
async def health_check() -> HealthResponse:
    """
    Returns the current health status of the API.

    Indicates whether the Gemini API key is configured and where the JSON
    data store is located.
    """
    from pathlib import Path
    store_path = str(
        Path(__file__).parent / "data" / "store.json"
    )
    return HealthResponse(
        status="ok",
        timestamp=datetime.utcnow().isoformat(),
        version="1.0.0",
        gemini_configured=bool(os.getenv("GEMINI_API_KEY")),
        store_path=store_path,
    )


# ---------------------------------------------------------------------------
# POST /orchestrate
# ---------------------------------------------------------------------------

@app.post(
    "/orchestrate",
    response_model=OrchestrateResponse,
    summary="Run full agent pipeline",
    tags=["Pipeline"],
    status_code=status.HTTP_200_OK,
)
async def orchestrate(body: OrchestrateRequest) -> OrchestrateResponse:
    """
    Execute the complete 4-stage agent pipeline:

    1. **extract_behavior** – Gemini extracts BehaviorFeatures from each answer
    2. **update_twin** – Bayesian EMA updates the ShadowTwin
    3. **simulate_futures** – Generates 5 personalised career projections
    4. **generate_report** – Gemini writes a narrative explainability report

    Returns the updated twin, trait deltas, futures, and the report.
    """
    try:
        result = await app.state.orchestrator.run(
            session_id=body.session_id,
            user_id=body.user_id,
            responses=[r.model_dump() for r in body.responses],
        )
        return OrchestrateResponse(**result)
    except Exception as exc:
        logger.exception("Orchestration failed for user_id=%s: %s", body.user_id, exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Orchestration error: {exc}",
        )


# ---------------------------------------------------------------------------
# POST /behavior-extract
# ---------------------------------------------------------------------------

@app.post(
    "/behavior-extract",
    response_model=BehaviorExtractResponse,
    summary="Extract behavior features from a single answer",
    tags=["Agents"],
)
async def behavior_extract(body: BehaviorExtractRequest) -> BehaviorExtractResponse:
    """
    Run the BehaviorExtractor agent on a single question/answer pair.

    Returns a structured BehaviorFeatures object without modifying the twin.
    Useful for real-time feedback during assessment.
    """
    try:
        features: BehaviorFeatures = await app.state.extractor.extract(
            question=body.question,
            answer=body.answer,
            question_id=body.question_id,
        )
        method = "gemini" if app.state.api_key else "heuristic"
        return BehaviorExtractResponse(
            question_id=body.question_id,
            features=features.model_dump(),
            extraction_method=method,
        )
    except Exception as exc:
        logger.exception("BehaviorExtract failed: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Extraction error: {exc}",
        )


# ---------------------------------------------------------------------------
# POST /next-question
# ---------------------------------------------------------------------------

@app.post(
    "/next-question",
    response_model=NextQuestionResponse,
    summary="Get the next adaptive question",
    tags=["Agents"],
)
async def next_question(body: NextQuestionRequest) -> NextQuestionResponse:
    """
    Use the QuestionPlanner to select the optimal next question.

    The planner analyses which traits have the lowest confidence in the
    user's ShadowTwin and selects the question that best differentiates them.

    Returns ``null`` for ``question`` if the pool is exhausted.
    """
    try:
        twin = await get_twin(body.user_id)
        asked_set = set(body.asked_ids)
        question = app.state.planner.next_question(twin=twin, asked_ids=asked_set)

        if question is None:
            return NextQuestionResponse(
                question=None,
                reason="Question pool exhausted",
                asked_count=len(asked_set),
                pool_size=len(DEFAULT_QUESTION_POOL),
            )

        # Determine which traits drove this selection
        target_traits = app.state.planner._lowest_confidence_traits(twin)
        reason = (
            f"Targeting low-confidence traits: "
            + ", ".join(f"{t} ({c:.2f})" for t, c in target_traits.items())
        )

        return NextQuestionResponse(
            question=question,
            reason=reason,
            asked_count=len(asked_set),
            pool_size=len(DEFAULT_QUESTION_POOL),
        )
    except Exception as exc:
        logger.exception("NextQuestion failed for user_id=%s: %s", body.user_id, exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Question selection error: {exc}",
        )


# ---------------------------------------------------------------------------
# GET /twin/{user_id}
# ---------------------------------------------------------------------------

@app.get(
    "/twin/{user_id}",
    summary="Get the current shadow twin",
    tags=["Twin"],
)
async def get_shadow_twin(user_id: str) -> dict[str, Any]:
    """
    Retrieve the current ShadowTwin for a user.

    Creates and persists a default twin if none exists yet.

    Returns the full twin JSON including all trait states.
    """
    try:
        twin = await get_twin(user_id)
        # Also return recent events count
        events = await get_events(user_id, limit=1)
        return {
            **twin.model_dump(mode="json"),
            "has_events": len(events) > 0,
        }
    except Exception as exc:
        logger.exception("GetTwin failed for user_id=%s: %s", user_id, exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Twin retrieval error: {exc}",
        )


# ---------------------------------------------------------------------------
# POST /twin/{user_id}/update
# ---------------------------------------------------------------------------

@app.post(
    "/twin/{user_id}/update",
    summary="Manually update shadow twin traits",
    tags=["Twin"],
)
async def update_twin(user_id: str, body: TwinUpdateRequest) -> dict[str, Any]:
    """
    Apply manual trait updates to a ShadowTwin.

    Useful for bootstrapping a twin or applying external assessments.
    Validates that all trait names are valid and scores are in [0, 1].

    The update is applied at full confidence (no EMA smoothing) since it
    represents an explicit override.
    """
    valid_traits = {
        "analytical", "strategic", "creative", "leadership",
        "execution", "adaptability", "curiosity", "systems_thinking",
    }

    # Validate inputs
    for trait_name, score in body.trait_updates.items():
        if trait_name not in valid_traits:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Unknown trait: '{trait_name}'. Valid: {sorted(valid_traits)}",
            )
        if not (0.0 <= score <= 1.0):
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Score for '{trait_name}' must be in [0, 1], got {score}",
            )

    try:
        twin = await get_twin(user_id)

        for trait_name, score in body.trait_updates.items():
            existing = twin.get_trait(trait_name)
            twin.traits[trait_name] = TraitState(
                name=trait_name,
                score=score,
                confidence=min(existing.confidence + 0.1, 1.0),
                sample_count=existing.sample_count + 1,
                last_updated=datetime.utcnow(),
            )

        twin.updated_at = datetime.utcnow()
        twin.compute_overall_confidence()
        twin.meta["last_manual_update"] = body.reason
        await save_twin(twin)

        return {
            "user_id": user_id,
            "updated_traits": list(body.trait_updates.keys()),
            "overall_confidence": twin.overall_confidence,
            "twin": twin.model_dump(mode="json"),
        }
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("UpdateTwin failed for user_id=%s: %s", user_id, exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Twin update error: {exc}",
        )


# ---------------------------------------------------------------------------
# POST /future-simulate
# ---------------------------------------------------------------------------

@app.post(
    "/future-simulate",
    response_model=FutureSimulateResponse,
    summary="Simulate career futures",
    tags=["Agents"],
)
async def future_simulate(body: FutureSimulateRequest) -> FutureSimulateResponse:
    """
    Generate 5 personalised career-path simulations for a user.

    Loads the user's ShadowTwin and runs the FutureSimulator agent.
    Returns rich path descriptions including 12-month roadmaps, skill
    requirements, salary ranges, and risk factors.
    """
    try:
        twin = await get_twin(body.user_id)
        futures = await app.state.simulator.simulate(
            twin=twin,
            additional_context=body.additional_context,
        )
        return FutureSimulateResponse(
            user_id=body.user_id,
            futures=futures,
            simulated_at=datetime.utcnow().isoformat(),
            twin_confidence=twin.overall_confidence,
        )
    except Exception as exc:
        logger.exception("FutureSimulate failed for user_id=%s: %s", body.user_id, exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Simulation error: {exc}",
        )


# ---------------------------------------------------------------------------
# POST /research
# ---------------------------------------------------------------------------

@app.post(
    "/research",
    response_model=ResearchResponse,
    summary="Research a career path",
    tags=["Agents"],
)
async def research_career(body: ResearchRequest) -> ResearchResponse:
    """
    Use the ResearchAgent to gather structured market intelligence about
    a specific career path.

    When ``user_id`` is provided, the user's twin profile is included as
    context so Gemini can tailor resources and skills to their traits.

    Returns demand signal, salary data, key skills, top employers, outlook,
    and curated learning resources.
    """
    try:
        user_profile = ""
        if body.user_id:
            twin = await get_twin(body.user_id)
            # Build a short profile summary for context
            top_traits = sorted(
                twin.traits.items(),
                key=lambda x: x[1].score,
                reverse=True,
            )[:3]
            user_profile = (
                f"Dominant strategy: {twin.dominant_strategy}. "
                f"Top traits: {', '.join(n for n, _ in top_traits)}. "
                f"Risk profile: {twin.risk_profile}."
            )

        data = await app.state.researcher.research(
            career_title=body.career_title,
            user_profile=user_profile,
        )

        return ResearchResponse(**data)
    except Exception as exc:
        logger.exception("Research failed for career=%s: %s", body.career_title, exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Research error: {exc}",
        )


# ---------------------------------------------------------------------------
# POST /chat
# ---------------------------------------------------------------------------

@app.post(
    "/chat",
    response_model=ChatResponse,
    summary="Chat with the shadow twin",
    tags=["Chat"],
)
async def chat(body: ChatRequest) -> ChatResponse:
    """
    Converse with the user's Shadow Twin — an AI persona that has
    internalised their cognitive profile and projected futures.

    Maintains conversation history for multi-turn dialogue.
    Falls back to a templated response if Gemini is unavailable.
    """
    try:
        twin = await get_twin(body.user_id)
        reply = await _generate_chat_reply(
            twin=twin,
            message=body.message,
            history=body.conversation_history,
            api_key=app.state.api_key,
        )
        return ChatResponse(
            reply=reply,
            user_id=body.user_id,
            twin_confidence=twin.overall_confidence,
        )
    except Exception as exc:
        logger.exception("Chat failed for user_id=%s: %s", body.user_id, exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Chat error: {exc}",
        )


# ===========================================================================
# Chat helper
# ===========================================================================

async def _generate_chat_reply(
    twin: ShadowTwin,
    message: str,
    history: list[dict[str, str]],
    api_key: str,
) -> str:
    """
    Generate a chat reply using Gemini 2.0 Flash.

    Falls back to a deterministic template response if the API call fails.

    Parameters
    ----------
    twin:
        The user's ShadowTwin providing context.
    message:
        The user's current message.
    history:
        Previous conversation turns (``[{"role": "user"|"model", "text": "..."}]``).
    api_key:
        Gemini API key.

    Returns
    -------
    str
        The reply text.
    """
    if not api_key:
        return _fallback_chat_reply(twin, message)

    profile = _build_twin_profile_text(twin)
    system_text = _CHAT_SYSTEM_PROMPT.format(profile=profile)

    # Build multi-turn contents list
    contents: list[dict[str, Any]] = []
    for turn in history[-10:]:  # keep last 10 turns to stay within token limits
        role = turn.get("role", "user")
        text = turn.get("text", turn.get("content", ""))
        if role in ("user", "model") and text:
            contents.append({"role": role, "parts": [{"text": text}]})

    # Append current user message
    contents.append({"role": "user", "parts": [{"text": message}]})

    payload: dict[str, Any] = {
        "system_instruction": {"parts": [{"text": system_text}]},
        "contents": contents,
        "generationConfig": {
            "temperature": 0.8,
            "maxOutputTokens": 512,
        },
    }

    url = f"{GEMINI_URL}?key={api_key}"
    last_exc: Exception = RuntimeError("No attempts made")

    async with httpx.AsyncClient(timeout=30.0) as client:
        for attempt in range(3):
            try:
                resp = await client.post(url, json=payload)
                resp.raise_for_status()
                data = resp.json()
                text_out = (
                    data["candidates"][0]["content"]["parts"][0]["text"]
                )
                return text_out.strip()
            except (httpx.HTTPStatusError, httpx.RequestError, KeyError) as exc:
                last_exc = exc
                wait = 2 ** attempt
                logger.warning(
                    "Chat Gemini attempt %d/3 failed, retrying in %ds: %s",
                    attempt + 1, wait, exc,
                )
                if attempt < 2:
                    await asyncio.sleep(wait)

    logger.warning("Chat falling back to template after Gemini failure: %s", last_exc)
    return _fallback_chat_reply(twin, message)


def _build_twin_profile_text(twin: ShadowTwin) -> str:
    """Build a compact text profile for the chat system prompt."""
    top_traits = sorted(
        twin.traits.items(),
        key=lambda x: x[1].score,
        reverse=True,
    )[:4]

    lines = [
        f"dominant_strategy: {twin.dominant_strategy}",
        f"risk_profile: {twin.risk_profile}",
        f"reasoning_style: {twin.reasoning_style}",
        f"overall_confidence: {twin.overall_confidence:.2f}",
        "",
        "Top traits:",
    ]
    for name, trait in top_traits:
        lines.append(f"  {name}: {trait.score:.2f}")

    return "\n".join(lines)


def _fallback_chat_reply(twin: ShadowTwin, message: str) -> str:
    """Return a deterministic fallback reply when Gemini is unavailable."""
    msg_lower = message.lower()

    if any(k in msg_lower for k in ("strength", "good at", "best")):
        top = max(twin.traits.items(), key=lambda x: x[1].score, default=("analytical", None))
        return (
            f"Based on your profile, your strongest trait is **{top[0]}** "
            f"(score: {top[1].score:.2f}).  This shows up consistently in how "
            f"you approach complex problems."
        )
    elif any(k in msg_lower for k in ("weakness", "improve", "growth")):
        bottom = min(twin.traits.items(), key=lambda x: x[1].score, default=("execution", None))
        return (
            f"The area with the most growth potential in your profile is **{bottom[0]}** "
            f"(score: {bottom[1].score:.2f}).  Focusing here would create the largest "
            f"uplift to your overall capability profile."
        )
    elif any(k in msg_lower for k in ("future", "career", "path")):
        return (
            f"With your **{twin.dominant_strategy.replace('_', ' ')}** approach and "
            f"{twin.risk_profile} risk profile, you're well-suited for roles that "
            f"reward strategic thinking and adaptability.  Run a full simulation "
            f"to see your personalised career paths."
        )
    else:
        return (
            f"I'm your Oraculum — built from {twin.interaction_count} behavioural "
            f"observations.  Ask me about your strengths, growth areas, or career "
            f"futures and I'll give you insight grounded in your unique profile."
        )
