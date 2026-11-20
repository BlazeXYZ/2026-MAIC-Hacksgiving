"""Filter and page the coordinator queue."""

from __future__ import annotations

from src.server.coordinator.present import to_coordinator_ticket
from src.server.coordinator.schema import QueueCounts, QueuePage
from src.server.intake.schema import TicketStatus, UrgencyLevel
from src.server.intake.store import snapshot

_URGENCY_RANK = {
    UrgencyLevel.urgent: 0,
    UrgencyLevel.today: 1,
    UrgencyLevel.this_week: 2,
}


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
    everyone = snapshot()
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
    matched.sort(key=lambda ticket: (_URGENCY_RANK[ticket.urgency], ticket.created_at))
    page = matched[offset : offset + limit]
    body = QueuePage(
        tickets=[to_coordinator_ticket(ticket) for ticket in page],
        counts=counts,
    )
    return body, len(matched)
