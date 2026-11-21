"""Checks that the demo data behind every hub service is present and synthetic."""

from __future__ import annotations

import re
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from fastapi.testclient import TestClient

from src.server.main import app

# 555 exchange, as AGENTS.md requires: 414-555-0100 through 414-555-0199.
FAKE_PHONE = re.compile(r"^(\+?1[ -]?)?\(?\d{3}\)?[ -]?555[ -]?01\d{2}$")


def test_demo_data_is_present_for_every_service() -> None:
    with TestClient(app) as client:  # the context manager runs startup, which seeds the coordinator queue
        assert len(client.get("/api/communities").json()) >= 5
        assert len(client.get("/api/districts/stats").json()) >= 7
        assert len(client.get("/api/tickets").json()) >= 8
        assert len(client.get("/api/v1/resources/pantries").json()) >= 8
        assert len(client.get("/api/v1/resources/safe-places").json()) >= 9
        assert len(client.get("/api/v1/coordinator/queue").json()["tickets"]) >= 10


def test_demo_phone_numbers_are_synthetic() -> None:
    with TestClient(app) as client:
        for path in ("/api/v1/resources/pantries", "/api/v1/resources/safe-places"):
            for item in client.get(path).json():
                phone = item.get("phone")
                assert phone is None or FAKE_PHONE.match(phone), f"{path}: {item['id']} has a non-555 phone {phone}"


def test_demo_queue_is_seeded_once() -> None:
    with TestClient(app) as client:
        first = client.get("/api/v1/coordinator/queue").json()["tickets"]
    with TestClient(app) as client:  # a second startup must not duplicate the tickets
        second = client.get("/api/v1/coordinator/queue").json()["tickets"]
    tokens = [t["token"] for t in second]
    assert len(tokens) == len(set(tokens))
    assert len(second) == len(first)
