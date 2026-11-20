"""Turn a survey into an urgency, a category, and a service match.

Free text goes through `call_model` first. With no API key, or if the model
response is unusable, a small word list decides. Preset options are used only
when the neighbor did not write anything.
"""

from __future__ import annotations

import json
import logging
import re

import httpx
from pydantic import ValidationError

try:
    from src.server.catalog import service_for
    from src.server.core.config import settings
    from src.server.core.prompts import INTAKE_TRIAGE_PROMPT
    from src.server.intake_schema import (
        ServiceCategory,
        SurveyRequest,
        TriageResult,
        UrgencyLevel,
    )
except ModuleNotFoundError:
    from catalog import service_for
    from core.config import settings
    from core.prompts import INTAKE_TRIAGE_PROMPT
    from intake_schema import ServiceCategory, SurveyRequest, TriageResult, UrgencyLevel

logger = logging.getLogger("comforce.triage")

_OPTION_CATEGORY = {
    "food": ServiceCategory.food,
    "hungry": ServiceCategory.food,
    "groceries": ServiceCategory.food,
    "pantry": ServiceCategory.food,
    "ride": ServiceCategory.ride,
    "transportation": ServiceCategory.ride,
    "shelter": ServiceCategory.shelter,
    "safe_place": ServiceCategory.shelter,
    "safe place": ServiceCategory.shelter,
    "safety": ServiceCategory.shelter,
    "warmth": ServiceCategory.warmth,
    "warm": ServiceCategory.warmth,
    "warm_lobby": ServiceCategory.warmth,
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


def _key(option: str) -> str:
    return option.strip().lower().replace("-", " ").replace("_", " ")


def category_from_options(options: list[str]) -> ServiceCategory:
    for option in options:
        found = _OPTION_CATEGORY.get(_key(option))
        if found is not None and found is not ServiceCategory.other:
            return found
    for option in options:
        if _OPTION_CATEGORY.get(_key(option)) is ServiceCategory.other:
            return ServiceCategory.other
    return ServiceCategory.other


def urgency_from_options(options: list[str]) -> UrgencyLevel:
    keys = {_key(option) for option in options}
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


def _load_json_object(raw: str) -> dict | None:
    cleaned = raw.strip()
    if cleaned.startswith("```json"):
        cleaned = cleaned[7:]
    elif cleaned.startswith("```"):
        cleaned = cleaned[3:]
    cleaned = cleaned.removesuffix("```")
    try:
        payload = json.loads(cleaned.strip())
    except json.JSONDecodeError:
        logger.warning("Triage model returned invalid JSON")
        return None
    if not isinstance(payload, dict):
        return None
    return payload


def _validated(payload: dict | None) -> TriageResult | None:
    if payload is None:
        return None
    try:
        result = TriageResult.model_validate(payload)
    except ValidationError:
        logger.warning("Triage model JSON failed validation")
        return None
    if result.suggested_service_id is None:
        result = result.model_copy(
            update={"suggested_service_id": service_for(result.category).id}
        )
    return result


def _post_json(url: str, headers: dict[str, str], body: dict) -> dict | None:
    try:
        response = httpx.post(url, headers=headers, json=body, timeout=10.0)
        response.raise_for_status()
        return response.json()
    except (httpx.HTTPError, ValueError):
        logger.warning("Triage model request failed")
        return None


def call_model(free_text: str, options: list[str]) -> TriageResult | None:
    """Ask the configured model. Returns None when no key is set or the call fails."""
    user = json.dumps({"free_text": free_text, "selected_options": options})
    if settings.OPENAI_API_KEY:
        payload = _post_json(
            "https://api.openai.com/v1/chat/completions",
            {"Authorization": f"Bearer {settings.OPENAI_API_KEY}"},
            {
                "model": "gpt-4o-mini",
                "temperature": 0,
                "response_format": {"type": "json_object"},
                "messages": [
                    {"role": "system", "content": INTAKE_TRIAGE_PROMPT},
                    {"role": "user", "content": user},
                ],
            },
        )
        if payload is None:
            return None
        try:
            content = payload["choices"][0]["message"]["content"]
        except (KeyError, IndexError, TypeError):
            return None
        return _validated(_load_json_object(content))

    if settings.GEMINI_API_KEY:
        payload = _post_json(
            "https://generativelanguage.googleapis.com/v1beta/models/"
            f"gemini-2.0-flash:generateContent?key={settings.GEMINI_API_KEY}",
            {},
            {
                "contents": [
                    {
                        "parts": [
                            {"text": INTAKE_TRIAGE_PROMPT + "\n\n" + user},
                        ]
                    }
                ],
                "generationConfig": {
                    "temperature": 0,
                    "responseMimeType": "application/json",
                },
            },
        )
        if payload is None:
            return None
        try:
            content = payload["candidates"][0]["content"]["parts"][0]["text"]
        except (KeyError, IndexError, TypeError):
            return None
        return _validated(_load_json_object(content))

    return None


def triage_free_text(free_text: str, options: list[str]) -> TriageResult:
    modeled = call_model(free_text, options)
    if modeled is not None:
        return modeled
    category, urgency = rules_from_text(free_text)
    if urgency is UrgencyLevel.this_week:
        urgency = urgency_from_options(options)
    if category is ServiceCategory.other:
        picked = category_from_options(options)
        if picked is not ServiceCategory.other:
            category = picked
    return _finish(category, urgency)


def triage_survey(payload: SurveyRequest) -> TriageResult:
    if payload.free_text:
        return triage_free_text(payload.free_text, payload.selected_options)
    return _finish(
        category_from_options(payload.selected_options),
        urgency_from_options(payload.selected_options),
    )
