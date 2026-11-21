"""Tests for Issue #130: Require explicitly configured coordinator credentials in deployed environments."""

from __future__ import annotations

import sys
from pathlib import Path
from unittest.mock import patch

REPO_ROOT = Path(__file__).resolve().parent.parent
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from fastapi.testclient import TestClient

from src.server.ai.hotspots import get_coordinator_api_key
from src.server.core.config import settings
from src.server.main import app

SYNTHETIC_KEY = "synth-coord-sec-555"


def test_development_falls_back_to_dev_credential() -> None:
    """In development without configured key, default dev credential works."""
    with (
        patch.object(settings, "APP_ENV", "development"),
        patch.object(settings, "COORDINATOR_API_KEY", None),
        TestClient(app) as client,
    ):
        assert get_coordinator_api_key() == "dev-coordinator-key"

        # Authorized with default dev key
        resp = client.get(
            "/api/v1/coordinator/hotspots",
            headers={"X-Coordinator-Key": "dev-coordinator-key"},
        )
        assert resp.status_code == 200

        # Rejected with wrong key
        bad_resp = client.get(
            "/api/v1/coordinator/hotspots",
            headers={"X-Coordinator-Key": "wrong-key"},
        )
        assert bad_resp.status_code == 403


def test_production_disables_protected_routes_when_credential_missing_or_default() -> None:
    """In production without configured key or with dev default, protected routes return 503."""
    # 1. Missing credential
    with (
        patch.object(settings, "APP_ENV", "production"),
        patch.object(settings, "COORDINATOR_API_KEY", None),
        TestClient(app) as client,
    ):
        assert get_coordinator_api_key() is None

        # Hotspots route disabled
        resp_hotspots = client.get(
            "/api/v1/coordinator/hotspots",
            headers={"X-Coordinator-Key": "dev-coordinator-key"},
        )
        assert resp_hotspots.status_code == 503
        assert "disabled" in resp_hotspots.json()["detail"].lower()

        # Queue route disabled
        resp_queue = client.get(
            "/api/v1/coordinator/queue",
            headers={"X-Coordinator-Key": "dev-coordinator-key"},
        )
        assert resp_queue.status_code == 503

        # Inventory admin route disabled
        resp_inv = client.get(
            "/api/v1/inventory/admin/aliases",
            headers={"X-Coordinator-Key": "dev-coordinator-key"},
        )
        assert resp_inv.status_code == 503

    # 2. Configured with development default string
    with (
        patch.object(settings, "APP_ENV", "production"),
        patch.object(settings, "COORDINATOR_API_KEY", "dev-coordinator-key"),
        TestClient(app) as client,
    ):
        assert get_coordinator_api_key() is None

        resp_hotspots = client.get(
            "/api/v1/coordinator/hotspots",
            headers={"X-Coordinator-Key": "dev-coordinator-key"},
        )
        assert resp_hotspots.status_code == 503


def test_production_accepts_explicit_synthetic_credential() -> None:
    """In production with an explicitly set secret, protected routes work with the secret."""
    with (
        patch.object(settings, "APP_ENV", "production"),
        patch.object(settings, "COORDINATOR_API_KEY", SYNTHETIC_KEY),
        TestClient(app) as client,
    ):
        assert get_coordinator_api_key() == SYNTHETIC_KEY

        # 1. Hotspots route with synthetic key
        resp_hotspots = client.get(
            "/api/v1/coordinator/hotspots",
            headers={"X-Coordinator-Key": SYNTHETIC_KEY},
        )
        assert resp_hotspots.status_code == 200

        # 2. Queue route with synthetic key
        resp_queue = client.get(
            "/api/v1/coordinator/queue",
            headers={"X-Coordinator-Key": SYNTHETIC_KEY},
        )
        assert resp_queue.status_code == 200

        # 3. Inventory admin route with synthetic key
        resp_inv = client.get(
            "/api/v1/inventory/admin/aliases",
            headers={"X-Coordinator-Key": SYNTHETIC_KEY},
        )
        assert resp_inv.status_code == 200

        # 4. Old dev credential fails with 403 Forbidden
        resp_dev = client.get(
            "/api/v1/coordinator/hotspots",
            headers={"X-Coordinator-Key": "dev-coordinator-key"},
        )
        assert resp_dev.status_code == 403

        # 5. Missing header fails with 403 Forbidden
        resp_none = client.get("/api/v1/coordinator/hotspots")
        assert resp_none.status_code == 403
