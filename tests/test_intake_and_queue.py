"""Survey intake, anonymous ticket lookup, and the coordinator queue."""

import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from fastapi.testclient import TestClient

from src.server.main import app
from src.server.privacy import scrub

client = TestClient(app)


def _survey(options: list[str], **extra) -> dict:
    payload = {"selected_options": options, "language": "en", "district": "Haymarket"}
    payload.update(extra)
    response = client.post("/api/v1/intake/survey", json=payload)
    assert response.status_code == 201, response.text
    return response.json()


def test_preset_survey_returns_pending_token_and_match():
    body = _survey(["Food", "Today"])
    assert body["status"] == "pending"
    assert body["token"].startswith("cf-")
    assert len(body["token"]) == 9
    assert body["category"] == "food"
    assert body["urgency"] == "today"
    assert body["service"]["id"] == "hunger-task-force-south"
    assert body["suggested_service_id"] == body["service"]["id"]


def test_free_text_invokes_triage_and_maps_words(monkeypatch):
    calls: list[str] = []

    def fake_model(text: str, options: list[str]) -> None:
        calls.append(text)
        assert options == ["Other"]

    monkeypatch.setattr("src.server.triage.call_model", fake_model)
    body = _survey(["Other"], free_text="I am hungry tonight")
    assert calls == ["I am hungry tonight"]
    assert body["category"] == "food"
    assert body["urgency"] == "urgent"
    assert "414" not in body["summary"]


def test_invalid_survey_is_json_422():
    response = client.post("/api/v1/intake/survey", json={"selected_options": []})
    assert response.status_code == 422
    assert response.headers["content-type"].startswith("application/json")
    assert response.headers["x-error-type"] == "validation"
    assert response.json()["detail"]


def test_ticket_lookup_hides_volunteer_id_and_unknown_token_is_404():
    created = _survey(
        ["Talk"], free_text="Please call 414-555-0199 from 10 Main Street"
    )
    missing = client.get("/api/v1/intake/tickets/cf-ZZZZZZ")
    assert missing.status_code == 404
    assert missing.json()["detail"] == "Ticket not found."

    queue = client.get("/api/v1/coordinator/queue").json()
    ticket_id = next(
        row["ticket_id"] for row in queue["tickets"] if row["token"] == created["token"]
    )
    assigned = client.patch(
        f"/api/v1/coordinator/tickets/{ticket_id}/assign",
        json={"volunteer_id": "vol-secret-42", "status": "assigned"},
    )
    assert assigned.status_code == 200

    resident = client.get(f"/api/v1/intake/tickets/{created['token']}")
    assert resident.status_code == 200
    body = resident.json()
    assert body["status"] == "assigned"
    assert body["assigned_volunteer_alias"]
    assert body["assigned_volunteer_alias"] != "vol-secret-42"
    assert "vol-secret-42" not in resident.text
    assert "414-555-0199" not in resident.text
    assert "10 Main Street" not in resident.text
    assert "volunteer_id" not in body
    assert [event["status"] for event in body["timeline"]] == ["pending", "assigned"]


def test_scrub_masks_phone_and_street():
    hidden = scrub("Call 414-555-0199 or come to 10 Main Street tonight")
    assert "414-555-0199" not in hidden
    assert "10 Main Street" not in hidden
    assert "[phone hidden]" in hidden
    assert "[address hidden]" in hidden


def test_ticket_lookup_is_rate_limited(monkeypatch):
    from src.server import tickets

    monkeypatch.setattr(tickets, "LOOKUP_LIMIT", 2)
    assert client.get("/api/v1/intake/tickets/cf-AAAAAA").status_code == 404
    assert client.get("/api/v1/intake/tickets/cf-BBBBBB").status_code == 404
    blocked = client.get("/api/v1/intake/tickets/cf-CCCCCC")
    assert blocked.status_code == 429
    assert blocked.headers["content-type"].startswith("application/json")


def test_queue_orders_filters_and_reports_counts():
    _survey(["Food"])
    urgent = _survey(["Ride", "urgent"], district="Juneautown")
    page = client.get("/api/v1/coordinator/queue", params={"limit": 1})
    assert page.status_code == 200
    assert page.headers["x-total-count"] == "2"
    assert page.headers["x-urgent-count"] == "1"
    assert page.headers["x-pending-count"] == "2"
    body = page.json()
    assert body["counts"]["total_urgent"] == 1
    assert body["counts"]["total_pending"] == 2
    assert len(body["tickets"]) == 1
    assert body["tickets"][0]["token"] == urgent["token"]
    assert body["tickets"][0]["urgency"] == "urgent"

    juneau = client.get("/api/v1/coordinator/queue", params={"district": "juneautown"})
    assert [row["token"] for row in juneau.json()["tickets"]] == [urgent["token"]]
    assert juneau.headers["x-total-count"] == "1"


def test_assign_is_atomic_about_claims_and_states():
    _survey(["Shelter", "urgent"])
    ticket_id = client.get("/api/v1/coordinator/queue").json()["tickets"][0][
        "ticket_id"
    ]
    path = f"/api/v1/coordinator/tickets/{ticket_id}/assign"

    first = client.patch(
        path, json={"volunteer_id": "ada", "status": "assigned", "notes": "On it"}
    )
    assert first.status_code == 200
    assert first.json()["status"] == "assigned"
    assert first.json()["volunteer_id"] == "ada"

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
