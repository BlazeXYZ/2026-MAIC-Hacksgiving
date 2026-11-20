"""Process-local help tickets.

One lock covers insert and update so a claim cannot interleave with a
status change. A later database issue can replace this module.
"""

from __future__ import annotations

import secrets
import threading
from collections.abc import Callable
from dataclasses import dataclass, field
from datetime import datetime, timezone

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


def _token_locked() -> str:
    for _ in range(8):
        candidate = "cf-" + "".join(secrets.choice(_ALPHABET) for _ in range(6))
        if candidate not in _by_token:
            return candidate
    raise RuntimeError("Could not issue a tracking token.")


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
    with _lock:
        ticket_id = _by_token.get(token)
        if ticket_id is None:
            return None
        return _tickets.get(ticket_id)


def snapshot() -> list[Ticket]:
    with _lock:
        return list(_tickets.values())


def mutate(ticket_id: str, update: Callable[[Ticket], None]) -> Ticket:
    """Apply `update` while holding the ticket lock."""
    with _lock:
        ticket = _tickets.get(ticket_id)
        if ticket is None:
            raise TicketNotFound(ticket_id)
        update(ticket)
        return ticket
