"""Safe places, pantry hours, and the campus walking guide."""

import sys
import time
from datetime import datetime
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from fastapi.testclient import TestClient

from src.server.catalog import _PANTRY_SEEDS, CHICAGO, is_open, list_pantries
from src.server.main import app

client = TestClient(app)


def test_safe_places_filter_by_district_and_staff():
    everyone = client.get("/api/v1/resources/safe-places")
    assert everyone.status_code == 200
    rows = everyone.json()
    assert {row["id"] for row in rows} >= {"sojourner", "msoe_safety", "womens_center"}
    assert all("latitude" in row and "longitude" in row for row in rows)

    campus = client.get(
        "/api/v1/resources/safe-places", params={"district": "msoe campus"}
    )
    assert [row["id"] for row in campus.json()] == ["msoe_safety"]

    haymarket = client.get(
        "/api/v1/resources/safe-places",
        params={"district": "Haymarket", "staffed_only": True},
    )
    ids = [row["id"] for row in haymarket.json()]
    assert ids == ["sojourner"]
    assert "king_library" not in ids


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
        open_now=None, no_id_required=True, district="Near South Side", at=wednesday
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


def test_safe_walk_campus_corridor_and_city_bounds():
    outside = client.get(
        "/api/v1/routes/safe-walk",
        params={
            "origin_lat": 41.88,
            "origin_lon": -87.63,
            "destination": "msoe_safety",
        },
    )
    assert outside.status_code == 422

    unknown = client.get(
        "/api/v1/routes/safe-walk",
        params={"origin_lat": 43.045, "origin_lon": -87.907, "destination": "home"},
    )
    assert unknown.status_code == 422

    campus = client.get(
        "/api/v1/routes/safe-walk",
        params={
            "origin_lat": 43.045,
            "origin_lon": -87.907,
            "destination": "msoe_safety",
        },
    )
    assert campus.status_code == 200
    feature = campus.json()
    assert feature["type"] == "Feature"
    assert feature["geometry"]["type"] == "LineString"
    coordinates = feature["geometry"]["coordinates"]
    assert coordinates[1] == [-87.90655, 43.04535]
    assert coordinates[-1] == [-87.90745, 43.04385]
    props = feature["properties"]
    assert props["lit_corridor"] is True
    assert props["instructions"]
    assert any(point["emergency"] for point in props["checkpoints"])
    assert "Diercks" in props["instructions"][0]

    away = client.get(
        "/api/v1/routes/safe-walk",
        params={
            "origin_lat": 43.052153,
            "origin_lon": -87.919154,
            "destination": "sojourner",
        },
    )
    assert away.status_code == 200
    assert away.json()["properties"]["lit_corridor"] is False
    assert away.json()["geometry"]["coordinates"][0] == [-87.919154, 43.052153]
