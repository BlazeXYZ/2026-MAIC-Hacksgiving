"""Mask phone numbers and street addresses before they leave the API."""

from __future__ import annotations

import re

_PHONE = re.compile(r"\b(?:\+?1[\s.\-]?)?(?:\(?\d{3}\)?[\s.\-]?)\d{3}[\s.\-]?\d{4}\b")
_ADDRESS = re.compile(
    r"\b\d{1,5}\s+(?:[NSEW]\.?\s+)?(?:[A-Za-z0-9.'\-]+\s+){0,3}"
    r"(?:st|street|ave|avenue|rd|road|blvd|boulevard|ln|lane|dr|drive|way|ct|court)\b",
    re.IGNORECASE,
)


def scrub(text: str) -> str:
    """Replace phone numbers and street addresses with a fixed placeholder."""
    hidden = _PHONE.sub("[phone hidden]", text)
    return _ADDRESS.sub("[address hidden]", hidden)
