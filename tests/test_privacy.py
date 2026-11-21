"""Tests for privacy utility re-export."""

from __future__ import annotations

from src.server.privacy import scrub, scrub_pii, scrub_ticket


def test_privacy_scrub_re_export() -> None:
    raw = "Call me at 414-555-0199 or visit 123 Main St."
    cleaned = scrub(raw)
    assert "414-555-0199" not in cleaned
    assert "[REDACTED" in cleaned
    assert scrub(raw) == scrub_pii(raw)


def test_privacy_scrub_ticket() -> None:
    ticket = {"phone": "414-555-0199", "notes": "No PII here"}
    scrubbed = scrub_ticket(ticket)
    assert scrubbed["pii_redacted"] is True
    assert "414-555-0199" not in scrubbed["phone"]
