"""
agents/planner.py
=================
Adaptive question planner.

Deterministic algorithm – no Gemini call required.  The planner analyses
the current trait-confidence vector and selects the next question from the
pool that will maximally differentiate the *least-known* traits.

Question metadata format
------------------------
Each question in the pool should have this structure:

.. code-block:: python

    {
      "id": "q_001",
      "text": "...",
      "category": "problem_solving",
      "trait_coverage": {
          "analytical": 0.9,
          "systems_thinking": 0.7,
          ...          # only traits strongly covered, rest default to 0
      },
      "difficulty": 1   # 1 = easy, 2 = medium, 3 = hard
    }

Selection logic
---------------
1. Identify the ``n_target`` traits with the lowest confidence scores.
2. Score every un-asked question by how well its ``trait_coverage`` overlaps
   with those low-confidence traits (cosine-style dot product).
3. Return the highest-scoring question ID.

Usage
-----
::

    planner = QuestionPlanner(question_pool=pool)
    next_q = planner.next_question(
        twin=shadow_twin,
        asked_ids={"q_001", "q_002"},
    )
"""

from __future__ import annotations

import logging
from typing import Any

from models.twin import ShadowTwin

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Default question pool
# ---------------------------------------------------------------------------

DEFAULT_QUESTION_POOL: list[dict[str, Any]] = [
    {
        "id": "q_001",
        "text": (
            "Describe the most complex problem you have ever solved. "
            "Walk me through your step-by-step approach."
        ),
        "category": "problem_solving",
        "trait_coverage": {
            "analytical": 0.9,
            "systems_thinking": 0.8,
            "execution": 0.6,
        },
        "difficulty": 2,
    },
    {
        "id": "q_002",
        "text": (
            "You are given a blank slate to build any product. "
            "What is the first thing you do and why?"
        ),
        "category": "creativity",
        "trait_coverage": {
            "creative": 0.9,
            "strategic": 0.7,
            "curiosity": 0.6,
        },
        "difficulty": 2,
    },
    {
        "id": "q_003",
        "text": (
            "Tell me about a time when a project went off track. "
            "What did you do and what was the outcome?"
        ),
        "category": "leadership",
        "trait_coverage": {
            "leadership": 0.85,
            "adaptability": 0.8,
            "execution": 0.5,
        },
        "difficulty": 2,
    },
    {
        "id": "q_004",
        "text": (
            "If you could radically change one industry using technology, "
            "which would you choose and how?"
        ),
        "category": "vision",
        "trait_coverage": {
            "strategic": 0.9,
            "creative": 0.7,
            "systems_thinking": 0.7,
            "curiosity": 0.6,
        },
        "difficulty": 3,
    },
    {
        "id": "q_005",
        "text": (
            "How do you typically react when your carefully laid plan "
            "encounters an unexpected obstacle?"
        ),
        "category": "adaptability",
        "trait_coverage": {
            "adaptability": 0.95,
            "execution": 0.6,
            "leadership": 0.4,
        },
        "difficulty": 1,
    },
    {
        "id": "q_006",
        "text": (
            "What is the most interesting thing you have learned in the last "
            "month, and why did it capture your attention?"
        ),
        "category": "curiosity",
        "trait_coverage": {
            "curiosity": 0.95,
            "analytical": 0.5,
            "creative": 0.4,
        },
        "difficulty": 1,
    },
    {
        "id": "q_007",
        "text": (
            "Describe a situation where you had to persuade a sceptical "
            "audience. What was your strategy?"
        ),
        "category": "leadership",
        "trait_coverage": {
            "leadership": 0.9,
            "strategic": 0.7,
            "analytical": 0.5,
        },
        "difficulty": 2,
    },
    {
        "id": "q_008",
        "text": (
            "You notice a repeated pattern of small failures in a process. "
            "How do you investigate and fix it?"
        ),
        "category": "systems",
        "trait_coverage": {
            "systems_thinking": 0.95,
            "analytical": 0.8,
            "execution": 0.6,
        },
        "difficulty": 2,
    },
    {
        "id": "q_009",
        "text": (
            "How do you decide when to keep pushing on an idea versus "
            "abandoning it for something better?"
        ),
        "category": "decision_making",
        "trait_coverage": {
            "strategic": 0.8,
            "analytical": 0.7,
            "adaptability": 0.6,
        },
        "difficulty": 2,
    },
    {
        "id": "q_010",
        "text": (
            "Walk me through how you would build a team from scratch for a "
            "high-stakes, ambiguous mission."
        ),
        "category": "leadership",
        "trait_coverage": {
            "leadership": 0.95,
            "strategic": 0.7,
            "systems_thinking": 0.5,
        },
        "difficulty": 3,
    },
]


# ---------------------------------------------------------------------------
# QuestionPlanner
# ---------------------------------------------------------------------------

class QuestionPlanner:
    """
    Selects the optimal next question to maximise information gain about
    the user's cognitive profile.

    Parameters
    ----------
    question_pool:
        List of question metadata dicts.  Defaults to ``DEFAULT_QUESTION_POOL``.
    n_target_traits:
        Number of lowest-confidence traits to focus on.
    """

    def __init__(
        self,
        question_pool: list[dict[str, Any]] | None = None,
        n_target_traits: int = 3,
    ) -> None:
        self.pool = question_pool or DEFAULT_QUESTION_POOL
        self.n_target_traits = n_target_traits

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def next_question(
        self,
        twin: ShadowTwin,
        asked_ids: set[str] | None = None,
    ) -> dict[str, Any] | None:
        """
        Return the next question to ask.

        Parameters
        ----------
        twin:
            Current ShadowTwin used to read trait confidence scores.
        asked_ids:
            Set of question IDs already asked in this session (will be
            excluded from candidates).

        Returns
        -------
        dict or None
            The full question metadata dict, or ``None`` if the pool is
            exhausted.
        """
        asked_ids = asked_ids or set()
        candidates = [q for q in self.pool if q["id"] not in asked_ids]

        if not candidates:
            logger.info("QuestionPlanner: pool exhausted.")
            return None

        # Find the traits with the lowest confidence
        low_traits = self._lowest_confidence_traits(twin)
        logger.debug("QuestionPlanner: target traits = %s", low_traits)

        # Score candidates
        scored = [
            (self._score_question(q, low_traits), q)
            for q in candidates
        ]
        scored.sort(key=lambda x: x[0], reverse=True)

        best_score, best_q = scored[0]
        logger.info(
            "QuestionPlanner: selected q_id=%s score=%.3f",
            best_q["id"],
            best_score,
        )
        return best_q

    def get_question_by_id(self, question_id: str) -> dict[str, Any] | None:
        """Return a question from the pool by ID, or None if not found."""
        for q in self.pool:
            if q["id"] == question_id:
                return q
        return None

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    def _lowest_confidence_traits(self, twin: ShadowTwin) -> dict[str, float]:
        """
        Return the ``n_target_traits`` traits with the lowest confidence.

        Returns a dict mapping trait_name → current_confidence for the
        chosen traits.
        """
        sorted_traits = sorted(
            twin.traits.items(),
            key=lambda item: item[1].confidence,
        )
        target = sorted_traits[: self.n_target_traits]
        return {name: state.confidence for name, state in target}

    @staticmethod
    def _score_question(
        question: dict[str, Any],
        target_traits: dict[str, float],
    ) -> float:
        """
        Score a question by how well it covers the target low-confidence
        traits.

        Score = Σ  trait_coverage[t] × (1 - confidence[t])
                ∀t ∈ target_traits

        The ``(1 - confidence)`` factor gives extra weight to traits we
        know the least about.
        """
        coverage: dict[str, float] = question.get("trait_coverage", {})
        score = 0.0
        for trait, confidence in target_traits.items():
            coverage_val = coverage.get(trait, 0.0)
            score += coverage_val * (1.0 - confidence)
        return score
