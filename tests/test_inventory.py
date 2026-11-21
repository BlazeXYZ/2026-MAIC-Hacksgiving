"""Community inventory: alias resolution, coordinator review, matching, and the privacy rule."""

from __future__ import annotations

import asyncio
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
from src.server.inventory.jev import ModelAnswer
from src.server.inventory.locations import eligible_locations

PANTRY = "hunger-task-force-south"
OTHER_PANTRY = "house-of-peace"
SAFE_PLACE = "king_library"
SHELTER = "sojourner"

app = FastAPI()
app.include_router(router)
client = TestClient(app)
COORD = {"X-Coordinator-Key": COORDINATOR_API_KEY}


@pytest.fixture(autouse=True)
def fresh_store(monkeypatch: pytest.MonkeyPatch) -> None:
    store.reset()
    for key in ("TYPESAFE_API_KEY", "GEMINI_API_KEY", "OPENAI_API_KEY"):  # no real model calls, whatever .env says
        monkeypatch.setattr(resolver.settings, key, None)


def post(location: str = PANTRY, kind: str = "need", **body: object) -> dict:
    res = client.post("/api/v1/inventory/entries", json={"location_id": location, "kind": kind, **body})
    assert res.status_code == 201, res.text
    return res.json()


# ---------- resolving words ----------


def test_normalize_handles_plurals_and_punctuation() -> None:
    assert store.normalize("Baby Formulas!") == "baby formula"
    assert store.normalize("Rice & Grains") == "rice and grain"
    assert store.normalize("boxes") == "box"


def test_exact_alias_and_plural_resolve_without_a_suggestion() -> None:
    before = len(store.list_aliases())
    result = resolver.resolve_local("Diapers")
    assert (result.item_id, result.via) == ("diapers", "alias")
    assert len(store.list_aliases()) == before


def test_known_phrase_inside_a_sentence_resolves() -> None:
    result = resolver.resolve_local("two cases of baby formula please")
    assert (result.item_id, result.via) == ("infant-formula", "phrase")


def test_typo_resolves_by_fuzzy_match_without_growing_the_alias_table() -> None:
    before = len(store.list_aliases())
    result = resolver.resolve_local("infant formulla")
    assert (result.item_id, result.via) == ("infant-formula", "fuzzy")
    assert store.get_alias(result.alias_id or "").status == "seeded"  # points at the reviewed alias
    assert resolver.resolve_local("infant formuula").via == "fuzzy"
    assert len(store.list_aliases()) == before  # typos are matched each time, never stored


def test_unknown_words_are_unmatched() -> None:
    assert resolver.resolve_local("quantum widget").item_id is None


def test_model_answer_is_a_flagged_guess_and_is_never_stored_as_an_alias() -> None:
    async def picker(text: str, items: list[store.Item]) -> ModelAnswer | None:
        return ModelAnswer((store.Candidate("winter-coats", 0.9),), 0.05)

    before = len(store.list_aliases())
    result = asyncio.run(resolver.resolve("puffy snow garment", picker))
    assert (result.item_id, result.via, result.alias_id) == ("winter-coats", "model", None)
    assert len(store.list_aliases()) == before


def test_unsure_model_leaves_the_text_unmatched() -> None:
    async def picker(text: str, items: list[store.Item]) -> ModelAnswer | None:
        return None

    result = asyncio.run(resolver.resolve("mystery thing", picker))
    assert result.item_id is None
    assert resolver.resolve_local("mystery thing").item_id is None  # nothing was saved


def _live_model(monkeypatch: pytest.MonkeyPatch, answer: str) -> None:
    from src.server.ai.client import TriageLLMClient

    async def complete(self: TriageLLMClient, prompt: str) -> str:
        return answer

    monkeypatch.setattr(resolver.settings, "AI_MOCK_MODE", False)
    monkeypatch.setattr(resolver.settings, "TYPESAFE_API_KEY", None)
    monkeypatch.setattr(resolver.settings, "GEMINI_API_KEY", "test-key")
    monkeypatch.setattr(TriageLLMClient, "complete", complete)


def test_model_answers_are_checked_against_the_catalog(monkeypatch: pytest.MonkeyPatch) -> None:
    items = store.list_items()
    _live_model(monkeypatch, "winter-coats")
    answer = asyncio.run(resolver.pick_with_model("snow garment", items))
    assert answer is not None and answer.candidates[0].item_id == "winter-coats"
    _live_model(monkeypatch, "definitely-not-an-item")
    assert asyncio.run(resolver.pick_with_model("snow garment", items)) == ModelAnswer((), 1.0)  # "none fit"
    _live_model(monkeypatch, "NONE")
    assert asyncio.run(resolver.pick_with_model("snow garment", items)) == ModelAnswer((), 1.0)


def test_model_is_never_called_in_mock_mode(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(resolver.settings, "AI_MOCK_MODE", True)
    assert asyncio.run(resolver.pick_with_model("anything", store.list_items())) is None


# ---------- posting ----------


def test_pick_from_the_catalog() -> None:
    result = post(item_id="blankets", quantity=4)
    assert (result["status"], result["verified"], result["via"]) == ("matched", True, "picked")
    detail = client.get(f"/api/v1/inventory/locations/{PANTRY}").json()
    assert [(e["item"]["id"], e["quantity"]) for e in detail["need"]] == [("blankets", 4)]


def test_free_text_match_is_verified_for_a_seed_alias() -> None:
    result = post(text="bus pass")
    assert result["item"]["id"] == "transit-cards"
    assert result["verified"] is True


def test_guessed_match_is_flagged_until_a_coordinator_confirms(monkeypatch: pytest.MonkeyPatch) -> None:
    _live_model(monkeypatch, "winter-coats")
    result = post(text="puffy snow garment")
    assert (result["via"], result["verified"]) == ("model", False)
    guess = client.get("/api/v1/inventory/admin/guesses", headers=COORD).json()[0]
    res = client.post(
        f"/api/v1/inventory/admin/entries/{guess['entry_id']}/resolve",
        json={"item_id": "winter-coats", "alias_text": "snow garment"},
        headers=COORD,
    )
    assert res.status_code == 200
    entry = client.get(f"/api/v1/inventory/locations/{PANTRY}").json()["need"][0]
    assert entry["verified"] is True
    texts = {a["text"] for a in client.get("/api/v1/inventory/admin/aliases", headers=COORD).json()}
    assert "snow garment" in texts and "puffy snow garment" not in texts  # the corrected wording, not what was typed


def test_unmatched_text_is_held_not_listed() -> None:
    result = post(text="quantum widget")
    assert result["status"] == "held"
    assert client.get(f"/api/v1/inventory/locations/{PANTRY}").json()["need"] == []
    held = client.get("/api/v1/inventory/admin/unresolved", headers=COORD).json()
    assert [h["label"] for h in held] == ["quantum widget"]


def test_contact_details_are_scrubbed_before_storing() -> None:
    post(text="quantum widget call 414-555-0123")
    held = client.get("/api/v1/inventory/admin/unresolved", headers=COORD).json()
    assert "414-555-0123" not in held[0]["label"]


def test_an_entry_needs_exactly_one_way_to_name_it() -> None:
    base = {"location_id": PANTRY, "kind": "need"}
    assert client.post("/api/v1/inventory/entries", json=base).status_code == 422
    both = {**base, "item_id": "blankets", "text": "blankets"}
    assert client.post("/api/v1/inventory/entries", json=both).status_code == 422


# ---------- privacy: domestic-safety shelters stay out ----------


def test_shelters_are_not_eligible_locations() -> None:
    ids = set(eligible_locations())
    assert {PANTRY, OTHER_PANTRY, SAFE_PLACE} <= ids
    assert SHELTER not in ids and "womens_center" not in ids


def test_shelters_do_not_appear_and_answer_like_unknown_places() -> None:
    listed = {loc["id"] for loc in client.get("/api/v1/inventory/locations").json()}
    assert SHELTER not in listed
    unknown = client.get("/api/v1/inventory/locations/does-not-exist")
    shelter = client.get(f"/api/v1/inventory/locations/{SHELTER}")
    assert shelter.status_code == unknown.status_code == 404
    assert shelter.json() == unknown.json()
    body = {"location_id": SHELTER, "kind": "need", "item_id": "blankets"}
    assert client.post("/api/v1/inventory/entries", json=body).status_code == 404


# ---------- matching and advice ----------


def test_needs_are_matched_to_the_nearest_place_that_has_the_item() -> None:
    post(PANTRY, "need", item_id="blankets", quantity=5)
    post(OTHER_PANTRY, "have", item_id="blankets", quantity=20)
    post(SAFE_PLACE, "offer", item_id="blankets", quantity=3)
    found = client.get(f"/api/v1/inventory/locations/{PANTRY}/matches").json()
    assert len(found) == 1 and found[0]["item"]["id"] == "blankets"
    sources = found[0]["sources"]
    assert {s["location_id"] for s in sources} == {OTHER_PANTRY, SAFE_PLACE}
    assert [s["distance_miles"] for s in sources] == sorted(s["distance_miles"] for s in sources)


def test_expired_entries_drop_out() -> None:
    entry = store.add_entry(
        location_id=PANTRY, kind="need", quantity=1, label="blankets", item_id="blankets", alias_id=None, via="picked"
    )
    assert store.active_entries(location_id=PANTRY) == [entry]
    later = entry.created_at + store.TTL["need"] + timedelta(seconds=1)
    assert store.active_entries(location_id=PANTRY, at=later) == []


def test_advice_follows_open_needs() -> None:
    assert client.get(f"/api/v1/inventory/locations/{PANTRY}/advice").json() == []
    post(PANTRY, "need", item_id="infant-formula")
    advice = client.get(f"/api/v1/inventory/locations/{PANTRY}/advice").json()
    assert advice and advice[0]["item"] == "Infant formula"


# ---------- coordinator review ----------


def test_admin_routes_need_the_coordinator_key() -> None:
    for method, path in [
        ("get", "/api/v1/inventory/admin/aliases"),
        ("get", "/api/v1/inventory/admin/unresolved"),
        ("patch", "/api/v1/inventory/admin/aliases/al-1"),
    ]:
        assert client.request(method, path).status_code == 403
        assert client.request(method, path, headers={"X-Coordinator-Key": "wrong"}).status_code == 403


def test_coordinator_can_rename_any_alias() -> None:
    alias = next(a for a in store.list_aliases() if a.text == "parka")
    res = client.patch(f"/api/v1/inventory/admin/aliases/{alias.id}", json={"text": "snow parka"}, headers=COORD)
    assert res.status_code == 200 and res.json()["text"] == "snow parka"
    assert resolver.resolve_local("snow parka").via == "alias"
    assert resolver.resolve_local("parka").item_id is None  # the old wording is gone


def test_renaming_to_a_wording_already_in_use_is_a_conflict() -> None:
    alias = next(a for a in store.list_aliases() if a.text == "parka")
    res = client.patch(f"/api/v1/inventory/admin/aliases/{alias.id}", json={"text": "Diapers"}, headers=COORD)
    assert res.status_code == 409


def test_remapping_an_alias_moves_the_entries_that_used_it() -> None:
    post(text="parka")
    alias = next(a for a in store.list_aliases() if a.text == "parka")
    client.patch(f"/api/v1/inventory/admin/aliases/{alias.id}", json={"item_id": "blankets"}, headers=COORD)
    need = client.get(f"/api/v1/inventory/locations/{PANTRY}").json()["need"][0]
    assert need["item"]["id"] == "blankets"


def test_rejecting_an_alias_sends_its_entries_back_for_review() -> None:
    post(text="parka")
    alias = next(a for a in store.list_aliases() if a.text == "parka")
    client.patch(f"/api/v1/inventory/admin/aliases/{alias.id}", json={"status": "rejected"}, headers=COORD)
    assert client.get(f"/api/v1/inventory/locations/{PANTRY}").json()["need"] == []
    assert len(client.get("/api/v1/inventory/admin/unresolved", headers=COORD).json()) == 1
    assert resolver.resolve_local("parka").item_id is None  # the rejected wording is not reused
    assert post(text="parka")["status"] == "held"  # it waits for a human instead of being guessed again


def test_resolving_a_held_entry_teaches_the_system_the_corrected_wording() -> None:
    held = post(text="puffy snow garment")
    assert held["status"] == "held"
    res = client.post(
        f"/api/v1/inventory/admin/entries/{held['id']}/resolve",
        json={"item_id": "winter-coats", "alias_text": "snow garment"},
        headers=COORD,
    )
    assert res.status_code == 200 and res.json()["item"]["id"] == "winter-coats"
    again = post(text="snow garments")
    assert (again["status"], again["item"]["id"], again["verified"]) == ("matched", "winter-coats", True)
    assert "puffy snow garment" not in {a.text for a in store.list_aliases()}  # what was typed was not stored
    assert post(text="puffy snow garment")["via"] == "phrase"  # it still matches, as a known phrase inside


def test_coordinator_can_rename_a_catalog_item_and_close_an_entry() -> None:
    res = client.patch("/api/v1/inventory/admin/items/blankets", json={"name": "Warm blankets"}, headers=COORD)
    assert res.json()["name"] == "Warm blankets"
    posted = post(item_id="blankets")
    assert client.post(f"/api/v1/inventory/admin/entries/{posted['id']}/close", headers=COORD).status_code == 204
    assert client.get(f"/api/v1/inventory/locations/{PANTRY}").json()["need"] == []


def test_catalog_hides_unreviewed_guesses(monkeypatch: pytest.MonkeyPatch) -> None:
    _live_model(monkeypatch, "winter-coats")
    post(text="puffy snow garment")
    wordings = next(i for i in client.get("/api/v1/inventory/catalog").json() if i["id"] == "winter-coats")["aliases"]
    assert "puffy snow garment" not in wordings and "parka" in wordings


