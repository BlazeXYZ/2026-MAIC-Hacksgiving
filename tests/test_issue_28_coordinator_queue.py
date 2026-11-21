"""Issue #28: GET /api/v1/coordinator/queue."""

import sys
from datetime import datetime, timezone
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
anonymous = TestClient(client.app)


@pytest.fixture(autouse=True)
def _clean():
    reset_state()
    yield
    reset_state()


def test_queue_orders_filters_scrubs_and_reports_counts():
    earlier = datetime(2026, 11, 20, 15, 0, tzinfo=timezone.utc)  # noqa: UP017
    later = datetime(2026, 11, 20, 16, 0, tzinfo=timezone.utc)  # noqa: UP017
    add_ticket(
        urgency=UrgencyLevel.today,
        category=ServiceCategory.food,
        summary="Groceries",
        district="Haymarket",
        language="en",
        suggested_service_id="hunger-task-force-south",
        created_at=earlier,
    )
    urgent = add_ticket(
        urgency=UrgencyLevel.urgent,
        category=ServiceCategory.ride,
        summary="Call 414-555-0199 from 10 Main St",
        district="Juneautown",
        language="en",
        suggested_service_id="comforce-ride-desk",
        created_at=later,
    )

    page = client.get("/api/v1/coordinator/queue", params={"limit": 1})
    assert page.status_code == 200
    assert page.headers["x-total-count"] == "2"
    assert page.headers["x-urgent-count"] == "1"
    assert page.headers["x-pending-count"] == "2"
    body = page.json()
    assert body["counts"]["total_urgent"] == 1
    assert body["counts"]["total_pending"] == 2
    assert len(body["tickets"]) == 1
    assert body["tickets"][0]["token"] == urgent.token
    assert body["tickets"][0]["urgency"] == "urgent"
    assert "414-555-0199" not in page.text
    assert "10 Main St" not in page.text

    juneau = client.get("/api/v1/coordinator/queue", params={"district": "juneautown"})
    assert [row["token"] for row in juneau.json()["tickets"]] == [urgent.token]
    assert juneau.headers["x-total-count"] == "1"


def test_queue_requires_coordinator_key():
    assert anonymous.get("/api/v1/coordinator/queue").status_code == 403
    wrong = anonymous.get(
        "/api/v1/coordinator/queue", headers={"X-Coordinator-Key": "wrong-key"}
    )
    assert wrong.status_code == 403
