"""Issue #23: GET /api/v1/intake/tickets/{token}."""

import sys
from pathlib import Path

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

REPO_ROOT = Path(__file__).resolve().parent.parent
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from src.server.api.intake_tickets import router
from src.server.intake.lookup import reset_lookups
from src.server.intake.schema import ServiceCategory, UrgencyLevel
from src.server.intake.store import add_ticket, reset_state

client = TestClient(FastAPI())
client.app.include_router(router)


@pytest.fixture(autouse=True)
def _clean():
    reset_state()
    reset_lookups()
    yield
    reset_state()
    reset_lookups()


def test_lookup_hides_phone_address_and_volunteer_id():
    ticket = add_ticket(
        urgency=UrgencyLevel.today,
        category=ServiceCategory.support,
        summary="Call 414-555-0199 or come to 10 Main St tonight",
        district="Haymarket",
        language="en",
        suggested_service_id="comforce-support-line",
    )
    ticket.volunteer_id = "vol-secret-42"
    ticket.volunteer_alias = "Harbor"

    missing = client.get("/api/v1/intake/tickets/cf-ZZZZZZ")
    assert missing.status_code == 404
    assert missing.json()["detail"] == "Ticket not found."

    resident = client.get(f"/api/v1/intake/tickets/{ticket.token}")
    assert resident.status_code == 200
    body = resident.json()
    assert body["status"] == "pending"
    assert body["assigned_volunteer_alias"] == "Harbor"
    assert "vol-secret-42" not in resident.text
    assert "414-555-0199" not in resident.text
    assert "10 Main St" not in resident.text
    assert "volunteer_id" not in body
    assert [event["status"] for event in body["timeline"]] == ["pending"]


def test_ticket_lookup_is_rate_limited(monkeypatch):
    monkeypatch.setattr("src.server.intake.lookup.LOOKUP_LIMIT", 2)
    assert client.get("/api/v1/intake/tickets/cf-AAAAAA").status_code == 404
    assert client.get("/api/v1/intake/tickets/cf-BBBBBB").status_code == 404
    blocked = client.get("/api/v1/intake/tickets/cf-CCCCCC")
    assert blocked.status_code == 429
    assert blocked.headers["content-type"].startswith("application/json")
