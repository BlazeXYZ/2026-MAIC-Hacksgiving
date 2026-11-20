"""Claim a ticket and walk it through the allowed status steps."""

from __future__ import annotations

import secrets
from datetime import datetime, timezone

from fastapi import HTTPException

from src.server.ai.pii import scrub_pii
from src.server.coordinator.present import to_coordinator_ticket
from src.server.coordinator.schema import AssignRequest, CoordinatorTicket
from src.server.intake.schema import TicketStatus
from src.server.intake.store import Ticket, TicketNotFound, mutate

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


def assign_ticket(ticket_id: str, payload: AssignRequest) -> CoordinatorTicket:
    def apply(ticket: Ticket) -> None:
        if ticket.volunteer_id and ticket.volunteer_id != payload.volunteer_id:
            raise HTTPException(
                status_code=409,
                detail="This ticket is already claimed by another volunteer.",
            )
        expected = _NEXT_STATUS.get(ticket.status)
        if expected is None or payload.status is not expected:
            raise HTTPException(
                status_code=409,
                detail="That status change is not allowed.",
            )
        ticket.status = payload.status
        ticket.volunteer_id = payload.volunteer_id
        if ticket.volunteer_alias is None:
            ticket.volunteer_alias = secrets.choice(_ALIASES)
        if payload.notes:
            ticket.notes = scrub_pii(payload.notes)
        ticket.timeline.append((datetime.now(timezone.utc), payload.status))

    try:
        ticket = mutate(ticket_id, apply)
    except TicketNotFound:
        raise HTTPException(status_code=404, detail="Ticket not found.") from None
    return to_coordinator_ticket(ticket)
