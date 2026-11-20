"""In-memory sample volunteer ticket endpoints."""

from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from secrets import compare_digest
from threading import Lock
from typing import Literal

from fastapi import APIRouter, FastAPI, HTTPException, Request
from pydantic import BaseModel, ConfigDict, Field

router = APIRouter()


class VolunteerTicket(BaseModel):
    model_config = ConfigDict(frozen=True)

    id: int
    title: str
    description: str
    status: Literal["open", "claimed"] = "open"


class TicketClaimKey(BaseModel):
    key: str = Field(pattern=r"^[0-9a-f]{64}$")


SAMPLE_TICKETS = (
    VolunteerTicket(
        id=104,
        title="Pack pantry boxes",
        description="Help pack shelf-stable groceries into boxes for a pantry pickup.",
    ),
    VolunteerTicket(
        id=105,
        title="Sort pantry donations",
        description="Group donated canned goods and dry foods by type.",
    ),
    VolunteerTicket(
        id=106,
        title="Set up a pantry pickup table",
        description="Organize grocery bags and supplies before a pantry pickup.",
    ),
)


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    app.state.tickets = {ticket.id: ticket for ticket in SAMPLE_TICKETS}
    app.state.ticket_claim_keys = {}
    app.state.ticket_lock = Lock()
    yield



@router.get("/api/tickets", response_model=list[VolunteerTicket])
def list_tickets(request: Request) -> list[VolunteerTicket]:
    """List sample volunteer tasks and their current claim status."""
    with request.app.state.ticket_lock:
        return list(request.app.state.tickets.values())


@router.post("/api/tickets/{ticket_id}/claim", response_model=VolunteerTicket)
def claim_ticket(
    ticket_id: int, request: Request, claim: TicketClaimKey | None = None
) -> VolunteerTicket:
    """Claim an open task. Retrying with the same key returns the existing claim."""
    tickets = request.app.state.tickets
    claim_keys = request.app.state.ticket_claim_keys
    with request.app.state.ticket_lock:
        ticket = tickets.get(ticket_id)
        if ticket is None:
            raise HTTPException(status_code=404, detail="Ticket not found.")
        if ticket.status == "claimed":
            if claim and compare_digest(claim_keys.get(ticket_id, ""), claim.key):
                return ticket
            raise HTTPException(status_code=409, detail="Ticket has already been claimed.")
        claimed_ticket = ticket.model_copy(update={"status": "claimed"})
        if claim:
            claim_keys[ticket_id] = claim.key
        tickets[ticket_id] = claimed_ticket
        return claimed_ticket


@router.post("/api/tickets/{ticket_id}/unclaim", response_model=VolunteerTicket)
def unclaim_ticket(
    ticket_id: int, request: Request, claim: TicketClaimKey
) -> VolunteerTicket:
    """Reopen a task when the caller presents the key used to claim it."""
    tickets = request.app.state.tickets
    claim_keys = request.app.state.ticket_claim_keys
    with request.app.state.ticket_lock:
        ticket = tickets.get(ticket_id)
        if ticket is None:
            raise HTTPException(status_code=404, detail="Ticket not found.")
        if ticket.status == "open":
            return ticket
        if not compare_digest(claim_keys.get(ticket_id, ""), claim.key):
            raise HTTPException(status_code=403, detail="The key does not match this claim.")
        open_ticket = ticket.model_copy(update={"status": "open"})
        tickets[ticket_id] = open_ticket
        claim_keys.pop(ticket_id)
        return open_ticket
