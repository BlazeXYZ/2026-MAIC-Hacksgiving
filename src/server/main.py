"""FastAPI application entry point for the ComforceMKE community platform."""

from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from pathlib import Path
from threading import Lock
from typing import Literal

import uvicorn
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, ConfigDict

try:
    from src.server.core.config import settings
except ModuleNotFoundError:
    from core.config import settings


class VolunteerTicket(BaseModel):
    model_config = ConfigDict(frozen=True)

    id: int
    title: str
    description: str
    status: Literal["open", "claimed"] = "open"


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
    app.state.ticket_lock = Lock()
    yield


app = FastAPI(
    title=settings.APP_NAME,
    description="FastAPI backend supporting web and Capacitor mobile clients for ComforceMKE initiatives.",
    version="0.2.0",
    lifespan=lifespan,
)

# Enable CORS for local web development and Capacitor mobile bridge
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class HealthResponse(BaseModel):
    status: str
    app_name: str
    environment: str

class Community(BaseModel):
    id: str
    name: str
    category: str
    description: str
    active_members: int
    open_tickets: int
    has_emergency_alert: bool = False

class PriorityAlert(BaseModel):
    active: bool
    title: str
    location: str
    description: str
    severity: str

class DistrictStat(BaseModel):
    district_name: str
    open_requests: int
    active_volunteers: int
    urgency_score: float

class SafeRouteRequest(BaseModel):
    origin: str
    destination: str | None = None
    on_msoe_campus: bool = False

class SafeRouteResponse(BaseModel):
    recommended_destination: str
    address: str
    phone: str
    route_summary: str
    safe_havens_along_path: list[str]

@app.get("/", response_model=HealthResponse)
def root():
    """Health check endpoint."""
    return HealthResponse(
        status="healthy",
        app_name=settings.APP_NAME,
        environment=settings.APP_ENV,
    )

@app.get("/api/communities", response_model=list[Community])
def list_communities():
    """List available ComforceMKE initiatives and communities."""
    return [
        Community(
            id="domestic-safety",
            name="Domestic Abuse Support",
            category="Crisis Support",
            description="Confidential safety planning, rapid safe haven routing, and discreet emergency contact.",
            active_members=128,
            open_tickets=4,
            has_emergency_alert=False,
        ),
        Community(
            id="missing-persons",
            name="Missing Persons Search Network",
            category="Emergency Response",
            description="Coordinate volunteer search parties, share verified sighting tips, and map cleared search sectors.",
            active_members=310,
            open_tickets=1,
            has_emergency_alert=True,
        ),
        Community(
            id="food-pantry",
            name="Food Pantry & Mutual Aid",
            category="Community Relief",
            description="Locate open food pantries, post surplus community food, and get AI stocking recommendations.",
            active_members=245,
            open_tickets=6,
            has_emergency_alert=False,
        ),
    ]


@app.get("/api/tickets", response_model=list[VolunteerTicket])
def list_tickets(request: Request) -> list[VolunteerTicket]:
    """List sample volunteer tasks and their current claim status."""
    with request.app.state.ticket_lock:
        return list(request.app.state.tickets.values())


@app.post("/api/tickets/{ticket_id}/claim", response_model=VolunteerTicket)
def claim_ticket(ticket_id: int, request: Request) -> VolunteerTicket:
    """Claim a sample volunteer task once per server run."""
    tickets = request.app.state.tickets
    with request.app.state.ticket_lock:
        ticket = tickets.get(ticket_id)
        if ticket is None:
            raise HTTPException(status_code=404, detail="Ticket not found.")
        if ticket.status == "claimed":
            raise HTTPException(status_code=409, detail="Ticket has already been claimed.")
        claimed_ticket = ticket.model_copy(update={"status": "claimed"})
        tickets[ticket_id] = claimed_ticket
        return claimed_ticket


@app.get("/api/alerts/priority", response_model=PriorityAlert)
def get_priority_alert():
    """Get high-priority emergency alerts that override normal community views."""
    return PriorityAlert(
        active=True,
        title="Active Missing Person Search: Near West Side",
        location="Near 27th St & Wisconsin Ave, Milwaukee, WI",
        description="Search parties organizing at Community Center. Volunteers needed for Sector B.",
        severity="high",
    )

@app.get("/api/districts/stats", response_model=list[DistrictStat])
def get_district_stats():
    """Get neighborhood-level assistance statistics for the admin dashboard."""
    return [
        DistrictStat(
            district_name="Third Ward",
            open_requests=3,
            active_volunteers=14,
            urgency_score=2.1,
        ),
        DistrictStat(
            district_name="Juneautown",
            open_requests=5,
            active_volunteers=18,
            urgency_score=3.4,
        ),
        DistrictStat(
            district_name="Near West Side",
            open_requests=12,
            active_volunteers=9,
            urgency_score=8.5,
        ),
        DistrictStat(
            district_name="Bronzeville / Harambee",
            open_requests=9,
            active_volunteers=11,
            urgency_score=7.2,
        ),
    ]

@app.post("/api/routes/safe-path", response_model=SafeRouteResponse)
def calculate_safe_path(request: SafeRouteRequest):
    """Route user to the nearest public safety or community support hub."""
    if request.on_msoe_campus:
        return SafeRouteResponse(
            recommended_destination="MSOE Public Safety",
            address="1025 N. Broadway, Milwaukee, WI 53202",
            phone="414-277-7159",
            route_summary="Stay along lit campus walkways on Broadway toward Diercks Hall.",
            safe_havens_along_path=["Diercks Hall Atrium", "Campus Center Front Desk"],
        )
    return SafeRouteResponse(
        recommended_destination="Sojourner Family Peace Center",
        address="619 W. Walnut St, Milwaukee, WI 53212",
        phone="414-933-2722",
        route_summary="Proceed along well-lit main thoroughfares toward Walnut St.",
        safe_havens_along_path=["King Library Safe Haven", "Neighborhood Fire Station 2"],
    )

if __name__ == "__main__":
    app_module = "src.server.main:app" if Path("src/server").exists() else "main:app"
    uvicorn.run(
        app_module,
        host=settings.HOST,
        port=settings.PORT,
        reload=settings.DEBUG,
    )
