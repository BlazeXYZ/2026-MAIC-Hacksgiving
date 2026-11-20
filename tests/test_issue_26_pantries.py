"""Issue #26: GET /api/v1/resources/pantries."""

import sys
import time
from datetime import datetime
from pathlib import Path

from fastapi import FastAPI
from fastapi.testclient import TestClient

REPO_ROOT = Path(__file__).resolve().parent.parent
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from src.server.api.pantries import router
from src.server.resources.pantries import (
    _PANTRY_SEEDS,
    CHICAGO,
    is_open,
    list_pantries,
)

client = TestClient(FastAPI())
client.app.include_router(router)


def test_pantry_open_now_follows_chicago_schedule():
    monday = datetime(2026, 11, 16, 10, 0, tzinfo=CHICAGO)
    wednesday = datetime(2026, 11, 18, 11, 0, tzinfo=CHICAGO)
    sunday = datetime(2026, 11, 22, 12, 0, tzinfo=CHICAGO)
    by_id = {seed.place.id: seed.windows for seed in _PANTRY_SEEDS}
    assert is_open(by_id["hunger-task-force-south"], monday) is True
    assert is_open(by_id["hunger-task-force-south"], sunday) is False
    assert is_open(by_id["house-of-peace"], wednesday) is True
    assert is_open(by_id["house-of-peace"], monday) is False

    opened = list_pantries(
        open_now=True, no_id_required=None, district=None, at=wednesday
    )
    assert {row.id for row in opened} == {"hunger-task-force-south", "house-of-peace"}
    no_id = list_pantries(
        open_now=None,
        no_id_required=True,
        district="Near South Side",
        at=wednesday,
    )
    assert [row.id for row in no_id] == ["hunger-task-force-south"]

    started = time.perf_counter()
    response = client.get(
        "/api/v1/resources/pantries",
        params={"district": "Haymarket", "no_id_required": False},
    )
    assert time.perf_counter() - started < 0.05
    assert response.status_code == 200
    body = response.json()
    assert [row["id"] for row in body] == ["house-of-peace"]
    assert "accessibility_notes" in body[0]
    assert isinstance(body[0]["open_now"], bool)
    assert "555" in body[0]["phone"]
