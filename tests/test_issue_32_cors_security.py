"""Issue #32: CORS allow-list and security headers."""

import sys
from collections.abc import Awaitable, Callable
from pathlib import Path
from typing import get_type_hints

REPO_ROOT = Path(__file__).resolve().parent.parent
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from fastapi import HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from fastapi.testclient import TestClient
from starlette.responses import Response

from src.server.main import app
from src.server.security import (
    SecurityHeadersMiddleware,
    http_error,
    validation_error,
)

client = TestClient(app)

_ORIGINS = (
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "capacitor://localhost",
    "https://localhost",
    "http://localhost",
)


def test_preflight_allows_vite_and_capacitor_origins():
    for origin in _ORIGINS:
        response = client.options(
            "/",
            headers={
                "Origin": origin,
                "Access-Control-Request-Method": "POST",
                "Access-Control-Request-Headers": "content-type",
            },
        )
        assert response.status_code == 200
        assert response.headers["access-control-allow-origin"] == origin
        allow = response.headers["access-control-allow-methods"]
        for method in ("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"):
            assert method in allow


def test_preflight_rejects_other_origins():
    response = client.options(
        "/",
        headers={
            "Origin": "https://evil.example",
            "Access-Control-Request-Method": "GET",
        },
    )
    assert response.headers.get("access-control-allow-origin") != "https://evil.example"


def test_native_coordinator_preflight_allows_staff_header() -> None:
    for origin in ("https://localhost", "capacitor://localhost"):
        response = client.options(
            "/api/v1/coordinator/queue",
            headers={
                "Origin": origin,
                "Access-Control-Request-Method": "GET",
                "Access-Control-Request-Headers": "x-coordinator-key",
            },
        )
        assert response.status_code == 200
        assert response.headers["access-control-allow-origin"] == origin
        assert "x-coordinator-key" in response.headers["access-control-allow-headers"].lower()


def test_security_headers_allow_geolocation_for_this_origin():
    response = client.get("/")
    assert response.status_code == 200
    assert response.headers["content-type"].startswith("application/json")
    assert response.headers["x-content-type-options"] == "nosniff"
    assert response.headers["x-frame-options"] == "DENY"
    assert response.headers["referrer-policy"] == "no-referrer"
    policy = response.headers["permissions-policy"]
    assert "geolocation=(self)" in policy
    assert "camera=()" in policy


def test_validation_errors_are_json_with_a_type_header():
    response = client.post("/api/routes/safe-path", json={})
    assert response.status_code == 422
    assert response.headers["content-type"].startswith("application/json")
    assert response.headers["x-error-type"] == "validation"
    assert response.json()["detail"]


def test_guard_functions_are_fully_typed():
    dispatch = get_type_hints(SecurityHeadersMiddleware.dispatch)
    assert dispatch["request"] is Request
    assert dispatch["call_next"] == Callable[[Request], Awaitable[Response]]
    assert dispatch["return"] is Response

    validation = get_type_hints(validation_error)
    assert validation["request"] is Request
    assert validation["exc"] is RequestValidationError
    assert validation["return"] is JSONResponse

    http = get_type_hints(http_error)
    assert http["request"] is Request
    assert http["exc"] is HTTPException
    assert http["return"] is JSONResponse
