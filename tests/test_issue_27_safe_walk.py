"""Issue #27: GET /api/v1/routes/safe-walk."""

import sys
from pathlib import Path

from fastapi import FastAPI
from fastapi.testclient import TestClient

REPO_ROOT = Path(__file__).resolve().parent.parent
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from src.server.api.safe_walk import router
from src.server.resources.places import list_safe_places
from src.server.resources.walk import DIERCKS_HALL

client = TestClient(FastAPI())
client.app.include_router(router)


def test_safe_walk_defaults_to_the_campus_corridor():
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
        params={"origin_lat": 43.045, "origin_lon": -87.907},
    )
    assert campus.status_code == 200, campus.text
    feature = campus.json()
    assert feature["type"] == "Feature"
    assert feature["geometry"]["type"] == "LineString"
    coordinates = feature["geometry"]["coordinates"]
    safety = next(
        place for place in list_safe_places(None, False) if place.id == "msoe_safety"
    )
    assert coordinates[1] == [DIERCKS_HALL[0], DIERCKS_HALL[1]]
    assert coordinates[-1] == [safety.longitude, safety.latitude]
    props = feature["properties"]
    assert props["destination_id"] == "msoe_safety"
    assert props["destination_name"] == safety.name
    assert props["address"] == safety.address
    assert props["lit_corridor"] is True
    assert "Diercks" in props["instructions"][0]
    assert any(point["emergency"] for point in props["checkpoints"])

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
