"""PII detection and scrubbing engine for volunteer-facing ticket data.

Detects common PII kinds (phone, email, SSN, street address) in free
text and replaces them with a coordinator-only placeholder so that
scrubbed content can be shown to volunteers without leaking raw PII.
"""

import re
from dataclasses import dataclass

REDACTION_PLACEHOLDER = "[REDACTED FOR PRIVACY - ACCESSIBLE BY COMFORCE COORDINATOR]"


@dataclass(frozen=True)
class PIIMatch:
    """A single detected PII occurrence in text."""

    kind: str  # "phone" | "email" | "ssn" | "street_address"
    start: int
    end: int
    value: str


PATTERNS: dict[str, re.Pattern] = {
    # US phone numbers: (414) 555-1234, 414-555-1234, 414.555.1234,
    # 414 555 1234, +1 414-555-1234. Optional +1/country code, then a
    # 3-digit area code and 3-4 digit local grouping.
    "phone": re.compile(
        r"(?<!\w)"
        r"(?:\+?1[\s.\-]?)?"
        r"(?:\(\d{3}\)|\d{3})[\s.\-]?"
        r"\d{3}[\s.\-]?"
        r"\d{4}"
        r"(?!\w)"
    ),
    # Standard robust email pattern.
    "email": re.compile(
        r"(?<!\w)"
        r"[A-Za-z0-9._%+\-]+"
        r"@"
        r"[A-Za-z0-9.\-]+"
        r"\.[A-Za-z]{2,}"
        r"(?!\w)"
    ),
    # Social Security numbers: 123-45-6789. Word boundaries keep it
    # from matching inside longer digit runs (e.g. dates).
    "ssn": re.compile(r"(?<!\w)\d{3}-\d{2}-\d{4}(?!\w)"),
    # Street addresses: building number + street name + suffix, with
    # optional unit designator (Apt/Unit/Ste/# + alphanumerics).
    "street_address": re.compile(
        r"(?<!\w)"
        r"\d{1,6}\s+"
        r"(?:[A-Z]\.?\s+)?"  # optional direction: N, S, E, W
        r"(?:[A-Z][A-Za-z]*\.?\s+){1,3}"  # street name words
        r"(?:St\.?|Ave\.?|Avenue|Blvd\.?|Rd\.?|Road|Dr\.?|Drive|"
        r"Ln\.?|Lane|Ct\.?|Court|Way)"
        r"(?:,?\s+(?:Apt\.?|Unit|Ste\.?|#)\s*[A-Za-z0-9\-]+)?"
        r"(?!\w)"
    ),
}


def find_pii(text: str) -> list[PIIMatch]:
    """Return all PII matches in *text*, non-overlapping, sorted by start.

    Never raises; tolerant of empty, unicode, or malformed input.
    """
    if not text:
        return []
    matches: list[PIIMatch] = []
    spans: list[tuple[int, int]] = []
    for kind, pattern in PATTERNS.items():
        for match in pattern.finditer(text):
            start, end = match.span()
            if any(not (end <= s or start >= e) for s, e in spans):
                continue  # overlap with an earlier match: keep first
            spans.append((start, end))
            matches.append(
                PIIMatch(kind=kind, start=start, end=end, value=match.group())
            )
    matches.sort(key=lambda m: m.start)
    return matches


def scrub_pii(text: str) -> str:
    """Replace every PII match in *text* with the redaction placeholder."""
    matches = find_pii(text)
    if not matches:
        return text
    parts: list[str] = []
    cursor = 0
    for match in matches:
        parts.append(text[cursor : match.start])
        parts.append(REDACTION_PLACEHOLDER)
        cursor = match.end
    parts.append(text[cursor:])
    return "".join(parts)


def scrub_ticket(ticket: dict) -> dict:
    """Return a NEW dict with PII scrubbed from free-text fields.

    The input dict is never mutated. Adds ``pii_redacted`` and an
    ``original_retained_by`` marker so volunteer-facing views never
    carry raw PII while the coordinator retains the original.
    """
    scrubbed = dict(ticket)
    redacted = False
    for key, value in ticket.items():
        if isinstance(value, str):
            cleaned = scrub_pii(value)
            if cleaned != value:
                redacted = True
                scrubbed[key] = cleaned
    scrubbed["pii_redacted"] = redacted
    scrubbed["original_retained_by"] = "coordinator"
    return scrubbed
