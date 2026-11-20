"""CORS allow-list and security headers."""

import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from fastapi.testclient import TestClient

from src.server.main import app

client = TestClient(app)

_ORIGINS = (
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "capacitor://localhost",
    "http://localhost",
)


def test_preflight_allows_vite_and_capacitor_origins():
    for origin in _ORIGINS:
        response = client.options(
            "/api/v1/intake/survey",
            headers={
                "Origin": origin,
                "Access-Control-Request-Method": "POST",
                "Access-Control-Request-Headers": "content-type",
            },
        )
        assert response.status_code == 200
        assert response.headers["access-control-allow-origin"] == origin
        allow = response.headers["access-control-allow-methods"]
        for method in ("GET", "POST", "PATCH", "OPTIONS"):
            assert method in allow


def test_preflight_rejects_other_origins():
    response = client.options(
        "/api/v1/coordinator/queue",
        headers={
            "Origin": "https://evil.example",
            "Access-Control-Request-Method": "GET",
        },
    )
    assert response.headers.get("access-control-allow-origin") != "https://evil.example"


def test_security_headers_on_json_responses():
    response = client.get("/")
    assert response.status_code == 200
    assert response.headers["x-content-type-options"] == "nosniff"
    assert response.headers["x-frame-options"] == "DENY"
    assert response.headers["referrer-policy"] == "no-referrer"
    assert response.headers["content-type"].startswith("application/json")
