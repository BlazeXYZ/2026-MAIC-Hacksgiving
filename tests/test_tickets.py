"""Tests for sample volunteer ticket claiming."""

from collections.abc import Iterator
from concurrent.futures import ThreadPoolExecutor

import pytest
from fastapi.testclient import TestClient

from src.server.main import app


@pytest.fixture
def ticket_client() -> Iterator[TestClient]:
    with TestClient(app) as client:
        yield client


def test_claim_updates_ticket_list(ticket_client: TestClient) -> None:
    response = ticket_client.get("/api/tickets")
    assert response.status_code == 200
    first_ticket, *other_tickets = response.json()
    assert first_ticket["status"] == "open"

    path = f"/api/tickets/{first_ticket['id']}/claim"
    response = ticket_client.post(path)
    assert response.status_code == 200
    claimed_ticket = {**first_ticket, "status": "claimed"}
    assert response.json() == claimed_ticket
    assert ticket_client.get("/api/tickets").json() == [claimed_ticket, *other_tickets]
    assert ticket_client.post(path).status_code == 409


def test_claim_unknown_ticket_returns_404(ticket_client: TestClient) -> None:
    assert ticket_client.post("/api/tickets/999999/claim").status_code == 404


def test_only_one_concurrent_claim_succeeds(ticket_client: TestClient) -> None:
    ticket_id = ticket_client.get("/api/tickets").json()[0]["id"]
    path = f"/api/tickets/{ticket_id}/claim"

    with ThreadPoolExecutor(max_workers=2) as executor:
        first = executor.submit(ticket_client.post, path)
        second = executor.submit(ticket_client.post, path)
        status_codes = sorted([first.result().status_code, second.result().status_code])

    assert status_codes == [200, 409]
