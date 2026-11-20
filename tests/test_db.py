"""Unit tests for local database configuration, models, and table creation."""

from collections.abc import Generator
from pathlib import Path

import pytest
from sqlalchemy import inspect, select

from src.server.db import (
    Resource,
    Ticket,
    VolunteerAction,
    close_db,
    get_db,
    init_db,
    resolve_database_url,
)

TEST_DB_FILE = Path("test_dev.db")
TEST_DB_URL = f"sqlite:///{TEST_DB_FILE}"


@pytest.fixture(autouse=True)
def clean_test_db() -> Generator[None, None, None]:
    """Ensure a clean database before and after each test."""
    close_db()
    if TEST_DB_FILE.exists():
        TEST_DB_FILE.unlink(missing_ok=True)
    yield
    close_db()
    if TEST_DB_FILE.exists():
        TEST_DB_FILE.unlink(missing_ok=True)


def test_resolve_database_url_fallback() -> None:
    """Defaults to sqlite:///dev.db when no URL is provided."""
    assert resolve_database_url(None) == "sqlite:///dev.db"
    assert resolve_database_url("") == "sqlite:///dev.db"
    assert resolve_database_url("   ") == "sqlite:///dev.db"
    assert resolve_database_url("postgresql://user:pass@localhost:5432/db") == "postgresql://user:pass@localhost:5432/db"


def test_init_db_creates_tables_automatically() -> None:
    """Calling init_db automatically creates all required tables."""
    init_db(TEST_DB_URL)
    session = next(get_db())
    inspector = inspect(session.bind)
    tables = inspector.get_table_names()

    assert "tickets" in tables
    assert "resources" in tables
    assert "volunteer_actions" in tables


def test_ticket_crud_operations() -> None:
    """Test creating, reading, and querying tickets in SQLite."""
    init_db(TEST_DB_URL)
    session = next(get_db())

    new_ticket = Ticket(
        token="tok_test_123",
        status="pending",
        urgency="urgent",
        category="shelter",
        summary="Emergency safe shelter needed",
        district="Near West Side",
        language="en",
    )
    session.add(new_ticket)
    session.commit()

    retrieved = session.scalar(select(Ticket).where(Ticket.token == "tok_test_123"))
    assert retrieved is not None
    assert retrieved.token == "tok_test_123"
    assert retrieved.urgency == "urgent"
    assert retrieved.category == "shelter"
    assert retrieved.created_at is not None


def test_resource_crud_operations() -> None:
    """Test inserting and retrieving community resources."""
    init_db(TEST_DB_URL)
    session = next(get_db())

    new_resource = Resource(
        id="safe-place-msoe",
        name="MSOE Public Safety",
        category="Safe Place",
        address="1025 N Broadway, Milwaukee, WI 53202",
        district="East Town",
        latitude=43.0445,
        longitude=-87.9090,
        phone="414-277-7159",
        hours_description="Open 24/7",
        is_staffed=True,
        no_id_required=True,
        open_now=True,
    )
    session.add(new_resource)
    session.commit()

    retrieved = session.scalar(select(Resource).where(Resource.id == "safe-place-msoe"))
    assert retrieved is not None
    assert retrieved.name == "MSOE Public Safety"
    assert retrieved.latitude == 43.0445
    assert retrieved.is_staffed is True


def test_volunteer_action_logging() -> None:
    """Test logging actions performed by volunteers."""
    init_db(TEST_DB_URL)
    session = next(get_db())

    action = VolunteerAction(
        ticket_token="tok_test_123",
        volunteer_id="vol_456",
        volunteer_alias="NeighborCare",
        action_type="claim",
        notes="Claimed ticket for immediate outreach",
    )
    session.add(action)
    session.commit()

    retrieved = session.scalar(
        select(VolunteerAction).where(VolunteerAction.ticket_token == "tok_test_123")
    )
    assert retrieved is not None
    assert retrieved.volunteer_alias == "NeighborCare"
    assert retrieved.action_type == "claim"
