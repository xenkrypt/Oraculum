"""
models/twin.py
==============
Pydantic v2 models for the Shadow Twin – the continuously-updated cognitive
profile that FutureTwin maintains for every user.
"""

from __future__ import annotations

from datetime import datetime
from typing import Any
from uuid import uuid4

from pydantic import BaseModel, Field


# ---------------------------------------------------------------------------
# Trait state
# ---------------------------------------------------------------------------

class TraitState(BaseModel):
    """
    Represents the estimated current value and confidence for a single
    cognitive/behavioural trait.

    Attributes
    ----------
    name:
        Human-readable trait name (e.g. ``"analytical"``).
    score:
        Current estimated trait score in [0, 1].
    confidence:
        Bayesian confidence in ``score`` ∈ [0, 1].
        Starts near 0 and grows as more evidence accumulates.
    sample_count:
        Number of behavioural samples that have influenced this trait.
    last_updated:
        ISO-8601 timestamp of the most recent update.
    """

    name: str
    score: float = Field(default=0.5, ge=0.0, le=1.0)
    confidence: float = Field(default=0.0, ge=0.0, le=1.0)
    sample_count: int = Field(default=0, ge=0)
    last_updated: datetime = Field(default_factory=datetime.utcnow)

    model_config = {"json_encoders": {datetime: lambda v: v.isoformat()}}


# ---------------------------------------------------------------------------
# Shadow Twin
# ---------------------------------------------------------------------------

class ShadowTwin(BaseModel):
    """
    The full cognitive model of a user, updated after every interaction.

    Attributes
    ----------
    user_id:
        Unique identifier (typically from the auth provider).
    session_id:
        The latest assessment session that last modified this twin.
    traits:
        Map of trait-name → TraitState for all eight core traits.
    dominant_strategy:
        The most-observed problem-solving strategy (e.g.
        ``"systematic_breakdown"``).
    risk_profile:
        Aggregated risk orientation: ``"low"``, ``"medium"``, or ``"high"``.
    reasoning_style:
        Aggregated reasoning style: ``"convergent"``, ``"divergent"``, or
        ``"lateral"``.
    overall_confidence:
        Mean confidence across all traits ∈ [0, 1].
    interaction_count:
        Total number of questions answered across all sessions.
    created_at:
        ISO-8601 timestamp when this twin was first created.
    updated_at:
        ISO-8601 timestamp of the most recent update.
    meta:
        Arbitrary extra metadata (e.g. free-text notes from agents).
    """

    user_id: str
    session_id: str = Field(default="")
    traits: dict[str, TraitState] = Field(default_factory=dict)
    dominant_strategy: str = Field(default="unknown")
    risk_profile: str = Field(default="medium")
    reasoning_style: str = Field(default="convergent")
    overall_confidence: float = Field(default=0.0, ge=0.0, le=1.0)
    interaction_count: int = Field(default=0, ge=0)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    meta: dict[str, Any] = Field(default_factory=dict)

    model_config = {"json_encoders": {datetime: lambda v: v.isoformat()}}

    # ------------------------------------------------------------------
    # Factory helpers
    # ------------------------------------------------------------------

    @classmethod
    def create_default(cls, user_id: str) -> "ShadowTwin":
        """
        Return a brand-new ShadowTwin with all eight traits initialised at
        a neutral score of 0.5 and zero confidence.
        """
        default_traits = [
            "analytical",
            "strategic",
            "creative",
            "leadership",
            "execution",
            "adaptability",
            "curiosity",
            "systems_thinking",
        ]
        traits = {
            name: TraitState(name=name, score=0.5, confidence=0.0, sample_count=0)
            for name in default_traits
        }
        return cls(user_id=user_id, traits=traits)

    # ------------------------------------------------------------------
    # Convenience methods
    # ------------------------------------------------------------------

    def get_trait(self, name: str) -> TraitState:
        """Return a TraitState by name, creating a default one if missing."""
        if name not in self.traits:
            self.traits[name] = TraitState(name=name)
        return self.traits[name]

    def compute_overall_confidence(self) -> float:
        """Recompute and store the mean confidence across all traits."""
        if not self.traits:
            return 0.0
        self.overall_confidence = sum(
            t.confidence for t in self.traits.values()
        ) / len(self.traits)
        return self.overall_confidence


# ---------------------------------------------------------------------------
# Point-in-time snapshot
# ---------------------------------------------------------------------------

class TwinSnapshot(BaseModel):
    """
    An immutable, timestamped copy of a ShadowTwin state — used as a record
    of how the twin looked at a specific moment (e.g. end of a session).

    Attributes
    ----------
    snapshot_id:
        Unique identifier for this snapshot (UUID4).
    user_id:
        Owner of the twin.
    session_id:
        The session during which the snapshot was taken.
    twin_state:
        Full copy of the ShadowTwin at snapshot time.
    captured_at:
        When the snapshot was taken.
    trigger:
        What caused the snapshot (e.g. ``"session_complete"``,
        ``"manual_save"``).
    """

    snapshot_id: str = Field(default_factory=lambda: str(uuid4()))
    user_id: str
    session_id: str
    twin_state: ShadowTwin
    captured_at: datetime = Field(default_factory=datetime.utcnow)
    trigger: str = Field(default="session_complete")

    model_config = {"json_encoders": {datetime: lambda v: v.isoformat()}}
