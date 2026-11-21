"""GET /api/v1/resources/safe-places."""

from __future__ import annotations

from fastapi import APIRouter, Query

from src.server.resources.places import list_safe_places
from src.server.resources.schema import SafePlace

router = APIRouter(prefix="/api/v1/resources", tags=["resources"])


@router.get("/safe-places", response_model=list[SafePlace])
def safe_places(
    district: str | None = Query(default=None, max_length=80),
    staffed_only: bool = False,
    include_sample: bool | None = None,
) -> list[SafePlace]:
    """Verified shelters and staffed public places, with lat/lon for Leaflet."""
    return list_safe_places(district, staffed_only, include_sample)
