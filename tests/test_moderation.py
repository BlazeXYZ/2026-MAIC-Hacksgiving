"""Tests for the content moderation / abuse classifier (#38)."""

import sys
import time
from pathlib import Path

# Ensure repository root is on sys.path
REPO_ROOT = Path(__file__).resolve().parent.parent
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from src.server.ai.moderation import CRISIS_KEYWORDS, ModerationResult, moderate

CATEGORIES = {"threat", "harassment", "hate_speech", "spam"}


# ---------------------------------------------------------------------------
# Category triggers
# ---------------------------------------------------------------------------

def test_threat_flagged():
    for text in (
        "I'm going to get you for this",
        "I will kill you",
        "You better watch your back",
        "We are going to hurt them",
    ):
        result = moderate(text)
        assert result.needs_review, text
        assert "threat" in result.matched_categories, text
        assert 0.0 <= result.severity <= 1.0


def test_harassment_flagged():
    for text in (
        "You are such an idiot",
        "Shut up you moron",
        "fuck you and your stupid face",
    ):
        result = moderate(text)
        assert result.needs_review, text
        assert "harassment" in result.matched_categories, text


def test_hate_speech_flagged():
    for text in (
        "You are a filthy retard",
        "Those faggots should leave",
        "all niggers out of here",
    ):
        result = moderate(text)
        assert result.needs_review, text
        assert "hate_speech" in result.matched_categories, text


def test_spam_flagged():
    for text in (
        "soooo cheap deals at www.example.com click now",
        "CHECK THIS OUT NOW ITS AMAZING AND FREE FOR EVERYONE",
        "What is going on here???",
        "yessss this is the best thing ever!!!!",
    ):
        result = moderate(text)
        assert result.needs_review, text
        assert "spam" in result.matched_categories, text


# ---------------------------------------------------------------------------
# Crisis keywords must NOT be flagged as abuse
# ---------------------------------------------------------------------------

def test_crisis_not_flagged_as_abuse():
    for text in (
        "I want to kill myself, I can't go home",
        "my husband hurt me",
        "I have been thinking about suicide",
        "I was assaulted last night and I don't feel safe",
        "There is domestic violence in my home",
    ):
        result = moderate(text)
        assert not result.needs_review, text
        assert result.matched_categories == (), text
        assert result.severity == 0.0, text


def test_mixed_crisis_and_abuse_still_flagged():
    result = moderate("I want to kill myself and I'm going to get you too")
    assert result.needs_review
    assert "threat" in result.matched_categories


def test_crisis_keywords_defined():
    assert "suicide" in CRISIS_KEYWORDS
    assert "kill myself" in CRISIS_KEYWORDS


# ---------------------------------------------------------------------------
# Clean text passes
# ---------------------------------------------------------------------------

def test_clean_text_passes():
    result = moderate("Can someone help me get to the pantry on Saturday?")
    assert not result.needs_review
    assert result.matched_categories == ()
    assert result.severity == 0.0


def test_clean_neighborly_text_variants():
    for text in (
        "Hi, my neighbor needs a ride to the doctor on Tuesday morning.",
        "Does anyone have extra blankets? It is getting cold.",
        "Thank you all so much for the food box last week!",
        "Can someone help me get to the pantry on Saturday?",
    ):
        result = moderate(text)
        assert not result.needs_review, text


# ---------------------------------------------------------------------------
# Robustness — never raises
# ---------------------------------------------------------------------------

def test_never_raises_on_garbage():
    for text in (
        "",
        "   ",
        "🙂🎉🚀",
        "\x00\x01\x02 binary-ish \xff\xfe",
        "a" * 5000,
        "!?!?!?!?" * 100,
        "null\0\0\0",
    ):
        result = moderate(text)
        assert isinstance(result, ModerationResult)
        assert set(result.matched_categories) <= CATEGORIES
        assert 0.0 <= result.severity <= 1.0


# ---------------------------------------------------------------------------
# Performance — well under 20 ms per call on 2000-char input
# ---------------------------------------------------------------------------

def test_benchmark_under_20ms():
    text = (
        "My neighbor needs help with groceries on Saturday. " * 40
    )[:2000]
    iterations = 200

    # Warm up
    moderate(text)

    start = time.perf_counter()
    for _ in range(iterations):
        moderate(text)
    total = time.perf_counter() - start

    avg_ms = (total / iterations) * 1000
    worst_ms = total * 1000  # whole batch must be far below 200 * 20ms
    assert avg_ms < 5.0, f"avg {avg_ms:.3f}ms per call"
    assert worst_ms < 20.0 * iterations, f"batch took {worst_ms:.1f}ms"


def test_categories_are_subset_of_schema():
    abusive_texts = (
        "I will kill you",
        "you idiot shut up",
        "those retards again",
        "sooo good www.example.com",
    )
    for text in abusive_texts:
        result = moderate(text)
        assert set(result.matched_categories) <= CATEGORIES
