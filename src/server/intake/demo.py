"""Synthetic demo tickets for the in-memory coordinator queue.

Every record is fictional: no names, no street numbers, 555 phone numbers
only. Tokens are fixed so seeding at startup is idempotent.
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

from src.server.intake import store
from src.server.intake.schema import ServiceCategory, TicketStatus, UrgencyLevel

# (token, urgency, category, status, summary, district, language, service, alias, notes, minutes_ago)
_DEMO: tuple[tuple[str, UrgencyLevel, ServiceCategory, TicketStatus, str, str, str, str, str | None, str | None, int], ...] = (
    ("cf-DEMA01", UrgencyLevel.urgent, ServiceCategory.shelter, TicketStatus.pending,
     "Needs a safe place to stay tonight. Cold and no transportation.", "Near West Side", "en",
     "sojourner", None, None, 12),
    ("cf-DEMA02", UrgencyLevel.urgent, ServiceCategory.food, TicketStatus.pending,
     "Infant formula and diapers needed for a single parent without a car.", "Harambee", "en",
     "hunger-task-force-south", None, None, 35),
    ("cf-DEMA03", UrgencyLevel.urgent, ServiceCategory.warmth, TicketStatus.assigned,
     "Family of four with no heat since last night. Needs blankets and a warming room.", "Walker's Point", "es",
     "king-library", "Harbor", "Volunteer on the way with blankets.", 95),
    ("cf-DEMA04", UrgencyLevel.today, ServiceCategory.ride, TicketStatus.pending,
     "Ride to a clinic appointment at 2:30 PM. Uses a walker.", "Walker's Point", "en",
     "comforce-ride-desk", None, None, 140),
    ("cf-DEMA05", UrgencyLevel.today, ServiceCategory.food, TicketStatus.in_progress,
     "Weekly grocery box for a homebound resident.", "Juneautown", "en",
     "hunger-task-force-south", "Maple", "Drop-off window Thursday afternoon.", 300),
    ("cf-DEMA06", UrgencyLevel.today, ServiceCategory.warmth, TicketStatus.pending,
     "Winter coats for two children, sizes child medium and youth large.", "Riverwest", "en",
     "king-library", None, None, 210),
    ("cf-DEMA07", UrgencyLevel.today, ServiceCategory.support, TicketStatus.assigned,
     "Wants someone to talk to about a stressful housing situation.", "Bay View", "en",
     "comforce-support-line", "Lantern", None, 480),
    ("cf-DEMA08", UrgencyLevel.this_week, ServiceCategory.food, TicketStatus.pending,
     "Looking for a pantry that is open on Saturdays.", "Clarke Square", "es",
     "hunger-task-force-south", None, None, 900),
    ("cf-DEMA09", UrgencyLevel.this_week, ServiceCategory.other, TicketStatus.pending,
     "Needs help finding legal aid for a landlord question.", "Avenues West", "en",
     "impact-211", None, None, 1500),
    ("cf-DEMA10", UrgencyLevel.this_week, ServiceCategory.ride, TicketStatus.resolved,
     "Ride to a job interview downtown. Completed.", "Haymarket", "en",
     "comforce-ride-desk", "Cedar", "Completed. Thanks to the driver.", 2900),
)


def seed_demo_tickets(now: datetime | None = None) -> int:
    """Insert missing demo tickets into the in-memory store. Returns the number added."""
    moment = now or datetime.now(timezone.utc)
    added = 0
    for (token, urgency, category, status, summary, district, language,
         service, alias, notes, minutes_ago) in _DEMO:
        if store.get_by_token(token) is not None:
            continue
        created = moment - timedelta(minutes=minutes_ago)
        ticket = store.add_ticket(
            urgency=urgency,
            category=category,
            summary=summary,
            district=district,
            language=language,
            suggested_service_id=service,
            created_at=created,
        )
        # add_ticket issues a random token; swap in the fixed demo token.
        def _apply(t: store.Ticket, token: str = token, status: TicketStatus = status,
                   alias: str | None = alias, notes: str | None = notes, created: datetime = created) -> None:
            old = t.token
            t.token = token
            t.status = status
            if alias:
                t.volunteer_id = f"demo-{alias.lower()}"
                t.volunteer_alias = alias
            t.notes = notes
            if status is not TicketStatus.pending:
                t.timeline.append((created + timedelta(minutes=10), status))
            store._by_token.pop(old, None)
            store._by_token[token] = t.ticket_id

        with store._lock:
            _apply(store._tickets[ticket.ticket_id])
        added += 1
    return added
