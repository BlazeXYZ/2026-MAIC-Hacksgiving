"""What keeps a post off the public thread, and the canned answers."""

from __future__ import annotations

import re

from src.server.ai.moderation import CRISIS_KEYWORDS, moderate
from src.server.ai.pii import find_pii

HubId = str

HUB_IDS: tuple[HubId, ...] = ("domestic-safety", "missing-persons", "food-pantry")

COMFORCE_HOTLINE = "414-395-0552"

# Phrases that give a home away even when the number is left off.
_LIVE_AT = re.compile(
    r"\b(i live at|my address is|come to my (?:house|home|door|apartment)"
    r"|drop (?:it |food |this |them )?(?:off )?at my (?:house|home|door|apartment))\b",
    re.IGNORECASE,
)

_CRISIS = re.compile(
    r"\b(" + "|".join(re.escape(k) for k in CRISIS_KEYWORDS) + r")\b",
    re.IGNORECASE,
)

_PII_REASONS: dict[str, str] = {
    "street_address": (
        "It included a home address. Take the address out and post again, "
        "or ask a coordinator to make a private request."
    ),
    "phone": "It included a phone number. Share that with ComForce, not the hub. Take the number out and post again.",
    "email": "It included an email address. Take it out and post again. A coordinator can pass it along privately.",
    "ssn": "It included what looks like a Social Security number. Never post that. Take it out and post again.",
}

MODERATION_REASON = (
    "A coordinator will read it before it goes up, to keep the hub safe for everyone."
)

_FOOD_ANSWER = (
    "Open pantries are on the Map tab with an open-now filter. A coordinator can turn this into a "
    "private request so your address never goes on the thread."
)
_SEARCH_ANSWER = (
    "Check the pinned post and the Search grid before you head out. Claim an open sector, check in "
    "at the rally point, and do not search alone on your first night. Send tips to a coordinator, "
    "not the thread."
)
_SAFETY_ANSWER = (
    f"ComForce answers 24/7 at {COMFORCE_HOTLINE}, and Sojourner Family Peace Center has a 24/7 line "
    "too. You do not need to say where you are. In danger right now, call 911."
)

_ANSWERS: tuple[tuple[HubId, tuple[str, ...], str], ...] = (
    (
        "food-pantry",
        ("formula", "diaper", "pantry", "hungry", "grocer", "food", "bread"),
        _FOOD_ANSWER,
    ),
    (
        "missing-persons",
        ("sector", "search", "missing", "rally", "tip", "help look", "volunteer"),
        _SEARCH_ANSWER,
    ),
    (
        "domestic-safety",
        ("line", "call", "safe", "exit", "sojourner", "staffed", "talk", "leave"),
        _SAFETY_ANSWER,
    ),
)

CRISIS_ANSWER = (
    f"You do not have to handle this alone. ComForce answers 24/7 at {COMFORCE_HOTLINE}. "
    "If you are in danger right now, call 911. You can also use Ask for help to reach a real person "
    "without posting where you are."
)


def hold_reason(text: str) -> str | None:
    """Why `text` should stay off the public thread, or None if it can go up."""
    if _LIVE_AT.search(text):
        return _PII_REASONS["street_address"]
    found = find_pii(text)
    if found:
        return _PII_REASONS.get(found[0].kind, _PII_REASONS["street_address"])
    if moderate(text).needs_review:
        return MODERATION_REASON
    return None


def automatic_answer(hub_id: HubId, text: str) -> str | None:
    """A canned answer for crisis wording or a common question, else None."""
    if _CRISIS.search(text):
        return CRISIS_ANSWER
    if "?" not in text:
        return None
    for hub, words, answer in _ANSWERS:
        if hub == hub_id and any(
            re.search(rf"\b{re.escape(word)}", text, re.IGNORECASE) for word in words
        ):
            return answer
    return None
