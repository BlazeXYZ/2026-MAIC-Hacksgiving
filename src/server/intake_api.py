"""Anonymous survey intake and ticket lookup."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException, Path, Request

try:
    from src.server.catalog import service_for
    from src.server.intake_schema import PublicTicket, SurveyAccepted, SurveyRequest
    from src.server.tickets import (
        create_ticket,
        get_by_token,
        lookup_allowed,
        public_view,
    )
except ModuleNotFoundError:
    from catalog import service_for
    from intake_schema import PublicTicket, SurveyAccepted, SurveyRequest
    from tickets import create_ticket, get_by_token, lookup_allowed, public_view

router = APIRouter(prefix="/api/v1/intake", tags=["intake"])


@router.post("/survey", response_model=SurveyAccepted, status_code=201)
def submit_survey(payload: SurveyRequest) -> SurveyAccepted:
    """Store a pending ticket and return an anonymous tracking token."""
    ticket, result = create_ticket(payload)
    return SurveyAccepted(
        token=ticket.token,
        status=ticket.status,
        urgency=result.urgency,
        category=result.category,
        summary=result.summary,
        suggested_service_id=result.suggested_service_id,
        service=service_for(result.category),
    )


@router.get("/tickets/{token}", response_model=PublicTicket)
def read_ticket(
    request: Request,
    token: str = Path(min_length=4, max_length=32),
) -> PublicTicket:
    """Resident status. Rate-limited so tokens cannot be guessed in a loop."""
    client = request.client.host if request.client else "unknown"
    if not lookup_allowed(client):
        raise HTTPException(
            status_code=429,
            detail="Too many ticket lookups. Try again shortly.",
        )
    ticket = get_by_token(token)
    if ticket is None:
        raise HTTPException(status_code=404, detail="Ticket not found.")
    return public_view(ticket)
