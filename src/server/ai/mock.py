"""Deterministic offline mock triage engine.

Used when no live AI provider keys are configured (or when mock mode is
explicitly requested) so the rest of the pipeline can be developed and
demoed without network access. The heuristic classifier is intentionally
simple and fully deterministic: identical input always yields identical
output.
"""

from __future__ import annotations

import asyncio
import re

from src.server.ai.schemas import TriageOutputSchema

MOCK_LATENCY_SECONDS = 0.25


def mock_mode_active(
    gemini_key: str | None,
    openai_key: str | None,
    ai_mock_mode: bool = False,
) -> bool:
    """Return True when the mock engine should be used.

    Active when explicitly requested, or when both provider keys are
    missing/empty.
    """
    if ai_mock_mode:
        return True
    gemini_missing = not gemini_key or not gemini_key.strip()
    openai_missing = not openai_key or not openai_key.strip()
    return gemini_missing and openai_missing


# Keyword tables, checked in priority order. Safety/escalation concerns
# always win; then shelter and ride (where a location/transport keyword
# outranks a resource keyword like "pantry"); then food; then warmth.
_SUPPORT_KEYWORDS = (
    "threatening",
    "threaten",
    "unsafe",
    "scared",
    "scare",
    "afraid",
    "abuse",
    "violent",
    "violence",
    "hurt",
    "harm",
    "suicide",
    "self-harm",
    "assault",
    "domestic",
)
_SHELTER_KEYWORDS = (
    "evicted",
    "eviction",
    "homeless",
    "shelter",
    "place to stay",
    "stay tonight",
    "sleeping in",
    "slept in",
    "kicked out",
    "no place to live",
    "housing",
)
_RIDE_KEYWORDS = (
    "ride",
    "bus",
    "drive",
    "lift",
    "transportation",
    "transport",
    "uber",
    "lyft",
)
_FOOD_KEYWORDS = (
    "food",
    "meal",
    "groceries",
    "grocery",
    "pantry",
    "dinner",
    "hungry",
    "cook",
    "eat",
    "snack",
    "breakfast",
    "lunch",
)
_WARMTH_KEYWORDS = (
    "no heat",
    "freezing",
    "freeze",
    "frozen",
    "cold",
    "coat",
    "jacket",
    "blanket",
    "heater",
    "warm",
    "hypotherm",
)


# Category keywords are matched on word boundaries so "heat" does not
# false-positive on "eat"; multi-word phrases are unaffected.
def _compile_patterns(keywords: tuple[str, ...]) -> tuple[re.Pattern[str], ...]:
    return tuple(re.compile(rf"\b{re.escape(keyword)}\b") for keyword in keywords)


_SUPPORT_PATTERNS = _compile_patterns(_SUPPORT_KEYWORDS)
_SHELTER_PATTERNS = _compile_patterns(_SHELTER_KEYWORDS)
_RIDE_PATTERNS = _compile_patterns(_RIDE_KEYWORDS)
_FOOD_PATTERNS = _compile_patterns(_FOOD_KEYWORDS)
_WARMTH_PATTERNS = _compile_patterns(_WARMTH_KEYWORDS)

# Time-marker phrases. Urgent markers override everything except the
# explicit this_week markers, which postpone non-safety needs.
_URGENT_MARKERS = (
    "right now",
    "immediately",
    "emergency",
    "urgent",
    "freezing",
    "no heat",
    "asap",
    "danger",
)
_THIS_WEEK_MARKERS = (
    "tomorrow",
    "saturday",
    "sunday",
    "monday",
    "tuesday",
    "wednesday",
    "thursday",
    "friday",
    "next week",
    "this week",
    "later this week",
)
_TODAY_MARKERS = (
    "today",
    "tonight",
    "this evening",
)

_CATEGORY_DEFAULT_URGENCY = {
    "support": "urgent",
    "shelter": "urgent",
    "warmth": "this_week",
    "food": "today",
    "ride": "this_week",
    "other": "today",
}

_EXPLANATIONS = {
    "support": (
        "This sounds like a safety or emotional-support concern, so it was "
        "flagged as urgent for follow-up."
    ),
    "shelter": ("The request describes a housing or safe-place-to-stay need."),
    "ride": (
        "The request is about getting transportation to an appointment or destination."
    ),
    "food": ("The request is about getting food or groceries."),
    "warmth": ("The request is about staying warm, such as heat or warm clothing."),
    "other": (
        "The request did not clearly match a specific need, so more detail is required."
    ),
}

_CLARIFYING_QUESTION = (
    "Could you share a bit more about what kind of help you need right now?"
)


class MockTriageEngine:
    """Deterministic keyword-based stand-in for the live AI triage call."""

    async def triage(self, text: str) -> TriageOutputSchema:
        """Classify *text* into a :class:`TriageOutputSchema`.

        Awaits :data:`MOCK_LATENCY_SECONDS` to mimic realistic provider
        latency (keeps UI loading states honest) before running the
        heuristic classifier.
        """
        await asyncio.sleep(MOCK_LATENCY_SECONDS)
        return self._classify(text)

    def _classify(self, text: str) -> TriageOutputSchema:
        normalized = " ".join(text.lower().split())
        category = self._detect_category(normalized)
        urgency = self._detect_urgency(normalized, category)
        escalate = category == "support"
        return TriageOutputSchema(
            category=category,
            urgency=urgency,
            escalate=escalate,
            explanation=_EXPLANATIONS[category],
            clarifying_question=_CLARIFYING_QUESTION if category == "other" else None,
        )

    @staticmethod
    def _detect_category(normalized: str) -> str:
        for category, patterns in (
            ("support", _SUPPORT_PATTERNS),
            ("shelter", _SHELTER_PATTERNS),
            ("ride", _RIDE_PATTERNS),
            ("food", _FOOD_PATTERNS),
            ("warmth", _WARMTH_PATTERNS),
        ):
            if any(pattern.search(normalized) for pattern in patterns):
                return category
        return "other"

    @staticmethod
    def _detect_urgency(normalized: str, category: str) -> str:
        if category == "support":
            return "urgent"
        if category == "other":
            # Unrecognized/injected input is never upgraded by urgency
            # words embedded in the text itself.
            return "today"
        if category == "shelter":
            # Shelter stays urgent unless the user explicitly references a
            # later day; "tonight" must not downgrade a roof-over-head need.
            if any(marker in normalized for marker in _THIS_WEEK_MARKERS):
                return "this_week"
            return "urgent"
        if any(marker in normalized for marker in _URGENT_MARKERS):
            return "urgent"
        if any(marker in normalized for marker in _THIS_WEEK_MARKERS):
            return "this_week"
        if any(marker in normalized for marker in _TODAY_MARKERS):
            return "today"
        return _CATEGORY_DEFAULT_URGENCY[category]
