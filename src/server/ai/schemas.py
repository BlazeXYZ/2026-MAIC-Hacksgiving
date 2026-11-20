"""Canonical schemas for AI-assisted intake triage.

Other modules (parser, confirmation, moderation, etc.) import these
definitions; do not rename fields without updating all consumers.
"""

from enum import Enum

from pydantic import BaseModel


class TriageCategory(str, Enum):
    """Primary need category extracted from a resident's free-text request."""

    FOOD = "food"
    RIDE = "ride"
    SHELTER = "shelter"
    WARMTH = "warmth"
    SUPPORT = "support"
    OTHER = "other"


class UrgencyTier(str, Enum):
    """How quickly the resident's need must be addressed."""

    URGENT = "urgent"
    TODAY = "today"
    THIS_WEEK = "this_week"


class TriageOutputSchema(BaseModel):
    """Structured output contract for the intake triage LLM call."""

    category: TriageCategory
    urgency: UrgencyTier
    escalate: bool = False
    explanation: str = ""
    clarifying_question: str | None = None
