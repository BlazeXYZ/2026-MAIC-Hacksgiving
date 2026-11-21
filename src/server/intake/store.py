"""Persistent help tickets shared by every API replica."""

from __future__ import annotations

import secrets
import threading
from collections.abc import Callable
from dataclasses import dataclass, field
from datetime import datetime, timezone

from sqlalchemy import select

from src.server import db as database
from src.server.db import Ticket as DbTicket
from src.server.intake.schema import ServiceCategory, TicketStatus, UrgencyLevel

_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"

_lock = threading.Lock()
_tickets: dict[str, Ticket] = {}
_by_token: dict[str, str] = {}


class TicketNotFound(Exception):
    """Raised when a ticket id is not in this process."""


@dataclass
class Ticket:
    ticket_id: str
    token: str
    status: TicketStatus
    urgency: UrgencyLevel
    category: ServiceCategory
    summary: str
    district: str | None
    language: str
    suggested_service_id: str | None
    created_at: datetime
    volunteer_id: str | None = None
    volunteer_alias: str | None = None
    notes: str | None = None
    timeline: list[tuple[datetime, TicketStatus]] = field(default_factory=list)


def reset_state() -> None:
    """Drop every ticket. Tests call this between cases."""
    with _lock:
        _tickets.clear()
        _by_token.clear()
    if database._SessionLocal is not None:
        session = database._SessionLocal()
        try:
            session.query(DbTicket).delete()
            session.commit()
        finally:
            session.close()


def _token_locked() -> str:
    for _ in range(8):
        candidate = "cf-" + "".join(secrets.choice(_ALPHABET) for _ in range(6))
        if candidate not in _by_token:
            return candidate
    raise RuntimeError("Could not issue a tracking token.")


def _aware(moment: datetime) -> datetime:
    if moment.tzinfo is None:
        return moment.replace(tzinfo=timezone.utc)
    return moment.astimezone(timezone.utc)


def _timeline(row: DbTicket) -> list[tuple[datetime, TicketStatus]]:
    stored = getattr(row, "timeline", None)
    if stored:
        return [
            (_aware(datetime.fromisoformat(event["at"])), TicketStatus(event["status"]))
            for event in stored
        ]
    moment = _aware(row.created_at)
    return [(moment, TicketStatus(row.status))]


def _from_row(row: DbTicket) -> Ticket:
    ticket_id = row.ticket_id or str(row.id)
    if row.ticket_id is None:
        row.ticket_id = ticket_id
    return Ticket(
        ticket_id=ticket_id,
        token=row.token,
        status=TicketStatus(row.status),
        urgency=UrgencyLevel(row.urgency),
        category=ServiceCategory(row.category),
        summary=row.summary,
        district=row.district,
        language=row.language,
        suggested_service_id=row.suggested_service_id,
        created_at=_aware(row.created_at),
        volunteer_id=row.assigned_volunteer_id,
        volunteer_alias=row.assigned_volunteer_alias,
        notes=row.notes,
        timeline=_timeline(row),
    )


def _session_available() -> bool:
    return database._SessionLocal is not None


def add_ticket(
    *,
    urgency: UrgencyLevel,
    category: ServiceCategory,
    summary: str,
    district: str | None,
    language: str,
    suggested_service_id: str | None,
    created_at: datetime | None = None,
) -> Ticket:
    moment = created_at or datetime.now(timezone.utc)
    if _session_available():
        session = database._SessionLocal()
        try:
            for _ in range(8):
                token = "cf-" + "".join(secrets.choice(_ALPHABET) for _ in range(6))
                if session.scalar(select(DbTicket).where(DbTicket.token == token)) is not None:
                    continue
                row = DbTicket(
                    ticket_id=secrets.token_hex(16),
                    token=token,
                    status=TicketStatus.pending.value,
                    urgency=urgency.value,
                    category=category.value,
                    summary=summary,
                    district=district,
                    language=language,
                    suggested_service_id=suggested_service_id,
                    created_at=_aware(moment),
                    timeline=[
                        {"at": _aware(moment).isoformat(), "status": TicketStatus.pending.value}
                    ],
                )
                session.add(row)
                session.commit()
                session.refresh(row)
                ticket = _from_row(row)
                with _lock:
                    _tickets[ticket.ticket_id] = ticket
                    _by_token[ticket.token] = ticket.ticket_id
                return ticket
            raise RuntimeError("Could not issue a tracking token.")
        except Exception:
            session.rollback()
            raise
        finally:
            session.close()

    with _lock:
        token = _token_locked()
        ticket = Ticket(
            ticket_id=secrets.token_hex(16),
            token=token,
            status=TicketStatus.pending,
            urgency=urgency,
            category=category,
            summary=summary,
            district=district,
            language=language,
            suggested_service_id=suggested_service_id,
            created_at=moment,
            timeline=[(moment, TicketStatus.pending)],
        )
        _tickets[ticket.ticket_id] = ticket
        _by_token[token] = ticket.ticket_id
        return ticket


def get_by_token(token: str) -> Ticket | None:
    if _session_available():
        session = database._SessionLocal()
        try:
            row = session.query(DbTicket).filter(DbTicket.token == token).first()
            return None if row is None else _from_row(row)
        finally:
            session.close()
    with _lock:
        ticket_id = _by_token.get(token)
        if ticket_id is None:
            return None
        return _tickets.get(ticket_id)


def snapshot() -> list[Ticket]:
    if _session_available():
        session = database._SessionLocal()
        try:
            rows = session.query(DbTicket).all()
            for row in rows:
                if row.ticket_id is None:
                    row.ticket_id = secrets.token_hex(16)
            session.commit()
            return [_from_row(row) for row in rows]
        finally:
            session.close()
    with _lock:
        return list(_tickets.values())


def mutate(ticket_id: str, update: Callable[[Ticket], None]) -> Ticket:
    """Apply `update` while holding the ticket lock."""
    if _session_available():
        session = database._SessionLocal()
        try:
            query = session.query(DbTicket).filter(DbTicket.ticket_id == ticket_id)
            if session.bind.dialect.name != "sqlite":
                query = query.with_for_update()
            row = query.first()
            if row is None:
                raise TicketNotFound(ticket_id)
            ticket = _from_row(row)
            update(ticket)
            row.status = ticket.status.value
            row.assigned_volunteer_id = ticket.volunteer_id
            row.assigned_volunteer_alias = ticket.volunteer_alias
            row.notes = ticket.notes
            row.token = ticket.token
            row.updated_at = datetime.now(timezone.utc)
            row.timeline = [
                {"at": moment.isoformat(), "status": status.value}
                for moment, status in ticket.timeline
            ]
            session.commit()
            session.refresh(row)
            result = _from_row(row)
            with _lock:
                _tickets[result.ticket_id] = result
                _by_token[result.token] = result.ticket_id
            return result
        except TicketNotFound:
            session.rollback()
            raise
        except Exception:
            session.rollback()
            raise
        finally:
            session.close()

    with _lock:
        ticket = _tickets.get(ticket_id)
        if ticket is None:
            raise TicketNotFound(ticket_id)
        update(ticket)
        return ticket
