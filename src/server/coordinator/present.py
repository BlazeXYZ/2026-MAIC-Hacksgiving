"""Coordinator view of a ticket. Free text is scrubbed before it leaves."""

from __future__ import annotations

from datetime import timezone

from src.server.ai.pii import scrub_pii
from src.server.coordinator.schema import CoordinatorTicket
from src.server.intake.store import Ticket


def to_coordinator_ticket(ticket: Ticket) -> CoordinatorTicket:
    notes = scrub_pii(ticket.notes) if ticket.notes else None
    return CoordinatorTicket(
        ticket_id=ticket.ticket_id,
        token=ticket.token,
        status=ticket.status,
        urgency=ticket.urgency,
        category=ticket.category,
        summary=scrub_pii(ticket.summary),
        district=ticket.district,
        language=ticket.language,
        suggested_service_id=ticket.suggested_service_id,
        volunteer_id=ticket.volunteer_id,
        volunteer_alias=ticket.volunteer_alias,
        notes=notes,
        created_at=ticket.created_at.astimezone(timezone.utc).isoformat(),
    )
