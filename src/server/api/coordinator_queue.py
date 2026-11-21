"""GET /api/v1/coordinator/queue."""

from __future__ import annotations

from fastapi import APIRouter, Depends, Query, Response

from src.server.ai.hotspots import require_coordinator
from src.server.coordinator.queue import queue_page
from src.server.coordinator.schema import QueuePage
from src.server.intake.schema import TicketStatus, UrgencyLevel

router = APIRouter(
    prefix="/api/v1/coordinator",
    tags=["coordinator"],
    dependencies=[Depends(require_coordinator)],
)


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
