"""In-memory help tickets.

The store lives in this process. A later database issue can replace `reset_state`
and the dict without changing the routes. Updates take one lock so a claim and
a status change cannot interleave.
"""

from __future__ import annotations

import secrets
import threading
import time
from dataclasses import dataclass, field
from datetime import datetime, timezone

from fastapi import HTTPException

try:
    from src.server.catalog import service_for
    from src.server.intake_schema import (
        AssignRequest,
        CoordinatorTicket,
        PublicTicket,
        QueueCounts,
        QueuePage,
        ServiceCategory,
        SurveyRequest,
        TicketStatus,
        TimelineEvent,
        TriageResult,
        UrgencyLevel,
    )
    from src.server.privacy import scrub
    from src.server.triage import triage_survey
except ModuleNotFoundError:
    from catalog import service_for
    from intake_schema import (
        AssignRequest,
        CoordinatorTicket,
        PublicTicket,
        QueueCounts,
        QueuePage,
        ServiceCategory,
        SurveyRequest,
        TicketStatus,
        TimelineEvent,
        TriageResult,
        UrgencyLevel,
    )
    from privacy import scrub
    from triage import triage_survey

_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
_ALIASES = (
    "Harbor",
    "Maple",
    "Lantern",
    "Cedar",
    "Brook",
    "Sparrow",
    "Juniper",
    "Willow",
)
_NEXT_STATUS = {
    TicketStatus.pending: TicketStatus.assigned,
    TicketStatus.assigned: TicketStatus.in_progress,
    TicketStatus.in_progress: TicketStatus.resolved,
}
_TIMELINE_LABEL = {
    TicketStatus.pending: "Request received",
    TicketStatus.assigned: "A volunteer picked this up",
    TicketStatus.in_progress: "Help is on the way",
    TicketStatus.resolved: "This request is done",
}
_URGENCY_RANK = {
    UrgencyLevel.urgent: 0,
    UrgencyLevel.today: 1,
    UrgencyLevel.this_week: 2,
}

LOOKUP_LIMIT = 30
LOOKUP_WINDOW_SECONDS = 60.0

_lock = threading.Lock()
_tickets: dict[str, Ticket] = {}
_by_token: dict[str, str] = {}
_lookups: dict[str, list[float]] = {}


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
    """Drop tickets and rate-limit buckets. Tests call this between cases."""
    with _lock:
        _tickets.clear()
        _by_token.clear()
        _lookups.clear()


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _stamp(moment: datetime) -> str:
    return moment.astimezone(timezone.utc).isoformat()


def _token() -> str:
    for _ in range(8):
        candidate = "cf-" + "".join(secrets.choice(_ALPHABET) for _ in range(6))
        if candidate not in _by_token:
            return candidate
    raise HTTPException(
        status_code=503, detail="Could not issue a tracking token. Try again."
    )


def _alias() -> str:
    return secrets.choice(_ALIASES)


def create_ticket(payload: SurveyRequest) -> tuple[Ticket, TriageResult]:
    result = triage_survey(payload)
    summary = scrub(result.summary)
    moment = _now()
    with _lock:
        token = _token()
        ticket = Ticket(
            ticket_id=secrets.token_hex(16),
            token=token,
            status=TicketStatus.pending,
            urgency=result.urgency,
            category=result.category,
            summary=summary,
            district=payload.district,
            language=payload.language,
            suggested_service_id=result.suggested_service_id,
            created_at=moment,
            timeline=[(moment, TicketStatus.pending)],
        )
        _tickets[ticket.ticket_id] = ticket
        _by_token[token] = ticket.ticket_id
    return ticket, result.model_copy(update={"summary": summary})


def lookup_allowed(client_key: str, now: float | None = None) -> bool:
    """Sliding window for anonymous token lookups. False means the caller should get 429."""
    moment = time.monotonic() if now is None else now
    with _lock:
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


def get_by_token(token: str) -> Ticket | None:
    with _lock:
        ticket_id = _by_token.get(token)
        if ticket_id is None:
            return None
        return _tickets.get(ticket_id)


def public_view(ticket: Ticket) -> PublicTicket:
    service = service_for(ticket.category)
    return PublicTicket(
        token=ticket.token,
        status=ticket.status,
        urgency=ticket.urgency,
        category=ticket.category,
        summary=scrub(ticket.summary),
        district=ticket.district,
        language=ticket.language,
        assigned_volunteer_alias=ticket.volunteer_alias,
        suggested_service_id=ticket.suggested_service_id,
        service=service,
        timeline=[
            TimelineEvent(
                at=_stamp(moment), status=status, label=_TIMELINE_LABEL[status]
            )
            for moment, status in ticket.timeline
        ],
    )


def _coordinator_view(ticket: Ticket) -> CoordinatorTicket:
    return CoordinatorTicket(
        ticket_id=ticket.ticket_id,
        token=ticket.token,
        status=ticket.status,
        urgency=ticket.urgency,
        category=ticket.category,
        summary=scrub(ticket.summary),
        district=ticket.district,
        language=ticket.language,
        suggested_service_id=ticket.suggested_service_id,
        volunteer_id=ticket.volunteer_id,
        volunteer_alias=ticket.volunteer_alias,
        notes=scrub(ticket.notes) if ticket.notes else None,
        created_at=_stamp(ticket.created_at),
    )


def queue_page(
    *,
    urgency: UrgencyLevel | None,
    district: str | None,
    status: TicketStatus | None,
    limit: int,
    offset: int,
) -> tuple[QueuePage, int]:
    wanted_district = (
        district.strip().casefold() if district and district.strip() else None
    )
    with _lock:
        everyone = list(_tickets.values())
        counts = QueueCounts(
            total_urgent=sum(
                1 for ticket in everyone if ticket.urgency is UrgencyLevel.urgent
            ),
            total_pending=sum(
                1 for ticket in everyone if ticket.status is TicketStatus.pending
            ),
        )
        matched = []
        for ticket in everyone:
            if urgency is not None and ticket.urgency is not urgency:
                continue
            if status is not None and ticket.status is not status:
                continue
            if (
                wanted_district is not None
                and (ticket.district or "").casefold() != wanted_district
            ):
                continue
            matched.append(ticket)
        matched.sort(
            key=lambda ticket: (_URGENCY_RANK[ticket.urgency], ticket.created_at)
        )
        page = matched[offset : offset + limit]
        body = QueuePage(
            tickets=[_coordinator_view(ticket) for ticket in page], counts=counts
        )
        return body, len(matched)


def assign_ticket(ticket_id: str, payload: AssignRequest) -> CoordinatorTicket:
    with _lock:
        ticket = _tickets.get(ticket_id)
        if ticket is None:
            raise HTTPException(status_code=404, detail="Ticket not found.")
        if ticket.volunteer_id and ticket.volunteer_id != payload.volunteer_id:
            raise HTTPException(
                status_code=409,
                detail="This ticket is already claimed by another volunteer.",
            )
        expected = _NEXT_STATUS.get(ticket.status)
        if expected is None or payload.status is not expected:
            raise HTTPException(
                status_code=409, detail="That status change is not allowed."
            )
        ticket.status = payload.status
        ticket.volunteer_id = payload.volunteer_id
        if ticket.volunteer_alias is None:
            ticket.volunteer_alias = _alias()
        if payload.notes:
            ticket.notes = scrub(payload.notes)
        ticket.timeline.append((_now(), payload.status))
        return _coordinator_view(ticket)
