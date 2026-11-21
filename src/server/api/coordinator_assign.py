"""PATCH /api/v1/coordinator/tickets/{ticket_id}/assign."""

from __future__ import annotations

from fastapi import APIRouter, Depends

from src.server.ai.hotspots import require_coordinator
from src.server.coordinator.assign import assign_ticket
from src.server.coordinator.schema import AssignRequest, CoordinatorTicket

router = APIRouter(
    prefix="/api/v1/coordinator",
    tags=["coordinator"],
    dependencies=[Depends(require_coordinator)],
)


@router.patch("/tickets/{ticket_id}/assign", response_model=CoordinatorTicket)
def assign(ticket_id: str, payload: AssignRequest) -> CoordinatorTicket:
    """Move a ticket one step: pending, assigned, in progress, resolved."""
    return assign_ticket(ticket_id, payload)
