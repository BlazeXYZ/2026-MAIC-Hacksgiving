"""Tests for backend health check endpoint."""

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
