"""Coordinator queue and ticket assignment."""

from __future__ import annotations

from fastapi import APIRouter, Query, Response

try:
    from src.server.intake_schema import (
        AssignRequest,
        CoordinatorTicket,
        QueuePage,
        TicketStatus,
        UrgencyLevel,
    )
    from src.server.tickets import assign_ticket, queue_page
except ModuleNotFoundError:
    from intake_schema import (
        AssignRequest,
        CoordinatorTicket,
        QueuePage,
        TicketStatus,
        UrgencyLevel,
    )
    from tickets import assign_ticket, queue_page

router = APIRouter(prefix="/api/v1/coordinator", tags=["coordinator"])


@router.get("/queue", response_model=QueuePage)
def read_queue(
    response: Response,
    urgency: UrgencyLevel | None = None,
    district: str | None = Query(default=None, max_length=80),
    status: TicketStatus | None = None,
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
) -> QueuePage:
    """Tickets ordered by urgency, then by the time they were submitted."""
    page, filtered_total = queue_page(
        urgency=urgency,
        district=district,
        status=status,
        limit=limit,
        offset=offset,
    )
    response.headers["X-Total-Count"] = str(filtered_total)
    response.headers["X-Urgent-Count"] = str(page.counts.total_urgent)
    response.headers["X-Pending-Count"] = str(page.counts.total_pending)
    return page


@router.patch("/tickets/{ticket_id}/assign", response_model=CoordinatorTicket)
def assign(ticket_id: str, payload: AssignRequest) -> CoordinatorTicket:
    """Claim a ticket or move it one step: pending, assigned, in progress, resolved."""
    return assign_ticket(ticket_id, payload)
