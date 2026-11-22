"""Database configuration and ORM models for ComforceMKE backend.

Supports zero-setup SQLite for development and PostgreSQL for production.
Tables for tickets, resources, and volunteer actions are created automatically.
"""

from __future__ import annotations

import logging
from collections.abc import Generator
from datetime import datetime, timezone
from typing import Any

from sqlalchemy import (
    JSON,
    Boolean,
    DateTime,
    Float,
    Integer,
    String,
    Text,
    create_engine,
    inspect,
    text,
)
from sqlalchemy.orm import (
    DeclarativeBase,
    Mapped,
    Session,
    close_all_sessions,
    mapped_column,
    sessionmaker,
)
from sqlalchemy.pool import StaticPool

try:
    from src.server.core.config import settings
except ModuleNotFoundError:
    from core.config import settings

logger = logging.getLogger("comforce.db")


class Base(DeclarativeBase):
    pass


class Ticket(Base):
    """Anonymous resident help request ticket."""

    __tablename__ = "tickets"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    ticket_id: Mapped[str | None] = mapped_column(
        String(80), unique=True, index=True, nullable=True
    )
    token: Mapped[str] = mapped_column(String(80), unique=True, index=True, nullable=False)
    status: Mapped[str] = mapped_column(String(40), default="pending", nullable=False)
    urgency: Mapped[str] = mapped_column(String(40), default="today", nullable=False)
    category: Mapped[str] = mapped_column(String(40), default="food", nullable=False)
    summary: Mapped[str] = mapped_column(String(500), nullable=False)
    district: Mapped[str | None] = mapped_column(String(80), nullable=True)
    language: Mapped[str] = mapped_column(String(40), default="en", nullable=False)
    suggested_service_id: Mapped[str | None] = mapped_column(String(80), nullable=True)
    assigned_volunteer_id: Mapped[str | None] = mapped_column(String(80), nullable=True)
    assigned_volunteer_alias: Mapped[str | None] = mapped_column(String(80), nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    timeline: Mapped[list[dict[str, str]]] = mapped_column(
        JSON,
        default=list,
        nullable=False,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )


class Resource(Base):
    """Verified safe places, emergency food pantries, and partner organizations."""

    __tablename__ = "resources"

    id: Mapped[str] = mapped_column(String(80), primary_key=True)
    name: Mapped[str] = mapped_column(String(160), nullable=False)
    category: Mapped[str] = mapped_column(String(40), nullable=False)
    address: Mapped[str] = mapped_column(String(240), nullable=False)
    district: Mapped[str | None] = mapped_column(String(80), nullable=True)
    latitude: Mapped[float] = mapped_column(Float, nullable=False)
    longitude: Mapped[float] = mapped_column(Float, nullable=False)
    phone: Mapped[str | None] = mapped_column(String(40), nullable=True)
    hours_description: Mapped[str | None] = mapped_column(String(240), nullable=True)
    is_staffed: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    no_id_required: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    open_now: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    accessibility_notes: Mapped[str | None] = mapped_column(String(400), nullable=True)


class VolunteerAction(Base):
    """Audit log of volunteer actions on support tickets."""

    __tablename__ = "volunteer_actions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    ticket_token: Mapped[str] = mapped_column(String(80), nullable=False, index=True)
    volunteer_id: Mapped[str] = mapped_column(String(80), nullable=False)
    volunteer_alias: Mapped[str] = mapped_column(String(80), nullable=False)
    action_type: Mapped[str] = mapped_column(String(40), nullable=False)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )


_engine: Any = None
_SessionLocal: sessionmaker[Session] | None = None


def _ensure_ticket_columns() -> None:
    """Add ticket fields to databases created before resident timelines were persisted."""
    assert _engine is not None
    inspector = inspect(_engine)
    columns = {column["name"] for column in inspector.get_columns("tickets")}
    with _engine.begin() as connection:
        if "ticket_id" not in columns:
            if connection.dialect.name == "sqlite":
                connection.execute(text("ALTER TABLE tickets ADD COLUMN ticket_id VARCHAR(80)"))
            else:
                connection.execute(text("ALTER TABLE tickets ADD COLUMN IF NOT EXISTS ticket_id VARCHAR(80)"))
        if "timeline" not in columns:
            if connection.dialect.name == "sqlite":
                connection.execute(text("ALTER TABLE tickets ADD COLUMN timeline JSON"))
            else:
                connection.execute(text("ALTER TABLE tickets ADD COLUMN IF NOT EXISTS timeline JSON"))
        connection.execute(text(
            "CREATE UNIQUE INDEX IF NOT EXISTS ix_tickets_ticket_id "
            "ON tickets (ticket_id)"
        ))


def resolve_database_url(url: str | None = None) -> str:
    """Determine the effective database URL, defaulting to SQLite if none provided."""
    target_url = url or getattr(settings, "DATABASE_URL", None)
    if not target_url or not target_url.strip():
        return "sqlite:///dev.db"
    return target_url.strip()


def init_db(url: str | None = None) -> None:
    """Initialize database engine, create tables, and configure sessionmaker."""
    global _engine, _SessionLocal
    close_db()
    db_url = resolve_database_url(url)
    is_sqlite = db_url.startswith("sqlite")

    connect_args = {"check_same_thread": False} if is_sqlite else {}
    pool_kwargs: dict[str, Any] = {}
    if is_sqlite and ":memory:" in db_url:
        pool_kwargs["poolclass"] = StaticPool
    _engine = create_engine(
        db_url,
        connect_args=connect_args,
        pool_pre_ping=not is_sqlite,
        **pool_kwargs,
    )
    _SessionLocal = sessionmaker(bind=_engine, autocommit=False, autoflush=False)

    Base.metadata.create_all(bind=_engine)
    _ensure_ticket_columns()
    logger.info("Database initialized successfully with URL pattern: %s", db_url.split("@")[-1])


def get_db() -> Generator[Session, None, None]:
    """Yield a database session and close it afterwards."""
    if _SessionLocal is None:
        init_db()
    assert _SessionLocal is not None
    session = _SessionLocal()
    try:
        yield session
    finally:
        session.close()


def check_db() -> tuple[bool, str | None]:
    """Test database connectivity with a lightweight query.

    Returns:
        (True, None) if healthy, or (False, error_message) if degraded/down.
    """
    if _engine is None:
        try:
            init_db()
        except Exception as exc:  # noqa: BLE001
            return False, str(exc)

    try:
        assert _engine is not None
        with _engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        return True, None
    except Exception as exc:  # noqa: BLE001
        return False, str(exc)


def close_db() -> None:
    """Dispose of engine and reset sessions."""
    global _engine, _SessionLocal
    close_all_sessions()
    if _engine is not None:
        _engine.dispose()
    _engine = None
    _SessionLocal = None
