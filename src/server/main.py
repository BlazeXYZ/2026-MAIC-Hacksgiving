"""FastAPI application entry point for the ComforceMKE community platform."""

import logging
from contextlib import asynccontextmanager
from pathlib import Path

import uvicorn
from fastapi import FastAPI, HTTPException
from fastapi.encoders import jsonable_encoder
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel

try:
    from src.server.coordinator_api import router as coordinator_router
    from src.server.core.config import settings
    from src.server.db import close_database, init_database, list_services
    from src.server.hubs import router as hubs_router
    from src.server.intake_api import router as intake_router
    from src.server.resources_api import router as resources_router
    from src.server.security import SecurityHeadersMiddleware
    from src.server.walk_api import router as walk_router
except ModuleNotFoundError:
    from coordinator_api import router as coordinator_router
    from core.config import settings
    from db import close_database, init_database, list_services
    from hubs import router as hubs_router
    from intake_api import router as intake_router
    from resources_api import router as resources_router
    from security import SecurityHeadersMiddleware
    from walk_api import router as walk_router

logger = logging.getLogger("comforce.api")


@asynccontextmanager
async def lifespan(app: FastAPI):
    status = "disabled"
    if settings.DATABASE_URL:
        try:
            init_database()
            status = "up"
        except Exception:
            logger.exception("Database connection failed")
            status = "down"
            app.state.database = status
            if settings.APP_ENV == "production":
                raise
    app.state.database = status
    yield
    close_database()


app = FastAPI(
    title=settings.APP_NAME,
    description="FastAPI backend supporting web and Capacitor mobile clients for ComforceMKE initiatives.",
    version="0.2.0",
    lifespan=lifespan,
)

# Inner middleware first. CORS is added last so it stays the outer wrapper,
# including on error responses and preflight.
app.add_middleware(SecurityHeadersMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=list(settings.CORS_ORIGINS),
    allow_credentials=True,
    allow_methods=list(settings.CORS_METHODS),
    allow_headers=list(settings.CORS_HEADERS),
    expose_headers=list(settings.CORS_EXPOSE_HEADERS),
)

app.include_router(hubs_router)
app.include_router(intake_router)
app.include_router(resources_router)
app.include_router(walk_router)
app.include_router(coordinator_router)


@app.exception_handler(RequestValidationError)
async def validation_error(_request, exc: RequestValidationError) -> JSONResponse:
    return JSONResponse(
        status_code=422,
        content={"detail": jsonable_encoder(exc.errors())},
        headers={"X-Error-Type": "validation"},
    )


@app.exception_handler(HTTPException)
async def http_error(_request, exc: HTTPException) -> JSONResponse:
    headers = {"X-Error-Type": "http"}
    if exc.headers:
        headers.update(exc.headers)
    return JSONResponse(
        status_code=exc.status_code,
        content={"detail": exc.detail},
        headers=headers,
    )

class HealthResponse(BaseModel):
    status: str
    app_name: str
    environment: str


class StackHealth(BaseModel):
    status: str
    app_name: str
    environment: str
    database: str


class ServiceOut(BaseModel):
    slug: str
    name: str
    category: str
    summary: str
    address: str | None = None
    phone: str | None = None

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
    """Process health check. Kubernetes liveness uses this path."""
    return HealthResponse(
        status="healthy",
        app_name=settings.APP_NAME,
        environment=settings.APP_ENV,
    )


@app.get("/api/health", response_model=StackHealth)
def stack_health():
    """Readiness check. Reports whether PostgreSQL is reachable."""
    database = getattr(app.state, "database", "disabled")
    healthy = database in ("up", "disabled")
    payload = StackHealth(
        status="healthy" if healthy else "degraded",
        app_name=settings.APP_NAME,
        environment=settings.APP_ENV,
        database=database,
    )
    return JSONResponse(status_code=200 if healthy else 503, content=payload.model_dump())


@app.get("/api/services", response_model=list[ServiceOut])
def get_services():
    """Services stored in PostgreSQL. Empty until a database is configured."""
    database = getattr(app.state, "database", "disabled")
    if database == "disabled":
        return []
    if database != "up":
        raise HTTPException(status_code=503, detail="Database is unavailable")
    return [ServiceOut.model_validate(row) for row in list_services()]

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
