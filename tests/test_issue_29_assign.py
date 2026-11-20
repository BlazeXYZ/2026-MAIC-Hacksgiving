"""Issue #29: PATCH /api/v1/coordinator/tickets/{ticket_id}/assign."""

import sys
from pathlib import Path

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

REPO_ROOT = Path(__file__).resolve().parent.parent
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from src.server.api.coordinator_assign import router
from src.server.intake.schema import ServiceCategory, UrgencyLevel
from src.server.intake.store import add_ticket, reset_state

client = TestClient(FastAPI())
client.app.include_router(router)


@pytest.fixture(autouse=True)
def _clean():
    reset_state()
    yield
    reset_state()


def test_assign_is_atomic_about_claims_and_states():
    ticket = add_ticket(
        urgency=UrgencyLevel.urgent,
        category=ServiceCategory.shelter,
        summary="Need a safe place",
        district="Haymarket",
        language="en",
        suggested_service_id="sojourner",
    )
    path = f"/api/v1/coordinator/tickets/{ticket.ticket_id}/assign"

    first = client.patch(
        path,
        json={
            "volunteer_id": "ada",
            "status": "assigned",
            "notes": "On it at 10 Main St",
        },
    )
    assert first.status_code == 200
    assert first.json()["status"] == "assigned"
    assert first.json()["volunteer_id"] == "ada"
    assert first.json()["volunteer_alias"]
    assert "10 Main St" not in first.text

    conflict = client.patch(path, json={"volunteer_id": "bea", "status": "in_progress"})
    assert conflict.status_code == 409
    assert "another volunteer" in conflict.json()["detail"]

    skipped = client.patch(path, json={"volunteer_id": "ada", "status": "resolved"})
    assert skipped.status_code == 409

    moved = client.patch(path, json={"volunteer_id": "ada", "status": "in_progress"})
    assert moved.status_code == 200
    assert moved.json()["status"] == "in_progress"
    done = client.patch(path, json={"volunteer_id": "ada", "status": "resolved"})
    assert done.status_code == 200
    assert done.json()["status"] == "resolved"

    missing = client.patch(
        "/api/v1/coordinator/tickets/missing/assign",
        json={"volunteer_id": "ada", "status": "assigned"},
    )
    assert missing.status_code == 404
