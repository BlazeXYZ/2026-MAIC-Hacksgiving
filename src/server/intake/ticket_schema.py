"""Resident-facing ticket view. No volunteer ids, phones, or street addresses."""

from __future__ import annotations

from pydantic import BaseModel

from src.server.intake.schema import (
    ServiceCategory,
    ServiceMatch,
    TicketStatus,
    UrgencyLevel,
)


class TimelineEvent(BaseModel):
    at: str
    status: TicketStatus
    label: str


class PublicTicket(BaseModel):
    token: str
    status: TicketStatus
    urgency: UrgencyLevel
    category: ServiceCategory
    summary: str
    district: str | None = None
    language: str
    assigned_volunteer_alias: str | None = None
    suggested_service_id: str | None = None
    service: ServiceMatch
    timeline: list[TimelineEvent]
