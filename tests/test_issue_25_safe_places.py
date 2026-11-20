"""Issue #25: GET /api/v1/resources/safe-places."""

import sys
from pathlib import Path

from fastapi import FastAPI
from fastapi.testclient import TestClient

REPO_ROOT = Path(__file__).resolve().parent.parent
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from src.server.api.safe_places import router

client = TestClient(FastAPI())
client.app.include_router(router)


def test_safe_places_filter_by_district_and_staff():
    everyone = client.get("/api/v1/resources/safe-places")
    assert everyone.status_code == 200
    rows = everyone.json()
    assert {row["id"] for row in rows} >= {"sojourner", "msoe_safety", "womens_center"}
    assert all("latitude" in row and "longitude" in row for row in rows)
    for row in rows:
        if row["phone"]:
            assert "555" in row["phone"]

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
