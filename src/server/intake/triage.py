"""Turn a survey into an urgency, a category, and a service match.

Free text is scrubbed, then sent through the async triage client. With no
API key, or if that call fails, a small word list decides. Preset options
are used only when the neighbor did not write anything.
"""

from __future__ import annotations

import logging
import re

from src.server.ai.client import TriageLLMClient
from src.server.ai.pii import scrub_pii
from src.server.intake.schema import (
    ServiceCategory,
    SurveyRequest,
    TriageResult,
    UrgencyLevel,
)
from src.server.intake.services import service_for

logger = logging.getLogger("comforce.triage")

_OPTION_CATEGORY = {
    "food": ServiceCategory.food,
    "hungry": ServiceCategory.food,
    "groceries": ServiceCategory.food,
    "pantry": ServiceCategory.food,
    "ride": ServiceCategory.ride,
    "transportation": ServiceCategory.ride,
    "shelter": ServiceCategory.shelter,
    "safe place": ServiceCategory.shelter,
    "safety": ServiceCategory.shelter,
    "warmth": ServiceCategory.warmth,
    "warm": ServiceCategory.warmth,
    "warm lobby": ServiceCategory.warmth,
    "support": ServiceCategory.support,
    "talk": ServiceCategory.support,
    "other": ServiceCategory.other,
}

_CATEGORY_WORDS: tuple[tuple[ServiceCategory, tuple[str, ...]], ...] = (
    (ServiceCategory.support, ("abuse", "scared", "unsafe", "anxious", "talk")),
    (ServiceCategory.shelter, ("shelter", "homeless", "nowhere")),
    (ServiceCategory.warmth, ("cold", "freezing", "warm")),
    (ServiceCategory.food, ("food", "hungry", "pantry", "grocer", "eat")),
    (ServiceCategory.ride, ("ride", "bus", "drive", "pickup")),
)

_URGENT_WORDS = ("urgent", "now", "tonight", "emergency", "immediately", "asap")
_TODAY_WORDS = ("today", "afternoon", "morning")

_SUMMARY_NEED = {
    ServiceCategory.food: "food",
    ServiceCategory.ride: "a ride",
    ServiceCategory.shelter: "a safe place to stay",
    ServiceCategory.warmth: "somewhere warm",
    ServiceCategory.support: "someone to talk to",
    ServiceCategory.other: "help sorting out the next step",
}
_SUMMARY_WHEN = {
    UrgencyLevel.urgent: "Urgent",
    UrgencyLevel.today: "Today",
    UrgencyLevel.this_week: "This week",
}


def _normalize_option(option: str) -> str:
    return option.strip().lower().replace("-", " ").replace("_", " ")


def category_from_options(options: list[str]) -> ServiceCategory:
    for option in options:
        found = _OPTION_CATEGORY.get(_normalize_option(option))
        if found is not None and found is not ServiceCategory.other:
            return found
    for option in options:
        if _OPTION_CATEGORY.get(_normalize_option(option)) is ServiceCategory.other:
            return ServiceCategory.other
    return ServiceCategory.other


def urgency_from_options(options: list[str]) -> UrgencyLevel:
    keys = {_normalize_option(option) for option in options}
    if "urgent" in keys:
        return UrgencyLevel.urgent
    if "today" in keys:
        return UrgencyLevel.today
    if "this week" in keys:
        return UrgencyLevel.this_week
    return UrgencyLevel.this_week


def _contains_word(text: str, word: str) -> bool:
    return re.search(rf"\b{re.escape(word)}\b", text) is not None


def _summary(category: ServiceCategory, urgency: UrgencyLevel) -> str:
    when = _SUMMARY_WHEN[urgency]
    need = _SUMMARY_NEED[category]
    return f"{when}: you need {need}."


def _finish(category: ServiceCategory, urgency: UrgencyLevel) -> TriageResult:
    return TriageResult(
        urgency=urgency,
        category=category,
        summary=_summary(category, urgency),
        suggested_service_id=service_for(category).id,
    )


def rules_from_text(free_text: str) -> tuple[ServiceCategory, UrgencyLevel]:
    text = free_text.lower()
    category = ServiceCategory.other
    for candidate, words in _CATEGORY_WORDS:
        if any(_contains_word(text, word) for word in words):
            category = candidate
            break
    if any(_contains_word(text, word) for word in _URGENT_WORDS):
        urgency = UrgencyLevel.urgent
    elif any(_contains_word(text, word) for word in _TODAY_WORDS):
        urgency = UrgencyLevel.today
    else:
        urgency = UrgencyLevel.this_week
    return category, urgency


def _label(value: object) -> str:
    raw = getattr(value, "value", value)
    return str(raw)


async def _ask_model(cleaned_text: str) -> TriageResult | None:
    """Call the shared async client. The text is already scrubbed."""
    try:
        output = await TriageLLMClient().triage(cleaned_text)
    except Exception:  # noqa: BLE001 — keyword rules are the fallback
        logger.warning("Intake triage model call failed")
        return None
    try:
        category = ServiceCategory(_label(output.category))
        urgency = UrgencyLevel(_label(output.urgency))
    except ValueError:
        logger.warning("Intake triage model returned an unknown label")
        return None
    summary = scrub_pii((output.explanation or "").strip())
    if not summary:
        summary = _summary(category, urgency)
    return TriageResult(
        urgency=urgency,
        category=category,
        summary=summary[:400],
        suggested_service_id=service_for(category).id,
    )


async def triage_survey(payload: SurveyRequest) -> TriageResult:
    if not payload.free_text:
        return _finish(
            category_from_options(payload.selected_options),
            urgency_from_options(payload.selected_options),
        )
    cleaned = scrub_pii(payload.free_text)
    modeled = await _ask_model(cleaned)
    if modeled is not None:
        return modeled
    category, urgency = rules_from_text(cleaned)
    if urgency is UrgencyLevel.this_week:
        urgency = urgency_from_options(payload.selected_options)
    if category is ServiceCategory.other:
        picked = category_from_options(payload.selected_options)
        if picked is not ServiceCategory.other:
            category = picked
    return _finish(category, urgency)
