"""Unknown items work both ways: needs and donations of something new line up once a coordinator names it."""

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
from src.server.inventory import store

PANTRY = "hunger-task-force-south"
OTHER = "house-of-peace"

app = FastAPI()
app.include_router(router)
client = TestClient(app)
COORD = {"X-Coordinator-Key": COORDINATOR_API_KEY}
BASE = "/api/v1/inventory"


@pytest.fixture(autouse=True)
def fresh_store() -> None:
    store.reset()


def post(location: str, kind: str, **body: object) -> dict:
    res = client.post(f"{BASE}/entries", json={"location_id": location, "kind": kind, **body})
    assert res.status_code == 201, res.text
    return res.json()


def held() -> list[dict]:
    return client.get(f"{BASE}/admin/unresolved", headers=COORD).json()


def test_a_need_and_a_donation_of_an_unknown_item_are_both_held() -> None:
    assert post(PANTRY, "need", text="baby crib")["status"] == "held"
    assert post(OTHER, "offer", text="Baby Cribs")["status"] == "held"
    rows = held()
    assert len(rows) == 2
    assert {r["same_wording"] for r in rows} == {2}  # one decision will cover both


def test_promoting_one_entry_makes_a_new_item_and_resolves_both_sides() -> None:
    need = post(PANTRY, "need", text="baby crib")
    post(OTHER, "offer", text="Baby Cribs", quantity=2)
    res = client.post(f"{BASE}/admin/entries/{need['id']}/promote", json={"name": "Baby cribs"}, headers=COORD)
    assert res.status_code == 200 and res.json()["item"]["name"] == "Baby cribs"
    assert held() == []
    new_id = res.json()["item"]["id"]
    assert new_id in {i["id"] for i in client.get(f"{BASE}/catalog").json()}
    # And now the two sides find each other, in both directions.
    needs_view = client.get(f"{BASE}/locations/{PANTRY}/matches").json()
    assert [s["location_id"] for s in needs_view[0]["sources"]] == [OTHER]
    offers_view = client.get(f"{BASE}/locations/{OTHER}/demand").json()
    assert offers_view[0]["item"]["id"] == new_id
    assert [s["location_id"] for s in offers_view[0]["needed_at"]] == [PANTRY]


def test_promote_defaults_the_name_to_the_wording_typed() -> None:
    entry = post(PANTRY, "need", text="space heater")
    res = client.post(f"{BASE}/admin/entries/{entry['id']}/promote", json={}, headers=COORD)
    assert res.json()["item"]["name"] == "Space Heater"


def test_new_wording_matches_instantly_afterwards() -> None:
    entry = post(PANTRY, "need", text="space heater")
    client.post(f"{BASE}/admin/entries/{entry['id']}/promote", json={}, headers=COORD)
    again = post(OTHER, "offer", text="space heaters")  # plural, different place, different direction
    assert (again["status"], again["verified"]) == ("matched", True)


def test_coordinator_can_add_an_item_up_front_and_waiting_entries_link_up() -> None:
    held_need = post(PANTRY, "need", text="car seat")
    held_offer = post(OTHER, "offer", text="child seat")
    res = client.post(f"{BASE}/admin/items", json={"name": "Car seat", "aliases": ["child seat"]}, headers=COORD)
    assert res.status_code == 201
    assert held() == []
    detail = client.get(f"{BASE}/locations/{PANTRY}").json()
    assert detail["need"][0]["id"] == held_need["id"] and detail["need"][0]["item"]["id"] == res.json()["id"]
    assert client.get(f"{BASE}/locations/{OTHER}").json()["offer"][0]["id"] == held_offer["id"]


def test_resolving_one_held_entry_also_resolves_the_same_wording_elsewhere() -> None:
    first = post(PANTRY, "need", text="puffy snow garment")
    post(OTHER, "offer", text="puffy snow garments")
    client.post(f"{BASE}/admin/entries/{first['id']}/resolve", json={"item_id": "winter-coats"}, headers=COORD)
    assert held() == []
    assert client.get(f"{BASE}/locations/{OTHER}").json()["offer"][0]["item"]["id"] == "winter-coats"


def test_a_new_item_cannot_reuse_an_existing_wording() -> None:
    res = client.post(f"{BASE}/admin/items", json={"name": "Diapers"}, headers=COORD)
    assert res.status_code == 409
    res = client.post(f"{BASE}/admin/items", json={"name": "Spare tires", "aliases": ["parka"]}, headers=COORD)
    assert res.status_code == 409
    assert "spare-tires" not in {i["id"] for i in client.get(f"{BASE}/catalog").json()}  # nothing half-created


def test_a_new_item_whose_id_is_taken_gets_a_distinct_id() -> None:
    assert store.get_item("first-aid").name == "First-aid supplies"
    created = store.add_item("First aid")  # different wording, same slug as the seed item
    assert created.id != "first-aid" and created.id.startswith("first-aid")


def test_demand_ignores_needs_at_the_same_place_and_ineligible_places() -> None:
    post(PANTRY, "need", item_id="blankets")
    post(PANTRY, "have", item_id="blankets", quantity=9)
    assert client.get(f"{BASE}/locations/{PANTRY}/demand").json()[0]["needed_at"] == []
    assert client.get(f"{BASE}/locations/sojourner/demand").status_code == 404


def test_new_admin_routes_need_the_coordinator_key() -> None:
    for method, path in [
        ("post", f"{BASE}/admin/items"),
        ("post", f"{BASE}/admin/entries/en-1/promote"),
    ]:
        assert client.request(method, path, json={"name": "x"}).status_code == 403
