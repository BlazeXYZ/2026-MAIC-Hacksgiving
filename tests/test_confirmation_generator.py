"""Tests for the stigma-free resident confirmation generator."""

import sys
from pathlib import Path

# Ensure repository root is on sys.path
REPO_ROOT = Path(__file__).resolve().parent.parent
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from src.server.ai.confirmation import CATEGORY_PHRASES, generate_confirmation
from src.server.ai.schemas import TriageOutputSchema

BANNED_TOKENS = (
    "urgent",
    "escalate",
    "category",
    "triage",
    "json",
    "system prompt",
    "instruction",
)


def _triage(category="shelter", urgency="today", **kwargs):
    return TriageOutputSchema(
        category=category,
        urgency=urgency,
        escalate=False,
        explanation=kwargs.pop("explanation", ""),
        **kwargs,
    )


def _sentence_count(text: str) -> int:
    return sum(text.count(end) for end in (".", "!", "?"))


def test_all_categories_use_friendly_need_phrases():
    for category in ("food", "ride", "shelter", "warmth", "support", "other"):
        text = generate_confirmation(_triage(category=category))
        assert CATEGORY_PHRASES[category] in text


def test_urgency_phrases_avoid_clinical_labels():
    assert "as soon as possible, right now" in generate_confirmation(
        _triage(urgency="urgent")
    )
    assert "today" in generate_confirmation(_triage(urgency="today"))
    assert "in the next few days" in generate_confirmation(_triage(urgency="this_week"))
    assert "urgent" not in generate_confirmation(_triage(urgency="urgent"))


def test_output_is_at_most_two_sentences():
    for category in CATEGORY_PHRASES:
        for urgency in ("urgent", "today", "this_week"):
            text = generate_confirmation(_triage(category=category, urgency=urgency))
            assert 1 <= _sentence_count(text) <= 2


def test_no_banned_internal_tokens_anywhere():
    for category in CATEGORY_PHRASES:
        for urgency in ("urgent", "today", "this_week"):
            text = generate_confirmation(
                _triage(category=category, urgency=urgency),
                district="downtown",
                landmark="the library",
            ).lower()
            for token in BANNED_TOKENS:
                assert token not in text


def test_contains_need_and_followup_reassurance():
    text = generate_confirmation(_triage(category="warmth", urgency="today"))
    assert "getting somewhere warm" in text
    assert "ComforceMKE neighbor" in text


def test_district_and_landmark_are_included():
    text = generate_confirmation(_triage(), district="downtown", landmark="the library")
    assert "downtown" in text
    assert "the library" in text


def test_no_location_when_not_given():
    text = generate_confirmation(_triage())
    assert " near " not in text


def test_clarifying_question_branch_asks_warmly():
    triage = _triage(
        category="other",
        urgency="this_week",
        clarifying_question="Could you tell us a bit more about what you need?",
    )
    text = generate_confirmation(triage)
    assert "Could you tell us a bit more about what you need?" in text
    assert "Here's what we understood" not in text
    for token in BANNED_TOKENS:
        assert token not in text.lower()


def test_never_echoes_explanation_text():
    triage = _triage(
        category="food",
        urgency="urgent",
        explanation=(
            "Residents in the Riverwest district need help getting food "
            "for their family as soon as possible."
        ),
    )
    text = generate_confirmation(triage, district="Riverwest").lower()
    explanation = triage.explanation.lower()
    for word_group in explanation.split(". "):
        assert word_group not in text
