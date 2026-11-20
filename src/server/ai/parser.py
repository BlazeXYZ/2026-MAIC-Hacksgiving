"""Robust structured-JSON output parser for triage responses.

Parses LLM output into a validated :class:`TriageOutputSchema`. Handles
fenced code blocks, prose-embedded JSON, and malformed responses. Any
failure falls back to a deterministic keyword classifier so callers never
receive an exception and always get a valid schema.

Schema contract (``src.server.ai.schemas``) is introduced by PR #33; this
module imports it and merges after #33.
"""

from __future__ import annotations

import json
import re

from src.server.ai.schemas import TriageCategory, TriageOutputSchema, UrgencyTier

_FENCE_RE = re.compile(r"^```(?:json)?\s*\n(.*?)\n?\s*```\s*$", re.DOTALL)

_ESCALATE_KEYWORDS = (
    "domestic",
    "violence",
    "threat",
    "unsafe",
    "scared at home",
)
_FOOD_KEYWORDS = ("food", "pantry", "hungry", "meal", "groceries")
_RIDE_KEYWORDS = ("ride", "bus", "clinic", "appointment", "drive")
_RIDE_TODAY_KEYWORDS = ("today", "now", "interview")
_SHELTER_KEYWORDS = ("shelter", "evicted", "stay", "sleep")
_WARMTH_KEYWORDS = ("cold", "heat", "warm", "coat", "blanket")


def _match_brace(text: str, start: int) -> int | None:
    """Return index just past the JSON object matching ``{`` at ``start``."""
    depth = 0
    in_string = False
    escaped = False
    for i in range(start, len(text)):
        ch = text[i]
        if in_string:
            if escaped:
                escaped = False
            elif ch == "\\":
                escaped = True
            elif ch == '"':
                in_string = False
            continue
        if ch == '"':
            in_string = True
        elif ch == "{":
            depth += 1
        elif ch == "}":
            depth -= 1
            if depth == 0:
                return i + 1
    return None


def extract_json(raw: str) -> dict | None:
    """Extract the first JSON object from ``raw``, or return ``None``.

    Accepts ```json fenced blocks, bare fences, a raw JSON object, or JSON
    embedded in surrounding prose (first ``{`` to its matching ``}``).
    """
    if not raw or not raw.strip():
        return None
    text = raw.strip()

    fenced = _FENCE_RE.match(text)
    if fenced:
        text = fenced.group(1).strip()

    start = text.find("{")
    if start == -1:
        return None
    end = _match_brace(text, start)
    if end is None:
        return None
    candidate = text[start:end]
    try:
        parsed = json.loads(candidate)
    except json.JSONDecodeError:
        return None
    return parsed if isinstance(parsed, dict) else None


def _schema_from(category: str, urgency: str, **extra: object) -> TriageOutputSchema:
    return TriageOutputSchema(
        category=TriageCategory(category),
        urgency=UrgencyTier(urgency),
        **extra,  # type: ignore[arg-type]
    )


def fallback_classify(text: str) -> TriageOutputSchema:
    """Rule-based keyword classifier used when JSON parsing/validation fails."""
    lowered = text.lower()

    def has_any(keywords: tuple[str, ...]) -> bool:
        return any(k in lowered for k in keywords)

    if has_any(_ESCALATE_KEYWORDS):
        return _schema_from(
            "support",
            "urgent",
            escalate=True,
            explanation=(
                "Possible safety concern detected; escalating to a human "
                "moderator for immediate support."
            ),
        )
    if has_any(_FOOD_KEYWORDS):
        return _schema_from("food", "today", explanation="Food need detected.")
    if has_any(_RIDE_KEYWORDS):
        urgency = "today" if has_any(_RIDE_TODAY_KEYWORDS) else "this_week"
        return _schema_from(
            "ride", urgency, explanation="Transportation need detected."
        )
    if has_any(_SHELTER_KEYWORDS):
        return _schema_from(
            "shelter", "urgent", explanation="Housing/shelter need detected."
        )
    if has_any(_WARMTH_KEYWORDS):
        return _schema_from("warmth", "today", explanation="Warmth need detected.")
    return TriageOutputSchema(
        category=TriageCategory.OTHER,
        urgency=UrgencyTier.THIS_WEEK,
        clarifying_question=(
            "Thanks for reaching out! Could you tell us a bit more about "
            "what you need help with (food, a ride, shelter, warmth, or "
            "someone to talk to)?"
        ),
    )


def _coerce(data: dict) -> TriageOutputSchema:
    """Validate/coerce ``data`` into TriageOutputSchema; raise on bad input."""
    normalized = dict(data)

    category = normalized.get("category")
    if isinstance(category, str):
        normalized["category"] = category.lower().strip()
    urgency = normalized.get("urgency")
    if isinstance(urgency, str):
        normalized["urgency"] = urgency.lower().strip()

    return TriageOutputSchema.model_validate(normalized)


def parse_triage_output(raw: str) -> TriageOutputSchema:
    """Parse LLM output into a validated TriageOutputSchema.

    Falls back to :func:`fallback_classify` on any extraction or validation
    failure. Never raises.
    """
    try:
        if not isinstance(raw, str) or not raw.strip():
            return fallback_classify("" if raw is None else str(raw))
        data = extract_json(raw)
        if data is None:
            return fallback_classify(raw)
        return _coerce(data)
    except Exception:  # noqa: BLE001 - never raise on malformed LLM output
        return fallback_classify(raw)
