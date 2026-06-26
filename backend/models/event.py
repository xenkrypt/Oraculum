"""
models/event.py
===============
Pydantic v2 models for the behavioural events that are extracted from each
user response and stored in the event ledger.
"""

from __future__ import annotations

from datetime import datetime
from uuid import uuid4

from pydantic import BaseModel, Field


# ---------------------------------------------------------------------------
# BehaviorFeatures – structured output of the BehaviorExtractor agent
# ---------------------------------------------------------------------------

class BehaviorFeatures(BaseModel):
    """
    Rich feature vector extracted from a single question–answer pair by the
    BehaviorExtractor agent.

    Attributes
    ----------
    trait_signals:
        Mapping from trait name → signal strength ∈ [0, 1].
        Keys: analytical, strategic, creative, leadership, execution,
              adaptability, curiosity, systems_thinking.
    strategy:
        Dominant problem-solving strategy observed in the answer.
        E.g. ``"systematic_breakdown"``, ``"intuitive_leap"``,
        ``"first_principles"``, ``"analogical_reasoning"``.
    risk_level:
        Observed risk orientation: ``"low"``, ``"medium"``, or ``"high"``.
    reasoning_style:
        Observed reasoning mode: ``"convergent"``, ``"divergent"``, or
        ``"lateral"``.
    key_insight:
        A single sentence summarising the most diagnostic observation.
    confidence_delta:
        How much each trait's confidence should increase ∈ [0, 0.2].
        Higher when the answer was detailed / unambiguous.
    raw_answer:
        The original answer text (stored for audit / replay).
    question_id:
        The question that prompted this answer.
    """

    trait_signals: dict[str, float] = Field(
        default_factory=lambda: {
            "analytical": 0.5,
            "strategic": 0.5,
            "creative": 0.5,
            "leadership": 0.5,
            "execution": 0.5,
            "adaptability": 0.5,
            "curiosity": 0.5,
            "systems_thinking": 0.5,
        }
    )
    strategy: str = Field(default="unknown")
    risk_level: str = Field(default="medium")
    reasoning_style: str = Field(default="convergent")
    key_insight: str = Field(default="")
    confidence_delta: float = Field(default=0.05, ge=0.0, le=0.2)
    raw_answer: str = Field(default="")
    question_id: str = Field(default="")

    model_config = {"extra": "ignore"}


# ---------------------------------------------------------------------------
# BehaviorEvent – one persisted entry in the user's event ledger
# ---------------------------------------------------------------------------

class BehaviorEvent(BaseModel):
    """
    An immutable record of a single behavioural observation — wraps
    ``BehaviorFeatures`` with provenance metadata.

    Attributes
    ----------
    event_id:
        Unique identifier (UUID4).
    user_id:
        Owner of the event.
    session_id:
        Session in which the event occurred.
    question_id:
        Which question was being answered.
    features:
        The extracted behavioural features.
    created_at:
        When the event was recorded (UTC).
    agent_version:
        Version tag of the BehaviorExtractor that produced this event.
        Useful for re-running extraction with newer models.
    """

    event_id: str = Field(default_factory=lambda: str(uuid4()))
    user_id: str
    session_id: str
    question_id: str
    features: BehaviorFeatures
    created_at: datetime = Field(default_factory=datetime.utcnow)
    agent_version: str = Field(default="1.0.0")

    model_config = {"json_encoders": {datetime: lambda v: v.isoformat()}}
