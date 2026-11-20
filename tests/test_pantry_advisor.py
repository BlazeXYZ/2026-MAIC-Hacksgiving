"""Tests for the pantry stocking advisor prompt, scoring engine, and endpoint."""

import sys
from pathlib import Path

# Ensure repository root is on sys.path
REPO_ROOT = Path(__file__).resolve().parent.parent
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from fastapi.testclient import TestClient

from src.server.ai.advisor import (
    PANTRY_ADVISOR_PROMPT,
    PantryStockingRequest,
    recommend_stocking,
)
from src.server.main import app

client = TestClient(app)


def _make_request(**kwargs) -> PantryStockingRequest:
    kwargs.setdefault("recent_ticket_tags", ["infant formula", "diapers", "winter coats"])
    return PantryStockingRequest(**kwargs)


def test_prompt_mentions_persona_inputs_and_output():
    prompt = PANTRY_ADVISOR_PROMPT.lower()
    assert "supply advisor" in prompt
    assert "recent_ticket_tags" in prompt
    assert "district_profile" in prompt
    assert "priority_score" in prompt


def test_recommends_five_items():
    recs = recommend_stocking(_make_request())
    assert len(recs) == 5


def test_infant_formula_ranks_first():
    recs = recommend_stocking(_make_request())
    assert recs[0].item == "Infant formula"


def test_recommendation_fields_valid():
    recs = recommend_stocking(_make_request())
    for rec in recs:
        assert rec.item
        assert 0 < len(rec.justification) <= 160
        assert 0.0 <= rec.priority_score <= 1.0


def test_scores_sorted_descending():
    recs = recommend_stocking(_make_request())
    scores = [rec.priority_score for rec in recs]
    assert scores == sorted(scores, reverse=True)


def test_district_profile_boost_changes_ranking():
    base = recommend_stocking(
        PantryStockingRequest(recent_ticket_tags=["winter coats"])
    )
    boosted = recommend_stocking(
        PantryStockingRequest(
            recent_ticket_tags=["winter coats"],
            district_profile={"cold_snap": 0.9},
        )
    )
    assert base[0].item == boosted[0].item  # still winter coats on top
    assert boosted[0].priority_score >= base[0].priority_score
    # Deterministic: same input gives identical output
    again = recommend_stocking(
        PantryStockingRequest(
            recent_ticket_tags=["winter coats"],
            district_profile={"cold_snap": 0.9},
        )
    )
    assert again == boosted


def test_empty_match_tags_return_fallback_five():
    recs = recommend_stocking(PantryStockingRequest(recent_ticket_tags=["misc"]))
    assert len(recs) == 5
    assert all(rec.justification for rec in recs)


def test_endpoint_returns_five_recommendations():
    response = client.post(
        "/api/v1/advisors/pantry-stocking",
        json={
            "recent_ticket_tags": ["formula", "coats"],
            "district_profile": {"cold_snap": 0.9},
        },
    )
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    assert len(data) == 5
    for rec in data:
        assert {"item", "justification", "priority_score"} <= rec.keys()
        assert 0.0 <= rec["priority_score"] <= 1.0


def test_endpoint_rejects_empty_tags():
    response = client.post(
        "/api/v1/advisors/pantry-stocking",
        json={"recent_ticket_tags": []},
    )
    assert response.status_code == 422
