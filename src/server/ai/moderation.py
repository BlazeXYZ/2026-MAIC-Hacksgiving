"""Fast pre-filter content moderation and abuse classifier.

Screens incoming ticket notes for abusive language, threats, harassment,
hate speech, and spam BEFORE tickets appear on the volunteer board.

The classifier FLAGS content for coordinator review; it never silently
drops anything. Crisis/distress keywords (suicide, self-harm, domestic
abuse, etc.) are explicitly NOT classified as abuse — those tickets flow
to the normal triage/escalation path where they can get real help.
"""

import re
from dataclasses import dataclass

__all__ = ["CRISIS_KEYWORDS", "ModerationResult", "moderate"]

# ---------------------------------------------------------------------------
# Crisis / distress keywords — never treated as abuse.
# ---------------------------------------------------------------------------
CRISIS_KEYWORDS: tuple[str, ...] = (
    "suicide",
    "kill myself",
    "hurt myself",
    "hurt me",
    "harm myself",
    "end my life",
    "want to die",
    "domestic violence",
    "domestic abuse",
    "assaulted",
    "not safe at home",
    "unsafe at home",
    "abused at home",
    "self harm",
    "self-harm",
)

_CRISIS_RE = re.compile(
    r"\b(" + "|".join(re.escape(k) for k in CRISIS_KEYWORDS) + r")\b",
    re.IGNORECASE,
)

# ---------------------------------------------------------------------------
# Abuse category patterns. Word lists are intentionally short and generic.
# ---------------------------------------------------------------------------

# Threats: direct statements of intent to harm.
_THREAT_RE = re.compile(
    r"\b("
    r"kill\s+(you|them|him|her|u)\b"
    r"|\bhurt\s+(you|them|him|her|u)\b"
    r"|\bi'?m\s+going\s+to\s+(get|hurt|kill|find)\s+(you|u|them)\b"
    r"|\bgoing\s+to\s+(get|hurt|kill)\s+(you|u|them)\b"
    r"|\bwatch\s+your\s+back\b"
    r"|\bbetter\s+watch\s+(out|your)\b"
    r"|\bcome\s+find\s+(you|u|them)\b"
    r"|\bmake\s+(you|u|them)\s+(pay|regret|suffer)\b"
    r"|\bthreaten"
    r")\b",
    re.IGNORECASE,
)

# Harassment: profanity/slurs directed at a person.
_PROFANITY = (
    "fuck",
    "fucking",
    "bitch",
    "bastard",
    "asshole",
    "dumbass",
    "idiot",
    "moron",
    "loser",
    "shut up",
)
_HARASSMENT_RE = re.compile(
    r"\b(" + "|".join(_PROFANITY) + r")\s+"
    r"(?:\w+\s+){0,3}?(?:you|u|your|him|her|them|they|"
    r"this\s+person|that\s+person|everyone|everybody)\b"
    r"|\b(you|u|your|him|her|them|they)\s+"
    r"(?:\w+\s+){0,3}?(?:" + "|".join(_PROFANITY) + r")\b",
    re.IGNORECASE,
)

# Hate speech: identity-targeted derogatory patterns.
_HATE_SPEECH_RE = re.compile(
    r"\b("
    r"(?:you|they|those|these)\s+\w*\s*(?:niggers?|faggots?|retards?|"
    r"trann(?:y|ies)|spic|wetback|kikes?|chinks?|gooks?)"
    r"|(?:niggers?|faggots?|retards?|trann(?:y|ies)|spics?|wetbacks?"
    r"|kikes?|chinks?|gooks?)\b"
    r")\b",
    re.IGNORECASE,
)

# Spam patterns.
_SPAM_URL_RE = re.compile(
    r"(?:https?://|www\.)[^\s]+", re.IGNORECASE
)
_SPAM_REPEATED_CHAR_RE = re.compile(r"(\w)\1{2,}")
_SPAM_PUNCT_RE = re.compile(r"([!?])\1{2,}")
_SPAM_CAPS_MIN_LEN = 30
_SPAM_CAPS_RATIO = 0.8


@dataclass(frozen=True)
class ModerationResult:
    """Outcome of moderating a single piece of text.

    Attributes:
        needs_review: True when the text matched an abuse category and
            should be flagged for coordinator review.
        matched_categories: Subset of "threat", "harassment",
            "hate_speech", "spam". Empty when ``needs_review`` is False.
        severity: 0.0-1.0 confidence-style score. 0.0 for clean or
            crisis-only text.
    """

    needs_review: bool
    matched_categories: tuple[str, ...]
    severity: float


def _spam_signals(text: str) -> list[float]:
    """Return individual spam signal strengths in [0, 1]."""
    signals: list[float] = []

    # URLs (allow one benign-looking link, penalize multiple / link-heavy).
    urls = _SPAM_URL_RE.findall(text)
    if urls:
        url_chars = sum(len(u) for u in urls)
        ratio = url_chars / max(len(text), 1)
        signals.append(min(1.0, 0.4 + ratio * 2 + 0.3 * (len(urls) - 1)))

    # Repeated characters like "soooo" or "yesss".
    repeats = _SPAM_REPEATED_CHAR_RE.findall(text)
    if repeats:
        signals.append(min(1.0, 0.3 + 0.2 * len(repeats)))

    # Repeated punctuation !!! / ???
    puncts = _SPAM_PUNCT_RE.findall(text)
    if puncts:
        signals.append(min(1.0, 0.3 + 0.25 * len(puncts)))

    # ALL-CAPS ratio.
    letters = [c for c in text if c.isalpha()]
    if len(text) > _SPAM_CAPS_MIN_LEN and letters:
        caps_ratio = sum(c.isupper() for c in letters) / len(letters)
        if caps_ratio > _SPAM_CAPS_RATIO:
            signals.append(1.0)

    return signals


def moderate(text: str) -> ModerationResult:
    """Classify ``text`` for abusive content. Pure; never raises.

    Crisis/distress keywords are never classified as abuse. If both
    crisis and abuse keywords appear, abuse is flagged normally.
    """
    if not isinstance(text, str) or not text.strip():
        return ModerationResult(False, (), 0.0)

    try:
        categories: list[str] = []
        severities: list[float] = []

        if _THREAT_RE.search(text):
            categories.append("threat")
            severities.append(0.9)
        if _HARASSMENT_RE.search(text):
            categories.append("harassment")
            severities.append(0.7)
        if _HATE_SPEECH_RE.search(text):
            categories.append("hate_speech")
            severities.append(0.95)

        spam = _spam_signals(text)
        if spam:
            categories.append("spam")
            severities.append(max(spam) * 0.6)

        if categories:
            severity = min(1.0, max(severities) + 0.05 * (len(categories) - 1))
            return ModerationResult(
                needs_review=True,
                matched_categories=tuple(categories),
                severity=round(severity, 4),
            )

        # No abuse matched. Crisis-only text flows to normal triage.
        return ModerationResult(False, (), 0.0)
    except Exception:  # noqa: BLE001 - contract: must never raise
        return ModerationResult(False, (), 0.0)
