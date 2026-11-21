"""FastAPI application entry point for the ComforceMKE community platform."""

import logging
from contextlib import asynccontextmanager
from pathlib import Path

import uvicorn
from fastapi import FastAPI, Response, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

try:
    from src.server.ai.advisor import router as advisors_router
except ModuleNotFoundError:
    from ai.advisor import router as advisors_router

try:
    from src.server.core.config import settings
except ModuleNotFoundError:
    from core.config import settings

try:
    from src.server.ai.hotspots import router as coordinator_hotspots_router
except ModuleNotFoundError:
    from ai.hotspots import router as coordinator_hotspots_router

try:
    from src.server.ticket_routes import lifespan as ticket_lifespan
    from src.server.ticket_routes import router as volunteer_ticket_router
except ModuleNotFoundError:
    from ticket_routes import lifespan as ticket_lifespan
    from ticket_routes import router as volunteer_ticket_router

try:
    from src.server.db import check_db, close_db, init_db
except ModuleNotFoundError:
    from db import check_db, close_db, init_db

logger = logging.getLogger("comforce.server")

try:
    from src.server.intake.demo import seed_demo_tickets
except ModuleNotFoundError:
    from intake.demo import seed_demo_tickets

try:
    from src.server.api import mount_feature_routers
except ModuleNotFoundError:
    from api import mount_feature_routers

try:
    from src.server.security import SecurityHeadersMiddleware, install_api_guards
except ModuleNotFoundError:
    from security import SecurityHeadersMiddleware, install_api_guards


@asynccontextmanager
async def lifespan(app: FastAPI):
    try:
        init_db()
        seed_demo_tickets()
    except Exception as exc:
        if settings.APP_ENV == "production":
            logger.error("Database initialization failed at startup in production: %s", exc)
            raise
        logger.warning(
            "Database unavailable at startup in %s environment: %s. Application continuing in degraded mode.",
            settings.APP_ENV,
            exc,
        )
    async with ticket_lifespan(app):
        yield
    close_db()

app = FastAPI(
    title=settings.APP_NAME,
    description="FastAPI backend supporting web and Capacitor mobile clients for ComforceMKE initiatives.",
    version="0.2.0",
    lifespan=lifespan,
)

install_api_guards(app)

# Security headers sit inside CORS so preflight still carries the Vite
# and Capacitor allow-list, including on error responses.
app.add_middleware(SecurityHeadersMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=list(settings.CORS_ORIGINS),
    allow_credentials=True,
    allow_methods=list(settings.CORS_METHODS),
    allow_headers=list(settings.CORS_HEADERS),
    expose_headers=list(settings.CORS_EXPOSE_HEADERS),
)

# Coordinator-only hotspot density endpoints (key-gated, see #41)
app.include_router(coordinator_hotspots_router)
app.include_router(volunteer_ticket_router)
# Pantry stocking advisor endpoints (see #47)
app.include_router(advisors_router)
mount_feature_routers(app)

class HealthResponse(BaseModel):
    status: str
    app_name: str
    environment: str
    database: str = "connected"

class ReadinessResponse(BaseModel):
    status: str
    database: str
    detail: str | None = None

class LivenessResponse(BaseModel):
    status: str = "alive"

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

@app.get("/healthz", response_model=LivenessResponse)
@app.get("/api/healthz", response_model=LivenessResponse)
def liveness():
    """Process liveness probe."""
    return LivenessResponse(status="alive")


@app.get("/ready", response_model=ReadinessResponse)
@app.get("/api/ready", response_model=ReadinessResponse)
def readiness(response: Response):
    """Dependency-aware readiness probe checking database connectivity."""
    is_ready, err = check_db()
    if not is_ready:
        response.status_code = status.HTTP_503_SERVICE_UNAVAILABLE
        return ReadinessResponse(
            status="not_ready",
            database="unavailable",
            detail=err,
        )
    return ReadinessResponse(
        status="ready",
        database="connected",
    )


@app.get("/", response_model=HealthResponse)
def root():
    """Health check endpoint. In dev, reports degraded if database is down."""
    is_ready, _ = check_db()
    db_status = "connected" if is_ready else "unavailable"
    app_status = "healthy" if is_ready else "degraded"
    return HealthResponse(
        status=app_status,
        app_name=settings.APP_NAME,
        environment=settings.APP_ENV,
        database=db_status,
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
        Community(
            id="ride-share",
            name="Neighbor Ride Share",
            category="Mutual Aid",
            description="Match volunteer drivers with neighbors who need a ride to clinics, groceries, or work.",
            active_members=96,
            open_tickets=3,
            has_emergency_alert=False,
        ),
        Community(
            id="warming-centers",
            name="Warming Centers & Winter Gear",
            category="Community Relief",
            description="Find open warming rooms and donate or request coats, blankets, and boots.",
            active_members=174,
            open_tickets=5,
            has_emergency_alert=False,
        ),
    ]

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
        DistrictStat(
            district_name="Walker's Point",
            open_requests=7,
            active_volunteers=10,
            urgency_score=5.6,
        ),
        DistrictStat(
            district_name="Riverwest",
            open_requests=4,
            active_volunteers=13,
            urgency_score=3.0,
        ),
        DistrictStat(
            district_name="Bay View",
            open_requests=2,
            active_volunteers=8,
            urgency_score=1.8,
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
