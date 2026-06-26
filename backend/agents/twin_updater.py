"""
agents/twin_updater.py
======================
Bayesian-style trait updater.

Takes the current ShadowTwin and a list of BehaviorFeatures extracted from
a session's answers, then returns an updated ShadowTwin using an exponential
moving average (EMA).

Update equation
---------------
::

    alpha      = BASE_ALPHA * (1 - trait.confidence)   # shrinks as confidence grows
    new_score  = alpha * signal + (1 - alpha) * current_score
    new_conf   = min(current_confidence + confidence_delta, 1.0)

- When ``confidence → 0`` (trait is barely known), alpha → BASE_ALPHA ≈ 0.7,
  so new evidence dominates.
- When ``confidence → 1`` (trait is well-established), alpha → 0, so the
  twin barely moves — it takes extraordinary evidence to shift a mature profile.

Usage
-----
::

    updater = TwinUpdater()
    updated_twin = await updater.update(twin, features_list)
"""

from __future__ import annotations

import logging
from datetime import datetime

from models.event import BehaviorFeatures
from models.twin import ShadowTwin, TraitState

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

#: Base alpha for the EMA.  At zero confidence this is the full update weight.
BASE_ALPHA: float = 0.7

#: Aggregation weight for voting on categorical attributes.
_CATEGORICAL_THRESHOLD: float = 0.5  # majority required


# ---------------------------------------------------------------------------
# TwinUpdater
# ---------------------------------------------------------------------------

class TwinUpdater:
    """
    Updates a ShadowTwin from a batch of BehaviorFeatures.

    All methods are async to keep the interface consistent with the rest of
    the agent pipeline (I/O-bound agents need async; this one is CPU-bound
    but follows the same convention for composability).
    """

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    async def update(
        self,
        twin: ShadowTwin,
        features_list: list[BehaviorFeatures],
        session_id: str = "",
    ) -> ShadowTwin:
        """
        Apply *features_list* to *twin* and return the updated twin.

        Parameters
        ----------
        twin:
            The current ShadowTwin (will not be mutated in place – a copy is
            returned).
        features_list:
            All BehaviorFeatures extracted from the current session.
        session_id:
            Identifier of the current session (stored in the twin).

        Returns
        -------
        ShadowTwin
            Updated twin with new trait scores, confidence levels, and
            aggregate categorical attributes.
        """
        if not features_list:
            logger.debug("No features to apply – returning twin unchanged.")
            return twin

        # Work on a deep copy to avoid mutating the caller's object
        twin = ShadowTwin.model_validate(twin.model_dump(mode="json"))

        for features in features_list:
            twin = self._apply_features(twin, features)

        # Aggregate categorical attributes via majority vote
        twin.dominant_strategy = self._vote_category(
            [f.strategy for f in features_list]
        )
        twin.risk_profile = self._vote_category(
            [f.risk_level for f in features_list]
        )
        twin.reasoning_style = self._vote_category(
            [f.reasoning_style for f in features_list]
        )

        # Housekeeping
        twin.interaction_count += len(features_list)
        twin.session_id = session_id or twin.session_id
        twin.updated_at = datetime.utcnow()
        twin.compute_overall_confidence()

        logger.info(
            "TwinUpdater: applied %d feature sets. "
            "overall_confidence=%.3f dominant_strategy=%s",
            len(features_list),
            twin.overall_confidence,
            twin.dominant_strategy,
        )
        return twin

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    def _apply_features(
        self,
        twin: ShadowTwin,
        features: BehaviorFeatures,
    ) -> ShadowTwin:
        """Apply one BehaviorFeatures batch to the twin's traits."""
        for trait_name, signal in features.trait_signals.items():
            trait = twin.get_trait(trait_name)
            alpha = self._compute_alpha(trait.confidence)
            new_score = alpha * signal + (1.0 - alpha) * trait.score
            new_confidence = min(
                trait.confidence + features.confidence_delta, 1.0
            )
            twin.traits[trait_name] = TraitState(
                name=trait_name,
                score=round(new_score, 6),
                confidence=round(new_confidence, 6),
                sample_count=trait.sample_count + 1,
                last_updated=datetime.utcnow(),
            )
        return twin

    @staticmethod
    def _compute_alpha(confidence: float) -> float:
        """
        Compute the EMA learning rate for a given confidence level.

        - ``confidence = 0.0``  →  ``alpha = BASE_ALPHA`` (trusts new data)
        - ``confidence = 1.0``  →  ``alpha = 0.0``        (ignores new data)
        """
        alpha = BASE_ALPHA * (1.0 - confidence)
        return round(alpha, 6)

    @staticmethod
    def _vote_category(values: list[str]) -> str:
        """
        Simple majority-vote aggregator for categorical attributes.

        Parameters
        ----------
        values:
            A list of category labels, one per feature set.

        Returns
        -------
        str
            The most frequently occurring label.  Ties are broken by the
            first occurrence in the list.
        """
        if not values:
            return "unknown"
        counts: dict[str, int] = {}
        for v in values:
            counts[v] = counts.get(v, 0) + 1
        return max(counts, key=lambda k: counts[k])
