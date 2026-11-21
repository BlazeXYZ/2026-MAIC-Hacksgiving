"""The alias table stays human-curated: typos are not stored, guesses cannot anchor guesses, and old suggestions expire."""

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


def test_fuzzy_matches_are_flagged_even_though_they_point_at_a_trusted_alias() -> None:
    result = post(PANTRY, "need", text="infant formulla")
    assert (result["status"], result["verified"]) == ("matched", False)


def test_coordinator_can_confirm_a_common_guess_without_storing_the_typo() -> None:
    post(PANTRY, "need", text="infant formulla")
    post(OTHER, "offer", text="Infant Formulla")
    guesses = client.get(f"{BASE}/admin/guesses", headers=COORD).json()
    assert [(g["wording"].lower(), g["item"]["id"], g["count"], g["via"]) for g in guesses] == [
        ("infant formulla", "infant-formula", 2, "fuzzy")
    ]
    before = len(store.list_aliases())
    res = client.post(
        f"{BASE}/admin/entries/{guesses[0]['entry_id']}/resolve", json={"item_id": "infant-formula"}, headers=COORD
    )
    assert res.status_code == 200
    assert client.get(f"{BASE}/admin/guesses", headers=COORD).json() == []
    assert client.get(f"{BASE}/locations/{PANTRY}").json()["need"][0]["verified"] is True
    assert client.get(f"{BASE}/locations/{OTHER}").json()["offer"][0]["verified"] is True
    assert len(store.list_aliases()) == before  # confirmed, and the misspelling still was not stored


def test_a_coordinator_can_point_a_guess_at_a_different_item() -> None:
    entry = post(PANTRY, "need", text="infant formulla")
    client.post(f"{BASE}/admin/entries/{entry['id']}/resolve", json={"item_id": "diapers"}, headers=COORD)
    assert client.get(f"{BASE}/locations/{PANTRY}").json()["need"][0]["item"]["id"] == "diapers"


def test_guesses_route_needs_the_coordinator_key() -> None:
    assert client.get(f"{BASE}/admin/guesses").status_code == 403


