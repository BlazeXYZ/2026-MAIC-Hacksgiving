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
    Boolean,
    DateTime,
    Float,
    Integer,
    String,
    Text,
    create_engine,
)
from sqlalchemy.orm import (
    DeclarativeBase,
    Mapped,
    Session,
    mapped_column,
    sessionmaker,
)

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


def resolve_database_url(url: str | None = None) -> str:
    """Determine the effective database URL, defaulting to SQLite if none provided."""
    target_url = url or getattr(settings, "DATABASE_URL", None)
    if not target_url or not target_url.strip():
        return "sqlite:///dev.db"
    return target_url.strip()


def init_db(url: str | None = None) -> None:
    """Initialize database engine, create tables, and configure sessionmaker."""
    global _engine, _SessionLocal
    db_url = resolve_database_url(url)
    is_sqlite = db_url.startswith("sqlite")

    connect_args = {"check_same_thread": False} if is_sqlite else {}
    _engine = create_engine(db_url, connect_args=connect_args, pool_pre_ping=not is_sqlite)
    _SessionLocal = sessionmaker(bind=_engine, autocommit=False, autoflush=False)

    Base.metadata.create_all(bind=_engine)
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


def close_db() -> None:
    """Dispose of engine and reset sessions."""
    global _engine, _SessionLocal
    if _engine is not None:
        _engine.dispose()
    _engine = None
    _SessionLocal = None
