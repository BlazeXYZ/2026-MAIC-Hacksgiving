"""GET /api/v1/intake/tickets/{token}."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException, Path, Request

from src.server.intake.lookup import lookup_allowed, public_view
from src.server.intake.store import get_by_token
from src.server.intake.ticket_schema import PublicTicket

router = APIRouter(prefix="/api/v1/intake", tags=["intake"])


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
