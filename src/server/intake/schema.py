"""Survey and triage contracts.

Field names match `src/client/src/contracts/intake.ts`. Later intake
endpoints import this module and do not edit it.
"""

from __future__ import annotations

from enum import Enum

from pydantic import BaseModel, Field, field_validator, model_validator


class UrgencyLevel(str, Enum):
    urgent = "urgent"
    today = "today"
    this_week = "this_week"


class ServiceCategory(str, Enum):
    food = "food"
    ride = "ride"
    shelter = "shelter"
    warmth = "warmth"
    support = "support"
    other = "other"


class TicketStatus(str, Enum):
    pending = "pending"
    assigned = "assigned"
    in_progress = "in_progress"
    resolved = "resolved"


class SurveyRequest(BaseModel):
    """What a neighbor sends when they ask for help. No account and no name."""

    selected_options: list[str] = Field(default_factory=list, max_length=12)
    free_text: str | None = Field(default=None, max_length=2000)
    district: str | None = Field(default=None, max_length=80)
    language: str = Field(min_length=2, max_length=40)

    @field_validator("selected_options")
    @classmethod
    def options_are_labels(cls, value: list[str]) -> list[str]:
        cleaned: list[str] = []
        for item in value:
            text = item.strip()
            if not text or len(text) > 80:
                raise ValueError("Each option must be 1 to 80 characters.")
            cleaned.append(text)
        return cleaned

    @field_validator("free_text", "district")
    @classmethod
    def blank_is_missing(cls, value: str | None) -> str | None:
        if value is None:
            return None
        text = value.strip()
        return text or None

    @model_validator(mode="after")
    def need_a_signal(self) -> SurveyRequest:
        if not self.selected_options and not self.free_text:
            raise ValueError("Choose an option or describe what you need.")
        return self


class TriageResult(BaseModel):
    urgency: UrgencyLevel
    category: ServiceCategory
    summary: str = Field(min_length=1, max_length=400)
    suggested_service_id: str | None = Field(default=None, max_length=80)


class ServiceMatch(BaseModel):
    id: str
    name: str
    category: ServiceCategory
    summary: str
    next_step: str


def export_json_schemas() -> dict[str, dict]:
    """JSON Schema for the survey request and the triage result."""
    return {
        "SurveyRequest": SurveyRequest.model_json_schema(),
        "TriageResult": TriageResult.model_json_schema(),
    }
