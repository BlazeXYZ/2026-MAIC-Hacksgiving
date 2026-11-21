"""Tests for Issue #131: Gate sample alerts and queue entries behind demo mode."""

from __future__ import annotations

import sys
from pathlib import Path
from unittest.mock import patch

REPO_ROOT = Path(__file__).resolve().parent.parent
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from fastapi.testclient import TestClient

from src.server.ai.hotspots import COORDINATOR_API_KEY
from src.server.core.config import settings
from src.server.db import init_db
from src.server.intake import store
from src.server.main import app


def test_production_mode_does_not_seed_demo_tickets_and_has_no_active_alert() -> None:
    """In production mode with DEMO_MODE=False, startup leaves queue clean and alerts inactive."""
    store._tickets.clear()
    init_db("sqlite:///:memory:")

    with (
        patch.object(settings, "APP_ENV", "production"),
        patch.object(settings, "DEMO_MODE", False),
        TestClient(app) as client,
    ):
        # 1. No demo tickets in queue
        resp = client.get(
            "/api/v1/coordinator/queue",
            headers={"X-Coordinator-Key": COORDINATOR_API_KEY},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert len(data["tickets"]) == 0
        assert data["counts"]["total_open"] == 0

        # 2. Priority alert endpoint returns active=False, simulated=False
        alert_resp = client.get("/api/alerts/priority")
        assert alert_resp.status_code == 200
        alert = alert_resp.json()
        assert alert["active"] is False
        assert alert["simulated"] is False


def test_demo_mode_seeds_tickets_and_marks_alert_simulated() -> None:
    """When DEMO_MODE is True, startup seeds tickets and priority alert is simulated."""
    store._tickets.clear()
    init_db("sqlite:///:memory:")

    with (
        patch.object(settings, "APP_ENV", "development"),
        patch.object(settings, "DEMO_MODE", True),
        TestClient(app) as client,
    ):
        # 1. Demo tickets are present
        resp = client.get(
            "/api/v1/coordinator/queue",
            headers={"X-Coordinator-Key": COORDINATOR_API_KEY},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert len(data["tickets"]) >= 10

        # 2. Priority alert is active and labeled simulated
        alert_resp = client.get("/api/alerts/priority")
        assert alert_resp.status_code == 200
        alert = alert_resp.json()
        assert alert["active"] is True
        assert alert["simulated"] is True


def test_production_with_explicit_demo_mode_override() -> None:
    """Setting DEMO_MODE=True in production explicitly enables demo fixtures."""
    store._tickets.clear()
    init_db("sqlite:///:memory:")

    with (
        patch.object(settings, "APP_ENV", "production"),
        patch.object(settings, "DEMO_MODE", True),
        TestClient(app) as client,
    ):
        alert_resp = client.get("/api/alerts/priority")
        assert alert_resp.json()["active"] is True
        assert alert_resp.json()["simulated"] is True

        resp = client.get(
            "/api/v1/coordinator/queue",
            headers={"X-Coordinator-Key": COORDINATOR_API_KEY},
        )
        assert len(resp.json()["tickets"]) >= 10
