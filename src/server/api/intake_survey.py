"""POST /api/v1/intake/survey."""

from __future__ import annotations

from fastapi import APIRouter

from src.server.ai.pii import scrub_pii
from src.server.intake.schema import SurveyRequest, TriageResult
from src.server.intake.services import service_for
from src.server.intake.store import add_ticket
from src.server.intake.survey_schema import SurveyAccepted
from src.server.intake.triage import triage_survey

router = APIRouter(prefix="/api/v1/intake", tags=["intake"])


@router.post("/triage", response_model=TriageResult)
async def preview_triage(payload: SurveyRequest) -> TriageResult:
    """Classify a draft without creating a ticket."""
    result = await triage_survey(payload)
    return result.model_copy(update={"summary": scrub_pii(result.summary)})


@router.post("/survey", response_model=SurveyAccepted, status_code=201)
async def submit_survey(payload: SurveyRequest) -> SurveyAccepted:
    """Store a pending ticket and return an anonymous tracking token."""
    result = await triage_survey(payload)
    summary = scrub_pii(result.summary)
    ticket = add_ticket(
        urgency=result.urgency,
        category=result.category,
        summary=summary,
        district=payload.district,
        language=payload.language,
        suggested_service_id=result.suggested_service_id,
    )
    return SurveyAccepted(
        token=ticket.token,
        status=ticket.status,
        urgency=result.urgency,
        category=result.category,
        summary=summary,
        suggested_service_id=result.suggested_service_id,
        service=service_for(result.category),
    )
