"""Stigma-free natural-language confirmation generator.

Turns a triage result into 1-2 warm, plain-English sentences that read
like a neighbor pointing someone somewhere — the model never scores,
lectures, or diagnoses. Generation is fully deterministic and offline.
"""

from __future__ import annotations

from src.server.ai.schemas import TriageCategory, TriageOutputSchema, UrgencyTier

CATEGORY_PHRASES: dict[TriageCategory, str] = {
    "food": "getting food for you and your family",
    "ride": "a ride to where you need to go",
    "shelter": "a safe place to stay",
    "warmth": "getting somewhere warm",
    "support": "someone to talk to and support you",
    "other": "figuring out what you need",
}

URGENCY_PHRASES: dict[UrgencyTier, str] = {
    "urgent": "as soon as possible, right now",
    "today": "today",
    "this_week": "in the next few days",
}

# Words that must never leak into resident-facing text.
_BANNED_TOKENS = (
    "urgent",
    "escalate",
    "category",
    "triage",
    "json",
    "system prompt",
    "instruction",
)


def _place_phrase(district: str | None, landmark: str | None) -> str:
    parts = [p for p in (district, landmark) if p]
    if not parts:
        return ""
    return " near " + " by ".join(parts)


def generate_confirmation(
    triage: TriageOutputSchema,
    district: str | None = None,
    landmark: str | None = None,
) -> str:
    """Generate a warm, stigma-free confirmation from a triage result.

    1-2 short sentences: a paraphrased need, a friendly time frame, an
    optional location mention, and closing reassurance. If the triage
    result carries a clarifying question, ask that warmly instead.
    Internal vocabulary and the raw explanation are never echoed.
    """
    if triage.clarifying_question:
        return f"Thanks for reaching out. Just so we point you in the right direction: {triage.clarifying_question}"

    need = CATEGORY_PHRASES[triage.category]
    when = URGENCY_PHRASES[triage.urgency]
    where = _place_phrase(district, landmark)

    text = (
        f"Here's what we understood: you need {need}{where}. "
        f"A ComforceMKE neighbor will follow up {when}."
    )

    lowered = text.lower()
    for token in _BANNED_TOKENS:
        if token in lowered:
            raise ValueError(f"confirmation contains banned token: {token}")
    explanation = (triage.explanation or "").lower()
    if explanation and explanation in lowered:
        raise ValueError("confirmation must not echo the explanation text")

    return text
