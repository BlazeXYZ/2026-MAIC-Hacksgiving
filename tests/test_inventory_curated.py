"""The alias table stays human-curated: typos are not stored, guesses cannot anchor guesses, and old suggestions expire."""

from __future__ import annotations

import sys
from datetime import timedelta
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
def fresh_store() -> None:
    store.reset()


def post(location: str, kind: str, **body: object) -> dict:
    res = client.post(f"{BASE}/entries", json={"location_id": location, "kind": kind, **body})
    assert res.status_code == 201, res.text
    return res.json()


def test_a_run_of_typos_never_grows_the_alias_table() -> None:
    before = len(store.list_aliases())
    for typo in ("infant formulla", "infant formuula", "infant fromula"):
        assert post(PANTRY, "need", text=typo)["via"] == "fuzzy"
    assert len(store.list_aliases()) == before


def test_a_typo_cannot_become_the_anchor_for_more_typos() -> None:
    # Each step is close to the one before it, but the last is too far from the real word.
    assert resolver.resolve_local("shell ssable milk").via == "fuzzy"
    assert resolver.resolve_local("shtll ssable miuk").item_id is None


def test_phrase_matching_ignores_unreviewed_suggestions() -> None:
    store.add_alias("snow garment", "winter-coats", status="suggested", source="llm")
    assert resolver.resolve_local("snow garment").via == "alias"  # an exact repeat still hits the cache
    assert resolver.resolve_local("my snow garment please").item_id is None  # but it is not a phrase anchor


def test_fuzzy_matches_are_flagged_even_though_they_point_at_a_trusted_alias() -> None:
    result = post(PANTRY, "need", text="infant formulla")
    assert (result["status"], result["verified"]) == ("matched", False)


def test_coordinator_can_confirm_a_common_guess() -> None:
    post(PANTRY, "need", text="infant formulla")
    post(OTHER, "offer", text="Infant Formulla")
    guesses = client.get(f"{BASE}/admin/guesses", headers=COORD).json()
    assert [(g["wording"].lower(), g["item"]["id"], g["count"]) for g in guesses] == [("infant formulla", "infant-formula", 2)]
    res = client.post(f"{BASE}/admin/aliases", json={"text": "infant formulla", "item_id": "infant-formula"}, headers=COORD)
    assert res.status_code == 201
    assert client.get(f"{BASE}/admin/guesses", headers=COORD).json() == []
    assert client.get(f"{BASE}/locations/{PANTRY}").json()["need"][0]["verified"] is True
    assert client.get(f"{BASE}/locations/{OTHER}").json()["offer"][0]["verified"] is True


def test_a_coordinator_can_point_a_guess_at_a_different_item() -> None:
    post(PANTRY, "need", text="infant formulla")
    client.post(f"{BASE}/admin/aliases", json={"text": "infant formulla", "item_id": "diapers"}, headers=COORD)
    assert client.get(f"{BASE}/locations/{PANTRY}").json()["need"][0]["item"]["id"] == "diapers"


def test_guesses_route_needs_the_coordinator_key() -> None:
    assert client.get(f"{BASE}/admin/guesses").status_code == 403


def test_unreviewed_suggestions_expire_and_their_entries_go_back_for_review() -> None:
    old = store.now_utc() - store.SUGGESTION_TTL - timedelta(days=1)
    alias = store.add_alias("snow garment", "winter-coats", status="suggested", source="llm", at=old)
    entry = store.add_entry(
        location_id=PANTRY, kind="need", quantity=1, label="snow garment",
        item_id="winter-coats", alias_id=alias.id, via="llm",
    )
    assert store.expire_suggestions() == 1
    assert all(a.id != alias.id for a in store.list_aliases())
    assert store.get_entry(entry.id).item_id is None
    assert [e.id for e in store.unresolved_entries()] == [entry.id]


def test_recent_approved_and_seeded_aliases_never_expire() -> None:
    old = store.now_utc() - store.SUGGESTION_TTL - timedelta(days=1)
    fresh = store.add_alias("snow wear", "winter-coats", status="suggested", source="llm")
    reviewed = store.add_alias("snow gear", "winter-coats", status="suggested", source="llm", at=old)
    store.update_alias(reviewed.id, status="approved")
    before = len(store.list_aliases())
    assert store.expire_suggestions() == 0
    assert len(store.list_aliases()) == before
    assert store.get_alias(fresh.id).status == "suggested"
