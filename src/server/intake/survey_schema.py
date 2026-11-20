"""Response body for a survey that was accepted."""

from __future__ import annotations

from pydantic import BaseModel

from src.server.intake.schema import (
    ServiceCategory,
    ServiceMatch,
    TicketStatus,
    UrgencyLevel,
)


class SurveyAccepted(BaseModel):
    token: str
    status: TicketStatus
    urgency: UrgencyLevel
    category: ServiceCategory
    summary: str
    suggested_service_id: str | None = None
    service: ServiceMatch
