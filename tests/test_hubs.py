"""Hub forums and the staff-set trust score."""

import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from fastapi.testclient import TestClient

from src.server.hubs import reset_store
from src.server.main import app

client = TestClient(app)


def setup_function() -> None:
    reset_store()


def test_board_lists_the_eight_program_hubs():
    response = client.get("/api/hubs/board")
    assert response.status_code == 200
    body = response.json()
    names = [hub["name"] for hub in body["hubs"]]
    assert "Food & Mutual Aid" in names
    assert "Domestic Safety" in names
    assert len(body["hubs"]) == 8
    domestic = next(hub for hub in body["hubs"] if hub["id"] == "domestic")
    assert domestic["private"] is True
    assert domestic["member_count"] is None


def test_posting_a_question_lands_in_the_hub_and_can_be_answered():
    created = client.post(
        "/api/hubs/food/threads",
        json={"title": "Is the church pantry open?", "body": "I can get there before 8."},
    )
    assert created.status_code == 200
    board = created.json()
    thread = next(row for row in board["threads"] if row["title"] == "Is the church pantry open?")
    assert thread["held"] is False
    assert thread["author_id"] == "jordan"
    assert thread["ai_answer"]
    assert "pantr" in thread["ai_answer"].lower() or "formula" in thread["ai_answer"].lower()

    replied = client.post(
        f"/api/hubs/threads/{thread['id']}/replies",
        json={"body": "Yes, until 8. Come to the side door on the lit street.", "parent_id": None},
    )
    assert replied.status_code == 200
    replies = [row for row in replied.json()["replies"] if row["thread_id"] == thread["id"]]
    assert replies[-1]["body"].startswith("Yes, until 8")


def test_a_home_address_is_held_instead_of_published():
    response = client.post(
        "/api/hubs/food/threads",
        json={"title": "Drop food here", "body": "I live at 1841 N 23rd St tonight."},
    )
    assert response.status_code == 200
    thread = next(row for row in response.json()["threads"] if row["title"] == "Drop food here")
    assert thread["held"] is True
    assert "address" in thread["held_reason"].lower()

    released = client.post(f"/api/hubs/threads/{thread['id']}/review", json={"release": True})
    assert released.status_code == 422


def test_helpful_marks_toggle_for_the_signed_in_neighbor():
    first = client.post("/api/hubs/threads/food-formula/helpful")
    assert first.status_code == 200
    thread = next(row for row in first.json()["threads"] if row["id"] == "food-formula")
    assert thread["helpful_by_me"] is True
    assert thread["helpful"] == 9

    second = client.post("/api/hubs/threads/food-formula/helpful")
    thread = next(row for row in second.json()["threads"] if row["id"] == "food-formula")
    assert thread["helpful_by_me"] is False
    assert thread["helpful"] == 8


def test_trust_score_is_stored_only_when_staff_type_it():
    nia = next(person for person in client.get("/api/hubs/board").json()["people"] if person["id"] == "nia")
    assert nia["trust_score"] is None

    saved = client.patch(
        "/api/hubs/people/nia/trust",
        json={"score": 81, "note": "Walked two searches and stayed to file the sector."},
    )
    assert saved.status_code == 200
    nia = next(person for person in saved.json()["people"] if person["id"] == "nia")
    assert nia["trust_score"] == 81
    assert nia["trust_note"].startswith("Walked two searches")
    assert nia["trust_set_by"] == "Jordan Hale"

    cleared = client.patch("/api/hubs/people/nia/trust", json={"score": None, "note": ""})
    nia = next(person for person in cleared.json()["people"] if person["id"] == "nia")
    assert nia["trust_score"] is None
    assert nia["trust_set_by"] is None

    rejected = client.patch("/api/hubs/people/nia/trust", json={"score": 140, "note": "too high"})
    assert rejected.status_code == 422


def test_join_hides_the_private_member_count():
    food = client.post("/api/hubs/food/join").json()
    food_hub = next(hub for hub in food["hubs"] if hub["id"] == "food")
    assert food_hub["joined"] is False
    assert food_hub["member_count"] == 244

    domestic = client.post("/api/hubs/domestic/join").json()
    domestic_hub = next(hub for hub in domestic["hubs"] if hub["id"] == "domestic")
    assert domestic_hub["joined"] is False
    assert domestic_hub["member_count"] is None


def test_share_food_adds_a_pantry_and_a_thread_without_an_address():
    blocked = client.post(
        "/api/hubs/food/share",
        json={"what": "Diapers", "when": "1841 N 23rd St tonight", "posting_as": "Resident"},
    )
    assert blocked.status_code == 422

    shared = client.post(
        "/api/hubs/food/share",
        json={"what": "2 boxes of diapers, size 4", "when": "Tonight until 9 PM", "posting_as": "Resident"},
    )
    assert shared.status_code == 200
    body = shared.json()
    assert any(place["name"] == "2 boxes of diapers, size 4" for place in body["places"])
    assert any(thread["title"] == "2 boxes of diapers, size 4, free" for thread in body["threads"])
