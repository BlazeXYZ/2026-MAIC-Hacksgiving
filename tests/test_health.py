"""Tests for backend health check endpoint."""

import sys
from pathlib import Path

# Ensure repository root is on sys.path
REPO_ROOT = Path(__file__).resolve().parent.parent
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from fastapi.testclient import TestClient
from src.server.main import app

client = TestClient(app)

def test_root_health():
    response = client.get("/")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"

def test_list_communities():
    response = client.get("/api/communities")
    assert response.status_code == 200
    communities = response.json()
    assert len(communities) >= 3


def test_stack_health_shape():
    response = client.get("/api/health")
    assert response.status_code in (200, 503)
    body = response.json()
    assert body["database"] in ("up", "down", "disabled")
    assert "status" in body


def test_services_follow_database_state():
    health = client.get("/api/health")
    database = health.json()["database"]
    response = client.get("/api/services")
    if database == "up":
        assert response.status_code == 200
        assert isinstance(response.json(), list)
    elif database == "disabled":
        assert response.status_code == 200
        assert response.json() == []
    else:
        assert response.status_code == 503
