"""Anonymous ticket lookup and its rate limit."""

from __future__ import annotations

import time
from datetime import timezone

from src.server.ai.pii import scrub_pii
from src.server.intake.services import service_for
from src.server.intake.store import Ticket
from src.server.intake.ticket_schema import PublicTicket, TimelineEvent

LOOKUP_LIMIT = 30
LOOKUP_WINDOW_SECONDS = 60.0

_TIMELINE_LABEL = {
    "pending": "Request received",
    "assigned": "A volunteer picked this up",
    "in_progress": "Help is on the way",
    "resolved": "This request is done",
}

_lookups: dict[str, list[float]] = {}


def reset_lookups() -> None:
    _lookups.clear()


def lookup_allowed(client_key: str, now: float | None = None) -> bool:
    """Sliding window for anonymous token lookups."""
    moment = time.monotonic() if now is None else now
    recent = [
        hit
        for hit in _lookups.get(client_key, [])
        if moment - hit < LOOKUP_WINDOW_SECONDS
    ]
    if len(recent) >= LOOKUP_LIMIT:
        _lookups[client_key] = recent
        return False
    recent.append(moment)
    _lookups[client_key] = recent
    return True


def public_view(ticket: Ticket) -> PublicTicket:
    service = service_for(ticket.category)
    return PublicTicket(
        token=ticket.token,
        status=ticket.status,
        urgency=ticket.urgency,
        category=ticket.category,
        summary=scrub_pii(ticket.summary),
        district=ticket.district,
        language=ticket.language,
        assigned_volunteer_alias=ticket.volunteer_alias,
        suggested_service_id=ticket.suggested_service_id,
        service=service,
        timeline=[
            TimelineEvent(
                at=moment.astimezone(timezone.utc).isoformat(),
                status=status,
                label=_TIMELINE_LABEL[status.value],
            )
            for moment, status in ticket.timeline
        ],
    )
