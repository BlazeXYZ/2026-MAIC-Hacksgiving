"""Tests for the triage JSON output parser (src.server.ai.parser)."""

import sys
from pathlib import Path

# Ensure repository root is on sys.path
REPO_ROOT = Path(__file__).resolve().parent.parent
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from src.server.ai.parser import extract_json, fallback_classify, parse_triage_output
from src.server.ai.schemas import (
    TriageCategory,
    TriageOutputSchema,
    UrgencyTier,
)


def test_extract_json_clean_object():
    assert extract_json('{"category": "food"}') == {"category": "food"}


def test_extract_json_fenced_block():
    raw = 'Here is the result:\n```json\n{"category": "ride", "urgency": "today"}\n```\nDone.'
    assert extract_json(raw) == {"category": "ride", "urgency": "today"}


def test_extract_json_bare_fence():
    raw = '```\n{"category": "warmth"}\n```'
    assert extract_json(raw) == {"category": "warmth"}


def test_extract_json_prose_wrapped():
    raw = (
        'I analyzed the message and the answer is {"category": "shelter", '
        '"urgency": "urgent"} based on context.'
    )
    assert extract_json(raw) == {"category": "shelter", "urgency": "urgent"}


def test_extract_json_nested_braces_in_string():
    raw = '{"category": "food", "explanation": "look {not json}"}'
    assert extract_json(raw)["explanation"] == "look {not json}"


def test_extract_json_malformed_returns_none():
    assert extract_json('{"category": "food",') is None
    assert extract_json("{not json}") is None
    assert extract_json("[1, 2, 3]") is None  # arrays are not dicts


def test_extract_json_empty_returns_none():
    assert extract_json("") is None
    assert extract_json("   \n  ") is None
    assert extract_json(None) is None  # type: ignore[arg-type]


def test_parse_clean_json():
    raw = '{"category": "food", "urgency": "today", "explanation": "hungry"}'
    out = parse_triage_output(raw)
    assert out.category is TriageCategory.FOOD
    assert out.urgency is UrgencyTier.TODAY
    assert out.explanation == "hungry"
    assert out.escalate is False


def test_parse_fenced_json_with_missing_optional_fields():
    raw = '```json\n{"category": "ride", "urgency": "this_week"}\n```'
    out = parse_triage_output(raw)
    assert out.category is TriageCategory.RIDE
    assert out.escalate is False  # default applied
    assert out.explanation == ""  # default applied
    assert out.clarifying_question is None


def test_parse_prose_wrapped_json():
    raw = 'The reply is {"category": "warmth", "urgency": "today"} for sure.'
    out = parse_triage_output(raw)
    assert out.category is TriageCategory.WARMTH


def test_parse_enum_case_insensitive():
    raw = '{"category": "FOOD", "urgency": "Today"}'
    out = parse_triage_output(raw)
    assert out.category is TriageCategory.FOOD
    assert out.urgency is UrgencyTier.TODAY


def test_parse_extra_unknown_fields_ignored():
    raw = '{"category": "other", "urgency": "today", "confidence": 0.9}'
    out = parse_triage_output(raw)
    assert out.category is TriageCategory.OTHER
    assert not hasattr(out, "confidence")


def test_parse_wrong_enum_value_falls_back():
    raw = '{"category": "banana", "urgency": "today"}'
    out = parse_triage_output(raw)
    # invalid enum -> fallback on the raw text, which matches no keyword
    assert out.category is TriageCategory.OTHER
    # output still validates against the schema contract:
    assert TriageOutputSchema.model_validate(out.model_dump())


def test_parse_wrong_enum_with_keyword_text_falls_back():
    raw = '{"category": "banana"} help with groceries please'
    out = parse_triage_output(raw)
    assert out.category is TriageCategory.FOOD


def test_parse_malformed_json_falls_back():
    raw = '{"category": "food", "urgency": "today"'  # truncated
    out = parse_triage_output(raw)
    # fallback sees "food" in the raw text
    assert out.category is TriageCategory.FOOD


def test_parse_empty_string_falls_back():
    out = parse_triage_output("")
    assert out.category is TriageCategory.OTHER
    assert out.clarifying_question  # friendly question present


def test_parse_none_input_falls_back():
    out = parse_triage_output(None)  # type: ignore[arg-type]
    assert out.category is TriageCategory.OTHER


def test_fallback_support_escalate():
    out = fallback_classify("I feel unsafe and there is violence at home")
    assert out.category is TriageCategory.SUPPORT
    assert out.urgency is UrgencyTier.URGENT
    assert out.escalate is True


def test_fallback_escalate_keyword_domestic():
    out = fallback_classify("domestic situation, I am scared at home")
    assert out.escalate is True
    assert out.category is TriageCategory.SUPPORT


def test_fallback_food():
    out = fallback_classify("I am hungry and need groceries from the pantry")
    assert out.category is TriageCategory.FOOD


def test_fallback_ride_urgency_today():
    out = fallback_classify("I need a ride to my interview today")
    assert out.category is TriageCategory.RIDE
    assert out.urgency is UrgencyTier.TODAY


def test_fallback_ride_urgency_this_week():
    out = fallback_classify("I need a ride to the clinic appointment")
    assert out.category is TriageCategory.RIDE
    assert out.urgency is UrgencyTier.THIS_WEEK


def test_fallback_shelter():
    out = fallback_classify("I was evicted and have nowhere to stay or sleep")
    assert out.category is TriageCategory.SHELTER


def test_fallback_warmth():
    out = fallback_classify("It is cold and I need a warm coat and blanket")
    assert out.category is TriageCategory.WARMTH


def test_fallback_other_asks_question():
    out = fallback_classify("just saying hello")
    assert out.category is TriageCategory.OTHER
    assert out.clarifying_question


def test_parse_output_always_validates():
    raws = [
        '{"category": "food", "urgency": "today"}',
        '```json\n{"category": "shelter", "urgency": "urgent"}\n```',
        "completely invalid {{{",
        "",
        '{"category": "nonsense", "urgency": "also nonsense"}',
        "I need food today",
    ]
    for raw in raws:
        out = parse_triage_output(raw)
        assert isinstance(out, TriageOutputSchema)
        assert TriageOutputSchema.model_validate(out.model_dump())
