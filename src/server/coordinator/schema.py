"""Coordinator queue and assignment contracts."""

from __future__ import annotations

from pydantic import BaseModel, Field, field_validator, model_validator

from src.server.intake.schema import ServiceCategory, TicketStatus, UrgencyLevel


class AssignRequest(BaseModel):
    volunteer_id: str = Field(min_length=1, max_length=80)
    status: TicketStatus
    notes: str | None = Field(default=None, max_length=500)

    @field_validator("volunteer_id", "notes")
    @classmethod
    def strip_text(cls, value: str | None) -> str | None:
        if value is None:
            return None
        text = value.strip()
        return text or None

    @model_validator(mode="after")
    def volunteer_required(self) -> AssignRequest:
        if not self.volunteer_id:
            raise ValueError("volunteer_id is required.")
        return self


class CoordinatorTicket(BaseModel):
    ticket_id: str
    token: str
    status: TicketStatus
    urgency: UrgencyLevel
    category: ServiceCategory
    summary: str
    district: str | None = None
    language: str
    suggested_service_id: str | None = None
    volunteer_id: str | None = None
    volunteer_alias: str | None = None
    notes: str | None = None
    created_at: str


class QueueCounts(BaseModel):
    total_urgent: int
    total_pending: int
    total_open: int = 0
    total_matching: int = 0
    district_counts: dict[str, dict[str, int]] = Field(default_factory=dict)


class QueuePage(BaseModel):
    tickets: list[CoordinatorTicket]
    counts: QueueCounts
