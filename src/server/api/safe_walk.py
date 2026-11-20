"""GET /api/v1/routes/safe-walk."""

from __future__ import annotations

from fastapi import APIRouter, Query

from src.server.resources.walk import SafeWalkFeature, build_safe_walk

router = APIRouter(prefix="/api/v1/routes", tags=["routes"])


@router.get("/safe-walk", response_model=SafeWalkFeature)
def safe_walk(
    origin_lat: float = Query(..., ge=-90, le=90),
    origin_lon: float = Query(..., ge=-180, le=180),
    destination: str = Query(default="msoe_safety", min_length=1, max_length=40),
) -> SafeWalkFeature:
    """Waypoints toward a staffed stop. Campus origins default to MSOE Public Safety."""
    return build_safe_walk(origin_lat, origin_lon, destination)
