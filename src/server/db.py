"""PostgreSQL access for the API frame.

The app runs without a database when DATABASE_URL is unset, so unit tests and
UI-only development still start. Docker Compose and Kubernetes always set the URL.
"""

from __future__ import annotations

import logging
import time

from sqlalchemy import String, create_engine, select, text
from sqlalchemy.orm import DeclarativeBase, Mapped, Session, mapped_column, sessionmaker

try:
    from src.server.core.config import settings
except ModuleNotFoundError:
    from core.config import settings

logger = logging.getLogger("comforce.db")

_engine = None
_Session: sessionmaker[Session] | None = None


class Base(DeclarativeBase):
    pass


class Service(Base):
    """A place or program the app can recommend. Feature work fills this in later."""

    __tablename__ = "services"

    id: Mapped[int] = mapped_column(primary_key=True)
    slug: Mapped[str] = mapped_column(String(80), unique=True)
    name: Mapped[str] = mapped_column(String(160))
    category: Mapped[str] = mapped_column(String(80))
    summary: Mapped[str] = mapped_column(String(500))
    address: Mapped[str | None] = mapped_column(String(240), nullable=True)
    phone: Mapped[str | None] = mapped_column(String(40), nullable=True)


_SEED: tuple[dict[str, str], ...] = (
    {
        "slug": "sojourner",
        "name": "Sojourner Family Peace Center",
        "category": "Domestic Safety",
        "summary": "24/7 domestic violence help.",
        "address": "619 W Walnut St, Milwaukee, WI 53212",
        "phone": "414-933-2722",
    },
    {
        "slug": "msoe-public-safety",
        "name": "MSOE Public Safety",
        "category": "Safe Place",
        "summary": "Staffed campus safety office. Lit-route destination on the MSOE campus.",
        "address": "1025 N Broadway, Milwaukee, WI 53202",
        "phone": "414-277-7159",
    },
    {
        "slug": "impact-211",
        "name": "IMPACT 211",
        "category": "Referral",
        "summary": "Community information and referral for food, housing, and crisis support.",
        "address": "Milwaukee County",
        "phone": "211",
    },
)


def init_database(attempts: int = 30, pause_seconds: float = 2.0) -> None:
    """Connect, create tables, and seed placeholder services."""
    global _engine, _Session
    url = settings.DATABASE_URL
    if not url:
        raise RuntimeError("DATABASE_URL is unset")

    last_error: Exception | None = None
    for attempt in range(1, attempts + 1):
        try:
            engine = create_engine(url, pool_pre_ping=True)
            with engine.connect() as connection:
                connection.execute(text("SELECT 1"))
            Base.metadata.create_all(engine)
            _engine = engine
            _Session = sessionmaker(bind=engine)
            _seed()
            logger.info("Database ready on attempt %s", attempt)
            return
        except Exception as exc:
            last_error = exc
            logger.warning("Database not ready (attempt %s/%s): %s", attempt, attempts, exc)
            time.sleep(pause_seconds)
    assert last_error is not None
    raise last_error


def close_database() -> None:
    global _engine, _Session
    if _engine is not None:
        _engine.dispose()
    _engine = None
    _Session = None


def list_services() -> list[dict[str, str | None]]:
    if _Session is None:
        return []
    with _Session() as session:
        rows = session.scalars(select(Service).order_by(Service.name))
        return [
            {
                "slug": row.slug,
                "name": row.name,
                "category": row.category,
                "summary": row.summary,
                "address": row.address,
                "phone": row.phone,
            }
            for row in rows
        ]


def _seed() -> None:
    if _Session is None:
        return
    with _Session() as session:
        already = session.scalar(select(Service.id).limit(1))
        if already is not None:
            return
        session.add_all(Service(**row) for row in _SEED)
        session.commit()
