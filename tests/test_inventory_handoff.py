"""Recording a hand-off: stock shrinks, vanishes at zero, and stops showing in "who can help"."""

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
LIBRARY = "king_library"
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


def post(location: str, kind: str, item: str = "blankets", quantity: int = 1) -> str:
    res = client.post(f"{BASE}/entries", json={"location_id": location, "kind": kind, "quantity": quantity, "item_id": item})
    assert res.status_code == 201, res.text
    return res.json()["id"]


def give(entry_id: str, quantity: int, to: str | None = None, headers: dict[str, str] | None = COORD):
    body: dict[str, object] = {"quantity": quantity}
    if to is not None:
        body["to_need_id"] = to
    return client.post(f"{BASE}/admin/entries/{entry_id}/handoff", json=body, headers=headers)


def quantities(location: str, kind: str) -> list[int]:
    return [e["quantity"] for e in client.get(f"{BASE}/locations/{location}").json()[kind]]


def help_sources(location: str) -> list[tuple[str, int]]:
    found = client.get(f"{BASE}/locations/{location}/matches").json()
    return [(s["location_id"], s["quantity"]) for m in found for s in m["sources"]]


def test_a_partial_hand_off_leaves_the_rest() -> None:
    stock = post(OTHER, "have", quantity=20)
    res = give(stock, 5)
    assert res.status_code == 201
    assert (res.json()["quantity"], res.json()["remaining"], res.json()["need_remaining"]) == (5, 15, None)
    assert quantities(OTHER, "have") == [15]


def test_handing_over_everything_makes_the_entry_disappear() -> None:
    stock = post(OTHER, "have", quantity=3)
    assert give(stock, 3).json()["remaining"] == 0
    assert quantities(OTHER, "have") == []
    assert store.get_entry(stock).closed is True


def test_who_can_help_shrinks_then_drops_the_place() -> None:
    post(PANTRY, "need", quantity=4)
    stock = post(OTHER, "have", quantity=20)
    assert help_sources(PANTRY) == [(OTHER, 20)]
    give(stock, 8)
    assert help_sources(PANTRY) == [(OTHER, 12)]  # still helps, with less
    give(stock, 12)
    assert help_sources(PANTRY) == []  # nothing left, so nobody to point at


def test_who_could_use_this_follows_the_same_stock() -> None:
    post(PANTRY, "need", quantity=4)
    stock = post(OTHER, "offer", quantity=6)
    assert client.get(f"{BASE}/locations/{OTHER}/demand").json()[0]["quantity"] == 6
    give(stock, 6)
    assert client.get(f"{BASE}/locations/{OTHER}/demand").json() == []


def test_naming_the_need_shrinks_it_too() -> None:
    need = post(PANTRY, "need", quantity=10)
    stock = post(OTHER, "have", quantity=20)
    res = give(stock, 4, need)
    assert (res.json()["remaining"], res.json()["need_remaining"]) == (16, 6)
    assert res.json()["to_location"] == "Hunger Task Force Southside Community Resource Center"
    assert quantities(PANTRY, "need") == [6]


def test_a_covered_need_closes() -> None:
    need = post(PANTRY, "need", quantity=4)
    stock = post(OTHER, "have", quantity=20)
    assert give(stock, 4, need).json()["need_remaining"] == 0
    assert quantities(PANTRY, "need") == []


def test_handing_over_more_than_was_asked_for_is_fine() -> None:
    need = post(PANTRY, "need", quantity=2)
    stock = post(OTHER, "have", quantity=20)
    res = give(stock, 5, need)
    assert (res.status_code, res.json()["need_remaining"], res.json()["remaining"]) == (201, 0, 15)


def test_the_need_can_be_found_through_who_can_help_and_who_could_use_this() -> None:
    need = post(PANTRY, "need", quantity=4)
    stock = post(OTHER, "offer", quantity=6)
    from_help = client.get(f"{BASE}/locations/{PANTRY}/matches").json()[0]["sources"][0]["entry_id"]
    from_demand = client.get(f"{BASE}/locations/{OTHER}/demand").json()[0]["needed_at"][0]["entry_id"]
    assert from_help == stock and from_demand == need  # the screens can name the exact entry


@pytest.mark.parametrize("quantity", [0, -1])
def test_a_quantity_below_one_is_rejected(quantity: int) -> None:
    stock = post(OTHER, "have", quantity=5)
    assert give(stock, quantity).status_code == 422
    assert quantities(OTHER, "have") == [5]


def test_cannot_give_more_than_the_entry_has() -> None:
    stock = post(OTHER, "have", quantity=5)
    res = give(stock, 6)
    assert res.status_code == 409 and "Only 5 are available" in res.json()["detail"]
    assert quantities(OTHER, "have") == [5]


def test_a_need_cannot_be_handed_over() -> None:
    need = post(PANTRY, "need", quantity=5)
    res = give(need, 1)
    assert res.status_code == 409 and "not a need" in res.json()["detail"]


def test_the_destination_must_be_a_matching_need_at_another_place() -> None:
    stock = post(OTHER, "have", quantity=10)
    same_place = post(OTHER, "need", quantity=2)
    wrong_item = post(PANTRY, "need", item="diapers", quantity=2)
    not_a_need = post(LIBRARY, "have", quantity=2)
    for target, fragment in [(same_place, "same place"), (wrong_item, "different item"), (not_a_need, "to a need")]:
        res = give(stock, 1, target)
        assert res.status_code == 409 and fragment in res.json()["detail"], res.text
    assert give(stock, 1, "en-999").status_code == 404
    assert quantities(OTHER, "have") == [10]  # none of the refused attempts took anything


def test_a_closed_or_expired_entry_cannot_be_handed_over() -> None:
    closed = post(OTHER, "have", quantity=5)
    client.post(f"{BASE}/admin/entries/{closed}/close", headers=COORD)
    assert give(closed, 1).status_code == 409
    later = store.now_utc() + store.TTL["have"] + timedelta(seconds=1)
    live = post(OTHER, "have", quantity=5)
    with pytest.raises(store.InvalidHandoff):
        store.handoff(live, 1, at=later)


def test_an_unknown_entry_is_a_404() -> None:
    assert give("en-404", 1).status_code == 404


def test_only_a_coordinator_can_record_a_hand_off() -> None:
    stock = post(OTHER, "have", quantity=5)
    assert give(stock, 1, headers=None).status_code == 403
    assert give(stock, 1, headers={"X-Coordinator-Key": "wrong"}).status_code == 403
    assert client.get(f"{BASE}/admin/handoffs").status_code == 403
    assert quantities(OTHER, "have") == [5]


def test_the_log_shows_where_what_and_how_many_but_never_who() -> None:
    need = post(PANTRY, "need", quantity=4)
    stock = post(OTHER, "have", quantity=20)
    give(stock, 3)
    give(stock, 4, need)
    log = client.get(f"{BASE}/admin/handoffs", headers=COORD).json()
    assert [(h["quantity"], h["to_location"] is None) for h in log] == [(4, False), (3, True)]  # newest first
    assert log[0]["item"]["name"] == "Blankets" and log[0]["from_location"].startswith("House of Peace")
    assert set(log[0]) == {"id", "item", "quantity", "from_location", "to_location", "remaining", "need_remaining", "at"}


def test_reset_clears_the_log() -> None:
    give(post(OTHER, "have", quantity=5), 1)
    store.reset()
    assert store.list_handoffs() == []
