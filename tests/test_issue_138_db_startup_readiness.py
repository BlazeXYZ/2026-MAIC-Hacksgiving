"""Tests for Issue #138: Database startup and readiness alignment with deployment guide."""

from unittest.mock import patch

import pytest
from fastapi.testclient import TestClient

from src.server.core.config import settings
from src.server.db import init_db
from src.server.main import app, lifespan


def test_liveness_endpoints() -> None:
    """Liveness probe should return alive status with 200 OK."""
    with TestClient(app) as client:
        resp = client.get("/healthz")
        assert resp.status_code == 200
        assert resp.json() == {"status": "alive"}

        resp_api = client.get("/api/healthz")
        assert resp_api.status_code == 200
        assert resp_api.json() == {"status": "alive"}


def test_readiness_and_root_healthy() -> None:
    """Readiness and root endpoints when database is connected."""
    init_db("sqlite:///:memory:")
    with TestClient(app) as client:
        # /ready probe
        ready_resp = client.get("/ready")
        assert ready_resp.status_code == 200
        ready_data = ready_resp.json()
        assert ready_data["status"] == "ready"
        assert ready_data["database"] == "connected"

        # /api/ready probe
        api_ready_resp = client.get("/api/ready")
        assert api_ready_resp.status_code == 200
        assert api_ready_resp.json()["status"] == "ready"

        # Root / liveness & health
        root_resp = client.get("/")
        assert root_resp.status_code == 200
        root_data = root_resp.json()
        assert root_data["status"] == "healthy"
        assert root_data["database"] == "connected"


def test_readiness_and_root_when_database_unavailable() -> None:
    """Readiness probe should return 503 when DB is unavailable, and root should report degraded."""
    with (
        patch("src.server.main.check_db", return_value=(False, "Connection refused")),
        TestClient(app) as client,
    ):
        ready_resp = client.get("/ready")
        assert ready_resp.status_code == 503
        ready_data = ready_resp.json()
        assert ready_data["status"] == "not_ready"
        assert ready_data["database"] == "unavailable"
        assert "Connection refused" in ready_data["detail"]

        root_resp = client.get("/")
        assert root_resp.status_code == 200
        root_data = root_resp.json()
        assert root_data["status"] == "degraded"
        assert root_data["database"] == "unavailable"


def test_database_recovery() -> None:
    """Readiness probe should reflect recovery when database comes back online."""
    with patch("src.server.main.check_db") as mock_check:
        mock_check.return_value = (False, "Connection refused")
        with TestClient(app) as client:
            down_resp = client.get("/ready")
            assert down_resp.status_code == 503
            assert down_resp.json()["status"] == "not_ready"

            # DB recovers
            mock_check.return_value = (True, None)
            up_resp = client.get("/ready")
            assert up_resp.status_code == 200
            assert up_resp.json()["status"] == "ready"
            assert up_resp.json()["database"] == "connected"


@pytest.mark.anyio
async def test_lifespan_dev_tolerates_database_failure() -> None:
    """In development, startup failure in init_db should be logged and not crash the process."""
    with (
        patch.object(settings, "APP_ENV", "development"),
        patch("src.server.main.init_db", side_effect=RuntimeError("DB offline")),
    ):
        async with lifespan(app):
            # Process remains up in degraded mode
            pass


@pytest.mark.anyio
async def test_lifespan_production_fails_on_database_failure() -> None:
    """In production, startup failure in init_db should raise and crash the pod."""
    with (
        patch.object(settings, "APP_ENV", "production"),
        patch("src.server.main.init_db", side_effect=RuntimeError("DB offline")),
        pytest.raises(RuntimeError, match="DB offline"),
    ):
        async with lifespan(app):
            pass
