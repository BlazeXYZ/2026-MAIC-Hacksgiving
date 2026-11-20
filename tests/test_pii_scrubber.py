"""Tests for the PII detection and scrubber engine."""

import sys
from pathlib import Path

# Ensure repository root is on sys.path
REPO_ROOT = Path(__file__).resolve().parent.parent
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from src.server.ai.pii import (
    REDACTION_PLACEHOLDER,
    PIIMatch,
    find_pii,
    scrub_pii,
    scrub_ticket,
)


def _kinds(text):
    return [m.kind for m in find_pii(text)]


def test_redaction_placeholder_exact():
    assert (
        REDACTION_PLACEHOLDER
        == "[REDACTED FOR PRIVACY - ACCESSIBLE BY COMFORCE COORDINATOR]"
    )


def test_phone_parenthesized():
    text = "Call me at (414) 555-1234 after 5pm"
    matches = find_pii(text)
    assert len(matches) == 1
    assert matches[0].kind == "phone"
    assert matches[0].value == "(414) 555-1234"
    assert text[matches[0].start : matches[0].end] == matches[0].value


def test_phone_dashed():
    text = "My number is 414-555-1234."
    matches = find_pii(text)
    assert len(matches) == 1
    assert matches[0].kind == "phone"
    assert matches[0].value == "414-555-1234"


def test_phone_dotted():
    text = "Reach me at 414.555.1234"
    matches = find_pii(text)
    assert len(matches) == 1
    assert matches[0].kind == "phone"
    assert matches[0].value == "414.555.1234"


def test_phone_spaced():
    text = "Call 414 555 1234 please"
    matches = find_pii(text)
    assert len(matches) == 1
    assert matches[0].kind == "phone"
    assert matches[0].value == "414 555 1234"


def test_phone_country_code():
    text = "International: +1 414-555-1234"
    matches = find_pii(text)
    assert len(matches) == 1
    assert matches[0].kind == "phone"
    assert matches[0].value == "+1 414-555-1234"


def test_email_detected():
    text = "Email jane.doe+tag@example-mail.com for details"
    matches = find_pii(text)
    assert len(matches) == 1
    assert matches[0].kind == "email"
    assert matches[0].value == "jane.doe+tag@example-mail.com"
    assert text[matches[0].start : matches[0].end] == matches[0].value


def test_ssn_detected():
    text = "My SSN is 123-45-6789, thanks"
    matches = find_pii(text)
    assert len(matches) == 1
    assert matches[0].kind == "ssn"
    assert matches[0].value == "123-45-6789"


def test_ssn_not_a_date():
    text = "Date of birth: 12-25-1990"
    assert find_pii(text) == []


def test_street_address_with_suffix():
    text = "I live at 1234 North Oakland Road"
    matches = find_pii(text)
    assert len(matches) == 1
    assert matches[0].kind == "street_address"
    assert matches[0].value == "1234 North Oakland Road"


def test_street_address_short_suffix_with_unit():
    text = "Ship it to 456 W Wisconsin Ave, Apt 3B"
    matches = find_pii(text)
    assert len(matches) == 1
    assert matches[0].kind == "street_address"
    assert matches[0].value == "456 W Wisconsin Ave, Apt 3B"


def test_street_address_ste_unit():
    text = "Office: 789 N Milwaukee St. Ste 200"
    matches = find_pii(text)
    assert len(matches) == 1
    assert matches[0].kind == "street_address"
    assert matches[0].value == "789 N Milwaukee St. Ste 200"


def test_combined_text_all_kinds():
    text = (
        "Contact me: (414) 555-1234 or john.smith@example.com. "
        "My SSN is 123-45-6789 and I live at 1234 North Oakland Road."
    )
    matches = find_pii(text)
    kinds = [m.kind for m in matches]
    assert kinds == ["phone", "email", "ssn", "street_address"]
    for m in matches:
        assert text[m.start : m.end] == m.value
    cleaned = scrub_pii(text)
    assert REDACTION_PLACEHOLDER not in text
    assert cleaned.count(REDACTION_PLACEHOLDER) == 4
    assert "john.smith@example.com" not in cleaned
    assert "123-45-6789" not in cleaned
    assert "(414) 555-1234" not in cleaned
    assert "1234 North Oakland Road" not in cleaned


def test_placeholder_count_equals_match_count():
    text = (
        "Phones: 414-555-1234 and +1 414 555 1234, email a@b.co, "
        "ssn 123-45-6789, addr 456 W Wisconsin Ave Apt 3B."
    )
    matches = find_pii(text)
    assert len(matches) == 5
    cleaned = scrub_pii(text)
    assert cleaned.count(REDACTION_PLACEHOLDER) == len(matches)


def test_no_pii_text_unchanged():
    text = "The community garden needs volunteers on Saturday morning."
    assert scrub_pii(text) == text
    assert find_pii(text) == []


def test_offsets_are_correct():
    text = "x 414-555-1234 y john@example.com z"
    matches = find_pii(text)
    assert [m.kind for m in matches] == ["phone", "email"]
    for m in matches:
        assert text[m.start : m.end] == m.value


def test_find_pii_sorted_by_start():
    text = "email john@example.com then phone 414-555-1234"
    matches = find_pii(text)
    starts = [m.start for m in matches]
    assert starts == sorted(starts)


def test_scrub_ticket_returns_new_dict_no_mutation():
    ticket = {
        "id": 7,
        "subject": "Reach me at 414-555-1234",
        "description": "Email jane@example.com, SSN 123-45-6789",
        "status": "open",
    }
    snapshot = dict(ticket)
    scrubbed = scrub_ticket(ticket)
    assert scrubbed is not ticket
    assert ticket == snapshot  # input untouched
    assert scrubbed["subject"] == ("Reach me at " + REDACTION_PLACEHOLDER)
    assert REDACTION_PLACEHOLDER in scrubbed["description"]
    assert scrubbed["status"] == "open"
    assert scrubbed["id"] == 7
    assert scrubbed["pii_redacted"] is True
    assert scrubbed["original_retained_by"] == "coordinator"


def test_scrub_ticket_without_pii():
    ticket = {"id": 3, "subject": "Garden cleanup", "description": None}
    scrubbed = scrub_ticket(ticket)
    assert scrubbed["subject"] == "Garden cleanup"
    assert scrubbed["pii_redacted"] is False
    assert scrubbed["original_retained_by"] == "coordinator"


def test_empty_and_unicode_input_never_raises():
    assert find_pii("") == []
    assert scrub_pii("") == ""
    unicode_text = "名前は田中です 📞 (414) 555-1234 ありがとう"
    matches = find_pii(unicode_text)
    assert len(matches) == 1
    assert matches[0].kind == "phone"
    cleaned = scrub_pii(unicode_text)
    assert REDACTION_PLACEHOLDER in cleaned
    assert "📞" in cleaned


def test_pii_match_dataclass_is_frozen():
    m = PIIMatch(kind="ssn", start=0, end=11, value="123-45-6789")
    try:
        m.start = 5  # type: ignore[misc]
        frozen = False
    except AttributeError:
        frozen = True
    assert frozen
