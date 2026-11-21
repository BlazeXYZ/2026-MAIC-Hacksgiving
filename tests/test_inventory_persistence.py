"""Inventory state survives database-backed process restarts and replica swaps."""

from __future__ import annotations

import sys
from collections.abc import Generator
from pathlib import Path

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

REPO_ROOT = Path(__file__).resolve().parent.parent
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from src.server.ai.hotspots import COORDINATOR_API_KEY
from src.server.api.inventory import router
from src.server.db import close_db, init_db
from src.server.inventory import store

PANTRY = "hunger-task-force-south"
OTHER = "house-of-peace"
BASE = "/api/v1/inventory"
COORD = {"X-Coordinator-Key": COORDINATOR_API_KEY}


def make_app() -> TestClient:
    app = FastAPI()
    app.include_router(router)
    return TestClient(app)


@pytest.fixture(autouse=True)
def database(tmp_path: Path) -> Generator[str, None, None]:
    db_url = f"sqlite:///{tmp_path / 'inventory.db'}"
    init_db(db_url)
    store.reset()
    yield db_url
    close_db()


def test_entries_and_handoffs_persist_across_reinit(database: str) -> None:
    first = make_app()
    need = first.post(
        f"{BASE}/entries",
        json={"location_id": PANTRY, "kind": "need", "quantity": 6, "item_id": "blankets"},
    )
    stock = first.post(
        f"{BASE}/entries",
        json={"location_id": OTHER, "kind": "have", "quantity": 10, "item_id": "blankets"},
    )
    assert need.status_code == stock.status_code == 201

    need_id = need.json()["id"]
    stock_id = stock.json()["id"]
    handoff = first.post(
        f"{BASE}/admin/entries/{stock_id}/handoff",
        headers=COORD,
        json={"quantity": 4, "to_need_id": need_id},
    )
    assert handoff.status_code == 201

    close_db()
    init_db(database)
    second = make_app()

    pantry_need = second.get(f"{BASE}/locations/{PANTRY}").json()["need"]
    other_stock = second.get(f"{BASE}/locations/{OTHER}").json()["have"]
    log = second.get(f"{BASE}/admin/handoffs", headers=COORD).json()
    assert [entry["quantity"] for entry in pantry_need] == [2]
    assert [entry["quantity"] for entry in other_stock] == [6]
    assert len(log) == 1


def test_alias_decision_persists_across_reinit(database: str) -> None:
    first = make_app()
    held = first.post(
        f"{BASE}/entries",
        json={"location_id": PANTRY, "kind": "need", "quantity": 3, "text": "warm blankets"},
    )
    assert held.status_code == 201
    held_id = held.json()["id"]
    resolved = first.post(
        f"{BASE}/admin/entries/{held_id}/resolve",
        headers=COORD,
        json={"item_id": "blankets", "alias_text": "warm blankets"},
    )
    assert resolved.status_code == 200

    close_db()
    init_db(database)
    second = make_app()

    detail = second.get(f"{BASE}/locations/{PANTRY}").json()
    aliases = second.get(f"{BASE}/admin/aliases", headers=COORD).json()
    assert [entry["quantity"] for entry in detail["need"]] == [3]
    assert "warm blankets" in {alias["text"] for alias in aliases}
