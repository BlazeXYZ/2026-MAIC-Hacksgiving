"""Jev as the inventory's decision model: request shape, answer parsing, top 3 candidates, and "None fit".

Jev is never called for real here. `jev._post` is replaced, so these check our side of the contract
against the documented native v1 shape. Run one real call with a key before relying on it.
"""

from __future__ import annotations

import asyncio
import sys
from pathlib import Path
from typing import Any

import pytest

REPO_ROOT = Path(__file__).resolve().parent.parent
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from fastapi import FastAPI
from fastapi.testclient import TestClient

from src.server.ai.hotspots import COORDINATOR_API_KEY
from src.server.api.inventory import router
from src.server.inventory import jev, resolver, store

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
    for key in ("GEMINI_API_KEY", "OPENAI_API_KEY"):
        monkeypatch.setattr(resolver.settings, key, None)
    monkeypatch.setattr(resolver.settings, "TYPESAFE_API_KEY", None)
    monkeypatch.setattr(resolver.settings, "AI_MOCK_MODE", False)


def jev_says(monkeypatch: pytest.MonkeyPatch, scores: dict[str, float], sent: list[dict[str, Any]] | None = None) -> None:
    """Pretend to be Jev. `scores` maps an item name (or "None fit") to a probability."""
    monkeypatch.setattr(resolver.settings, "TYPESAFE_API_KEY", "test-key")

    async def fake_post(payload: dict[str, Any]) -> dict[str, Any]:
        if sent is not None:
            sent.append(payload)
        options = payload["questions"]["item"]["criteria"]
        probabilities = {name: scores.get(name, 0.0) for name in options}
        top = max(probabilities, key=lambda n: probabilities[n])
        return {
            "model": payload["model"],
            "answers": {"item": {"type": "choice", "choice": top, "probabilities": probabilities, "confidence": 0.5}},
            "usage": {"input_tokens": 300, "output_tokens": 0},
        }

    monkeypatch.setattr(jev, "_post", fake_post)


def post(location: str, kind: str, **body: object) -> dict:
    res = client.post(f"{BASE}/entries", json={"location_id": location, "kind": kind, **body})
    assert res.status_code == 201, res.text
    return res.json()


def held() -> list[dict]:
    return client.get(f"{BASE}/admin/unresolved", headers=COORD).json()


# ---------- the request we send ----------


def test_request_is_a_native_v1_choice_question_with_a_none_option() -> None:
    payload, names = jev.build_request("rubish bn", store.list_items())
    question = payload["questions"]["item"]
    assert payload["model"] == "jev-1.13.0" and payload["state"] == "Goods: rubish bn"
    assert question["type"] == "choice" and question["instructions"]
    assert jev.NONE_FIT in question["criteria"]
    assert set(question["criteria"]) == set(names) | {jev.NONE_FIT}
    assert "Infant formula" in question["criteria"]
    assert "baby formula" in question["criteria"]["Infant formula"]  # the item's wordings describe it
    assert "test-key" not in str(payload)


def test_duplicate_item_names_and_a_clash_with_the_none_option_stay_distinct() -> None:
    first = store.add_item("Lamp", confirm_new=True)
    second = store.add_item("Desk lamp", confirm_new=True)
    store.rename_item(second.id, "Lamp")
    clash = store.add_item("Spare thing", confirm_new=True)
    store.rename_item(clash.id, jev.NONE_FIT)
    names = jev.option_names(store.list_items())
    assert len(names) == len(store.list_items())
    assert names["Lamp"].id == first.id and jev.NONE_FIT not in names


def test_a_huge_catalog_is_shortlisted_under_the_option_limit() -> None:
    for i in range(260):
        store.add_item(f"zz widget {i:03d} x", confirm_new=True)
    payload, names = jev.build_request("widget 042", store.list_items())
    assert len(names) == jev.MAX_OPTIONS
    assert len(payload["questions"]["item"]["criteria"]) == jev.MAX_OPTIONS + 1  # plus "None fit"


# ---------- reading the answer ----------


def test_the_answer_is_the_top_three_without_none_fit() -> None:
    names = jev.option_names(store.list_items())
    body = {
        "answers": {
            "item": {
                "type": "choice",
                "probabilities": {
                    "Winter coats": 0.5, "Blankets": 0.2, "Warm socks": 0.1, "Diapers": 0.05, jev.NONE_FIT: 0.15
                },
            }
        }
    }
    answer = jev.parse_answer(body, names)
    assert answer is not None
    assert [c.item_id for c in answer.candidates] == ["winter-coats", "blankets", "socks"]
    assert answer.none_fit == 0.15


@pytest.mark.parametrize(
    "body",
    [None, {}, {"answers": {}}, {"answers": {"item": {}}}, {"answers": {"item": {"probabilities": []}}}, "oops"],
)
def test_malformed_answers_are_rejected(body: Any) -> None:
    assert jev.parse_answer(body, jev.option_names(store.list_items())) is None


def test_odd_probabilities_are_clamped_and_unknown_options_ignored() -> None:
    names = jev.option_names(store.list_items())
    body = {"answers": {"item": {"probabilities": {"Winter coats": 3.0, "Not an item": 0.9, "Blankets": True}}}}
    answer = jev.parse_answer(body, names)
    assert answer is not None and [(c.item_id, c.probability) for c in answer.candidates] == [("winter-coats", 1.0)]


def test_no_key_means_no_call_and_failures_never_raise(monkeypatch: pytest.MonkeyPatch) -> None:
    assert asyncio.run(jev.pick("rubish bn", store.list_items())) is None  # no key set
    monkeypatch.setattr(resolver.settings, "TYPESAFE_API_KEY", "test-key")

    async def boom(payload: dict[str, Any]) -> Any:
        raise RuntimeError("network down")

    monkeypatch.setattr(jev, "_post", boom)
    assert asyncio.run(jev.pick("rubish bn", store.list_items())) is None


def test_mock_mode_never_calls_jev(monkeypatch: pytest.MonkeyPatch) -> None:
    sent: list[dict[str, Any]] = []
    jev_says(monkeypatch, {"Winter coats": 0.9}, sent)
    monkeypatch.setattr(resolver.settings, "AI_MOCK_MODE", True)
    assert asyncio.run(resolver.pick_with_model("snow garment", store.list_items())) is None
    assert sent == []


# ---------- what the resolver does with it ----------


def test_a_confident_answer_is_used_but_flagged_and_not_stored(monkeypatch: pytest.MonkeyPatch) -> None:
    jev_says(monkeypatch, {"Winter coats": 0.8, "Blankets": 0.1, jev.NONE_FIT: 0.1})
    before = len(store.list_aliases())
    result = post(PANTRY, "need", text="puffy snow garment")
    assert (result["status"], result["via"], result["verified"]) == ("matched", "model", False)
    assert result["item"]["id"] == "winter-coats"
    assert len(store.list_aliases()) == before


def test_none_fit_winning_holds_the_entry_with_its_candidates(monkeypatch: pytest.MonkeyPatch) -> None:
    jev_says(monkeypatch, {jev.NONE_FIT: 0.7, "Blankets": 0.2, "Winter coats": 0.06, "Warm socks": 0.04})
    assert post(PANTRY, "need", text="baby crib")["status"] == "held"
    row = held()[0]
    assert [c["item"]["id"] for c in row["candidates"]] == ["blankets", "winter-coats", "socks"]
    assert row["none_fit"] == 0.7


def test_an_unsure_answer_is_held_even_if_none_fit_did_not_win(monkeypatch: pytest.MonkeyPatch) -> None:
    jev_says(monkeypatch, {"Winter coats": 0.4, "Blankets": 0.35, jev.NONE_FIT: 0.25})
    assert post(PANTRY, "need", text="warm thing")["status"] == "held"  # best is below the 0.6 bar
    assert [c["probability"] for c in held()[0]["candidates"]] == [0.4, 0.35]


def test_a_light_misspelling_is_caught_by_fuzzy_matching_without_the_model(monkeypatch: pytest.MonkeyPatch) -> None:
    client.post(f"{BASE}/admin/items", json={"name": "Rubbish bin"}, headers=COORD)
    sent: list[dict[str, Any]] = []
    jev_says(monkeypatch, {}, sent)
    result = post(PANTRY, "need", text="rubish bn")
    assert (result["via"], result["item"]["name"]) == ("fuzzy", "Rubbish bin")
    assert sent == []


def test_known_words_never_reach_jev(monkeypatch: pytest.MonkeyPatch) -> None:
    sent: list[dict[str, Any]] = []
    jev_says(monkeypatch, {}, sent)
    post(PANTRY, "need", text="diapers")
    post(PANTRY, "need", text="infant formulla")  # fuzzy
    post(PANTRY, "need", text="two cases of baby formula")  # phrase
    assert sent == []


def test_a_rejected_wording_is_not_sent_to_jev_again(monkeypatch: pytest.MonkeyPatch) -> None:
    sent: list[dict[str, Any]] = []
    jev_says(monkeypatch, {"Winter coats": 0.9}, sent)
    alias = next(a for a in store.list_aliases() if a.text == "parka")
    client.patch(f"{BASE}/admin/aliases/{alias.id}", json={"status": "rejected"}, headers=COORD)
    assert post(PANTRY, "need", text="parka")["status"] == "held"
    assert sent == []


# ---------- the coordinator flow ----------


def test_a_misspelling_is_matched_by_the_model_and_the_coordinator_stores_the_right_wording(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    client.post(f"{BASE}/admin/items", json={"name": "Rubbish bin"}, headers=COORD)
    jev_says(monkeypatch, {"Rubbish bin": 0.85, jev.NONE_FIT: 0.1})
    first = post(PANTRY, "need", text="rubsh bn")  # too garbled for fuzzy matching, so the model decides
    post(OTHER, "offer", text="Rubsh Bn")
    assert (first["via"], first["item"]["name"], first["verified"]) == ("model", "Rubbish bin", False)
    guess = client.get(f"{BASE}/admin/guesses", headers=COORD).json()[0]
    assert (guess["via"], guess["count"], guess["candidates"][0]["item"]["name"]) == ("model", 2, "Rubbish bin")
    # The coordinator confirms it and teaches a genuine synonym, typed correctly.
    res = client.post(
        f"{BASE}/admin/entries/{guess['entry_id']}/resolve",
        json={"item_id": "rubbish-bin", "alias_text": "trash can"},
        headers=COORD,
    )
    assert res.status_code == 200
    stored = {a.text for a in store.list_aliases()}
    assert "trash can" in stored and "rubsh bn" not in stored and "Rubsh Bn" not in stored
    assert client.get(f"{BASE}/admin/guesses", headers=COORD).json() == []
    assert client.get(f"{BASE}/locations/{OTHER}").json()["offer"][0]["verified"] is True  # both sides settled
    assert post(PANTRY, "need", text="trash cans")["via"] == "alias"


def test_none_fit_entry_becomes_a_new_item_with_a_fixed_alias(monkeypatch: pytest.MonkeyPatch) -> None:
    jev_says(monkeypatch, {jev.NONE_FIT: 0.9})
    need = post(PANTRY, "need", text="baby crbi")
    post(OTHER, "offer", text="Baby Crbi")
    assert held()[0]["same_wording"] == 2
    res = client.post(
        f"{BASE}/admin/entries/{need['id']}/promote",
        json={"name": "Baby crib", "alias_text": "infant bed"},
        headers=COORD,
    )
    assert res.status_code == 200 and res.json()["item"]["name"] == "Baby crib"
    assert held() == []
    stored = {a.text for a in store.list_aliases()}
    assert {"Baby crib", "infant bed"} <= stored and "baby crbi" not in {s.lower() for s in stored}
    assert client.get(f"{BASE}/locations/{OTHER}/demand").json()[0]["needed_at"][0]["location_id"] == PANTRY


def test_an_alias_clash_is_refused_not_overwritten() -> None:
    entry = post(PANTRY, "need", text="mystery thing")
    res = client.post(
        f"{BASE}/admin/entries/{entry['id']}/resolve",
        json={"item_id": "blankets", "alias_text": "diapers"},  # already means a different item
        headers=COORD,
    )
    assert res.status_code == 409
    assert len(held()) == 1
