"""Helping a coordinator decide "new item" or "another name": candidate hints and a duplicate warning."""

from __future__ import annotations

import sys
from pathlib import Path

import pytest

REPO_ROOT = Path(__file__).resolve().parent.parent
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from fastapi import FastAPI
from fastapi.testclient import TestClient

from src.server.ai.hotspots import COORDINATOR_API_KEY
from src.server.api.inventory import router
from src.server.inventory import resolver, store

PANTRY = "hunger-task-force-south"
OTHER = "house-of-peace"
BASE = "/api/v1/inventory"

app = FastAPI()
app.include_router(router)
client = TestClient(app)
COORD = {"X-Coordinator-Key": COORDINATOR_API_KEY}


@pytest.fixture(autouse=True)
def fresh_store(monkeypatch: pytest.MonkeyPatch) -> None:
    store.reset()
    for key in ("TYPESAFE_API_KEY", "GEMINI_API_KEY", "OPENAI_API_KEY"):
        monkeypatch.setattr(resolver.settings, key, None)
    store.add_item("Baby crib")


def post(location: str, kind: str, **body: object) -> dict:
    res = client.post(f"{BASE}/entries", json={"location_id": location, "kind": kind, **body})
    assert res.status_code == 201, res.text
    return res.json()


def held() -> list[dict]:
    return client.get(f"{BASE}/admin/unresolved", headers=COORD).json()


def test_held_entries_list_the_closest_existing_items() -> None:
    post(PANTRY, "need", text="crib")  # a word shared with "baby crib", below the auto-match cutoff
    row = held()[0]
    assert row["similar"][0]["item"]["name"] == "Baby crib"
    assert row["similar"][0]["wording"] == "Baby crib"
    assert row["similar"][0]["score"] >= store.HINT_SCORE


def test_a_truly_new_thing_has_no_candidates() -> None:
    post(PANTRY, "need", text="quantum widget")
    assert held()[0]["similar"] == []


def test_candidates_are_at_most_three_and_one_per_item() -> None:
    post(PANTRY, "need", text="winter")
    similar = held()[0]["similar"]
    assert len(similar) <= 3
    assert len({s["item"]["id"] for s in similar}) == len(similar)


def test_promoting_something_that_looks_like_an_existing_item_is_refused_with_the_matches() -> None:
    entry = post(PANTRY, "need", text="crib")
    res = client.post(f"{BASE}/admin/entries/{entry['id']}/promote", json={}, headers=COORD)
    assert res.status_code == 409
    detail = res.json()["detail"]
    assert detail["similar"][0]["item"]["name"] == "Baby crib"
    assert "confirm_new" in detail["message"]
    assert len(held()) == 1  # nothing changed
    assert "crib" not in {i["id"] for i in client.get(f"{BASE}/catalog").json()}


def test_confirming_creates_the_item_anyway() -> None:
    entry = post(PANTRY, "need", text="crib")
    res = client.post(f"{BASE}/admin/entries/{entry['id']}/promote", json={"confirm_new": True}, headers=COORD)
    assert res.status_code == 200 and res.json()["item"]["name"] == "Crib"


def test_the_coordinator_can_instead_say_it_is_another_name() -> None:
    entry = post(PANTRY, "need", text="crib")
    res = client.post(
        f"{BASE}/admin/entries/{entry['id']}/resolve",
        json={"item_id": "baby-crib", "alias_text": "crib"},
        headers=COORD,
    )
    assert res.status_code == 200
    assert post(OTHER, "offer", text="crib")["item"]["name"] == "Baby crib"  # the new name works for everyone


def test_creating_an_item_up_front_gets_the_same_warning() -> None:
    res = client.post(f"{BASE}/admin/items", json={"name": "Cribs"}, headers=COORD)
    assert res.status_code == 409 and res.json()["detail"]["similar"]
    ok = client.post(f"{BASE}/admin/items", json={"name": "Cribs", "confirm_new": True}, headers=COORD)
    assert ok.status_code == 201


def test_a_genuinely_different_item_is_not_warned_about() -> None:
    res = client.post(f"{BASE}/admin/items", json={"name": "Space heater"}, headers=COORD)
    assert res.status_code == 201


def test_one_shared_generic_word_is_not_enough_to_warn() -> None:
    res = client.post(f"{BASE}/admin/items", json={"name": "Baby monitor"}, headers=COORD)
    assert res.status_code == 201  # shares "baby" with several items, but is not one of them


def test_rejected_wordings_are_not_offered_as_candidates() -> None:
    post(PANTRY, "need", text="parkq")  # close to the seeded wording "parka", but below the auto-match cutoff
    assert [s["wording"] for s in held()[0]["similar"]] == ["parka"]
    alias = next(a for a in store.list_aliases() if a.text == "parka")
    client.patch(f"{BASE}/admin/aliases/{alias.id}", json={"status": "rejected"}, headers=COORD)
    assert all(s["wording"] != "parka" for s in held()[0]["similar"])


