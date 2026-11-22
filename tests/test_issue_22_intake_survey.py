"""Issue #22: POST /api/v1/intake/survey."""

import sys
from pathlib import Path

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

REPO_ROOT = Path(__file__).resolve().parent.parent
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from src.server.ai.schemas import TriageOutputSchema
from src.server.api.intake_survey import router
from src.server.intake.store import reset_state, snapshot

client = TestClient(FastAPI())
client.app.include_router(router)


@pytest.fixture(autouse=True)
def _clean_tickets():
    reset_state()
    yield
    reset_state()


def test_triage_preview_does_not_create_a_ticket() -> None:
    response = client.post(
        "/api/v1/intake/triage",
        json={"selected_options": ["Food", "Today"], "language": "en"},
    )

    assert response.status_code == 200, response.text
    assert response.json()["category"] == "food"
    assert response.json()["urgency"] == "today"
    assert "token" not in response.json()
    assert snapshot() == []


def test_preset_survey_returns_pending_token_and_skips_the_model(monkeypatch):
    async def fail(self, text, prompt_builder=None):
        raise AssertionError(text)

    monkeypatch.setattr("src.server.ai.client.TriageLLMClient.triage", fail)
    response = client.post(
        "/api/v1/intake/survey",
        json={
            "selected_options": ["Food", "Today"],
            "language": "en",
            "district": "Haymarket",
        },
    )
    assert response.status_code == 201, response.text
    body = response.json()
    assert body["status"] == "pending"
    assert body["token"].startswith("cf-")
    assert len(body["token"]) == 9
    assert body["category"] == "food"
    assert body["urgency"] == "today"
    assert body["service"]["id"] == "hunger-task-force-south"
    assert body["suggested_service_id"] == body["service"]["id"]


def test_free_text_is_scrubbed_before_the_model_and_in_the_summary(monkeypatch):
    seen: list[str] = []

    async def fake(self, text, prompt_builder=None):
        seen.append(text)
        return TriageOutputSchema(
            category="shelter",
            urgency="today",
            explanation="Call 414-555-0199 from 10 Main St tonight.",
            escalate=False,
        )

    monkeypatch.setattr("src.server.intake.triage.TriageLLMClient.triage", fake)
    response = client.post(
        "/api/v1/intake/survey",
        json={
            "selected_options": ["Other"],
            "language": "en",
            "free_text": "I am hungry tonight, call 414-555-0199 from 10 Main St",
        },
    )
    assert response.status_code == 201, response.text
    assert seen
    assert "414-555-0199" not in seen[0]
    assert "10 Main St" not in seen[0]
    assert "hungry" in seen[0]
    body = response.json()
    assert body["category"] == "shelter"
    assert "414-555-0199" not in body["summary"]
    assert "10 Main St" not in body["summary"]


def test_model_failure_falls_back_to_keyword_rules(monkeypatch):
    async def boom(self, text, prompt_builder=None):
        raise RuntimeError("offline")

    monkeypatch.setattr("src.server.intake.triage.TriageLLMClient.triage", boom)
    response = client.post(
        "/api/v1/intake/survey",
        json={
            "selected_options": ["Other"],
            "language": "en",
            "free_text": "I am hungry tonight",
        },
    )
    assert response.status_code == 201, response.text
    body = response.json()
    assert body["category"] == "food"
    assert body["urgency"] == "urgent"


def test_invalid_survey_is_json_422():
    response = client.post("/api/v1/intake/survey", json={"selected_options": []})
    assert response.status_code == 422
    assert response.headers["content-type"].startswith("application/json")
    assert response.json()["detail"]
