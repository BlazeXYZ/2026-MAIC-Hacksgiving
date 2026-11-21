"""Unit tests for Milwaukee dataset database seed script."""

from collections.abc import Generator
from pathlib import Path

import pytest
from sqlalchemy import select

from src.server.db import Resource, Ticket, close_db, get_db
from src.server.seed import (
    FOOD_PANTRIES,
    MILWAUKEE_LAT_MAX,
    MILWAUKEE_LAT_MIN,
    MILWAUKEE_LON_MAX,
    MILWAUKEE_LON_MIN,
    SAFE_PLACES,
    SAMPLE_TICKETS,
    seed_database,
)

TEST_SEED_DB_FILE = Path("test_seed.db")
TEST_SEED_DB_URL = f"sqlite:///{TEST_SEED_DB_FILE}"


@pytest.fixture(autouse=True)
def clean_seed_db() -> Generator[None, None, None]:
    close_db()
    if TEST_SEED_DB_FILE.exists():
        TEST_SEED_DB_FILE.unlink(missing_ok=True)
    yield
    close_db()
    if TEST_SEED_DB_FILE.exists():
        TEST_SEED_DB_FILE.unlink(missing_ok=True)


def test_seed_creates_expected_counts() -> None:
    """Verify first run loads safe places, pantries, and tickets."""
    results = seed_database(TEST_SEED_DB_URL)
    assert results["safe_places_added"] == len(SAFE_PLACES)
    assert results["pantries_added"] == len(FOOD_PANTRIES)
    assert results["tickets_added"] == len(SAMPLE_TICKETS)

    assert results["safe_places_added"] >= 3
    assert results["pantries_added"] >= 10
    assert results["tickets_added"] == 5


def test_seed_is_idempotent() -> None:
    """Running seed_database twice does not duplicate records."""
    first = seed_database(TEST_SEED_DB_URL)
    assert first["safe_places_added"] > 0

    second = seed_database(TEST_SEED_DB_URL)
    assert second["safe_places_added"] == 0
    assert second["pantries_added"] == 0
    assert second["tickets_added"] == 0

    session = next(get_db())
    try:
        total_resources = session.scalars(select(Resource)).all()
        total_tickets = session.scalars(select(Ticket)).all()
    finally:
        session.close()

    assert len(total_resources) == len(SAFE_PLACES) + len(FOOD_PANTRIES)
    assert len(total_tickets) == 5


def test_all_coordinates_within_milwaukee_county() -> None:
    """Verify every resource coordinate is within Milwaukee County bounds."""
    for item in SAFE_PLACES + FOOD_PANTRIES:
        lat = item["latitude"]
        lon = item["longitude"]
        assert (
            MILWAUKEE_LAT_MIN <= lat <= MILWAUKEE_LAT_MAX
        ), f"{item['name']} latitude {lat} outside Milwaukee County"
        assert (
            MILWAUKEE_LON_MIN <= lon <= MILWAUKEE_LON_MAX
        ), f"{item['name']} longitude {lon} outside Milwaukee County"


def test_sample_tickets_span_urgency_tiers() -> None:
    """Verify tickets cover urgent, today, and this_week urgency tiers."""
    urgencies = {t["urgency"] for t in SAMPLE_TICKETS}
    assert "urgent" in urgencies
    assert "today" in urgencies
    assert "this_week" in urgencies
