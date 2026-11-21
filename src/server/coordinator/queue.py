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
    urgency: UrgencyLevel | None = None,
    district: str | None = None,
    status: TicketStatus | None = None,
    search: str | None = None,
    sort_by: str | None = None,
    sort_order: str = "desc",
    limit: int = 20,
    offset: int = 0,
) -> tuple[QueuePage, int]:
    wanted_district = (
        district.strip().casefold() if district and district.strip() else None
    )
    everyone = snapshot()

    district_counts: dict[str, dict[str, int]] = {}
    for ticket in everyone:
        d = ticket.district or "Unassigned"
        if d not in district_counts:
            district_counts[d] = {"total": 0, "urgent": 0}
        district_counts[d]["total"] += 1
        if ticket.urgency is UrgencyLevel.urgent:
            district_counts[d]["urgent"] += 1

    matched = []
    search_term = search.strip().casefold() if search and search.strip() else None
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
        if search_term is not None:
            matches_summary = search_term in (ticket.summary or "").casefold()
            matches_token = search_term in (ticket.token or "").casefold()
            matches_id = search_term in (getattr(ticket, "ticket_id", "") or "").casefold()
            matches_alias = search_term in (getattr(ticket, "volunteer_alias", "") or "").casefold()
            if not (matches_summary or matches_token or matches_id or matches_alias):
                continue
        matched.append(ticket)

    if sort_by == "time":
        matched.sort(
            key=lambda t: t.created_at,
            reverse=(sort_order == "desc"),
        )
    else:
        matched.sort(
            key=lambda ticket: (_URGENCY_RANK[ticket.urgency], ticket.created_at),
            reverse=(sort_order == "asc"),
        )

    counts = QueueCounts(
        total_urgent=sum(
            1 for ticket in everyone if ticket.urgency is UrgencyLevel.urgent
        ),
        total_pending=sum(
            1 for ticket in everyone if ticket.status is TicketStatus.pending
        ),
        total_open=sum(
            1 for ticket in everyone if ticket.status is not TicketStatus.resolved
        ),
        total_matching=len(matched),
        district_counts=district_counts,
    )

    page = matched[offset : offset + limit]
    body = QueuePage(
        tickets=[to_coordinator_ticket(ticket) for ticket in page],
        counts=counts,
    )
    return body, len(matched)
