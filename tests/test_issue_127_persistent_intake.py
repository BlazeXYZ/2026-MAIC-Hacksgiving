"""Issue #127: resident tickets and coordinator updates survive replicas and restart."""

from __future__ import annotations

import tempfile
from collections.abc import Iterator
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from src.server.ai.hotspots import COORDINATOR_API_KEY
from src.server.api.coordinator_assign import router as assign_router
from src.server.api.intake_tickets import router as lookup_router
from src.server.db import close_db, init_db
from src.server.intake.lookup import reset_lookups
from src.server.intake.schema import ServiceCategory, UrgencyLevel
from src.server.intake.store import add_ticket, reset_state


@pytest.fixture
def temporary_database() -> Iterator[str]:
    with tempfile.TemporaryDirectory() as directory:
        url = f"sqlite:///{Path(directory) / 'intake.db'}"
        close_db()
        init_db(url)
        reset_state()
        yield url
        reset_state()
        close_db()


def test_ticket_survives_replica_process_and_restart(
    temporary_database: str,
) -> None:
    ticket = add_ticket(
        urgency=UrgencyLevel.urgent,
        category=ServiceCategory.shelter,
        summary="Synthetic shelter need",
        district="Synthetic District",
        language="en",
        suggested_service_id=None,
    )

    first_app = FastAPI()
    first_app.include_router(lookup_router)
    with TestClient(first_app) as replica_one:
        found = replica_one.get(f"/api/v1/intake/tickets/{ticket.token}")
        assert found.status_code == 200

    close_db()
    init_db(temporary_database)
    reset_lookups()

    second_app = FastAPI()
    second_app.include_router(lookup_router)
    second_app.include_router(assign_router)
    with TestClient(
        second_app,
        headers={"X-Coordinator-Key": COORDINATOR_API_KEY},
    ) as replica_two:
        found = replica_two.get(f"/api/v1/intake/tickets/{ticket.token}")
        assert found.status_code == 200
        assert found.json()["status"] == "pending"

        updated = replica_two.patch(
            f"/api/v1/coordinator/tickets/{ticket.ticket_id}/assign",
            json={"volunteer_id": "vol-1", "status": "assigned"},
        )
        assert updated.status_code == 200
        assert updated.json()["status"] == "assigned"

        resident = replica_two.get(f"/api/v1/intake/tickets/{ticket.token}")
        assert resident.status_code == 200
        assert resident.json()["status"] == "assigned"
        assert [event["status"] for event in resident.json()["timeline"]] == [
            "pending",
            "assigned",
        ]


def test_concurrent_coordinator_claim_has_one_winner(
    temporary_database: str,
) -> None:
    ticket = add_ticket(
        urgency=UrgencyLevel.today,
        category=ServiceCategory.food,
        summary="Synthetic food need",
        district="Synthetic District",
        language="en",
        suggested_service_id=None,
    )

    app = FastAPI()
    app.include_router(assign_router)
    client = TestClient(app, headers={"X-Coordinator-Key": COORDINATOR_API_KEY})
    path = f"/api/v1/coordinator/tickets/{ticket.ticket_id}/assign"

    def claim(volunteer_id: str) -> int:
        return client.patch(
            path,
            json={"volunteer_id": volunteer_id, "status": "assigned"},
        ).status_code

    with ThreadPoolExecutor(max_workers=2) as executor:
        results = list(executor.map(claim, ("vol-1", "vol-2")))

    assert sorted(results) == [200, 409]
