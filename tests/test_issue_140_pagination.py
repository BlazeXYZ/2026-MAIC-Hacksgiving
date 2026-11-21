"""Tests for Issue #140: coordinator queue pagination, filtering, and counts beyond 20 items."""

from __future__ import annotations

import sys
from datetime import UTC, datetime
from pathlib import Path

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

REPO_ROOT = Path(__file__).resolve().parent.parent
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from src.server.ai.hotspots import COORDINATOR_API_KEY
from src.server.api.coordinator_queue import router
from src.server.intake.schema import ServiceCategory, UrgencyLevel
from src.server.intake.store import add_ticket, reset_state

client = TestClient(FastAPI(), headers={"X-Coordinator-Key": COORDINATOR_API_KEY})
client.app.include_router(router)


@pytest.fixture(autouse=True)
def _clean() -> None:
    reset_state()
    yield
    reset_state()


def test_coordinator_pagination_beyond_20_tickets() -> None:
    now = datetime(2026, 11, 21, 12, 0, tzinfo=UTC)
    for i in range(25):
        add_ticket(
            urgency=UrgencyLevel.urgent if i < 5 else UrgencyLevel.today,
            category=ServiceCategory.food,
            summary=f"Synthetic test request {i} - 555-01{i:02d}",
            district="Harambee" if i % 2 == 0 else "Juneautown",
            language="en",
            suggested_service_id="hunger-task-force-south",
            created_at=now,
        )

    # First page (limit 20)
    page1 = client.get("/api/v1/coordinator/queue", params={"limit": 20, "offset": 0})
    assert page1.status_code == 200
    assert page1.headers["x-total-count"] == "25"
    assert page1.headers["x-urgent-count"] == "5"
    body1 = page1.json()
    assert len(body1["tickets"]) == 20
    assert body1["counts"]["total_urgent"] == 5
    assert body1["counts"]["total_open"] == 25
    assert body1["counts"]["total_matching"] == 25
    assert "Harambee" in body1["counts"]["district_counts"]
    assert "Juneautown" in body1["counts"]["district_counts"]

    # Second page (offset 20)
    page2 = client.get("/api/v1/coordinator/queue", params={"limit": 20, "offset": 20})
    assert page2.status_code == 200
    body2 = page2.json()
    assert len(body2["tickets"]) == 5

    # Filter by search
    searched = client.get("/api/v1/coordinator/queue", params={"search": "request 24"})
    assert searched.status_code == 200
    assert searched.headers["x-total-count"] == "1"
    assert len(searched.json()["tickets"]) == 1
    assert "request 24" in searched.json()["tickets"][0]["summary"]
