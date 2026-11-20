"""Safe places and food pantries for the resident map."""

from __future__ import annotations

from fastapi import APIRouter, Query

try:
    from src.server.catalog import list_pantries, list_safe_places
    from src.server.resource_schema import Pantry, SafePlace
except ModuleNotFoundError:
    from catalog import list_pantries, list_safe_places
    from resource_schema import Pantry, SafePlace

router = APIRouter(prefix="/api/v1/resources", tags=["resources"])


@router.get("/safe-places", response_model=list[SafePlace])
def safe_places(
    district: str | None = Query(default=None, max_length=80),
    staffed_only: bool = False,
) -> list[SafePlace]:
    """Verified shelters and staffed public places, with lat/lon for Leaflet."""
    return list_safe_places(district, staffed_only)


@router.get("/pantries", response_model=list[Pantry])
def pantries(
    open_now: bool | None = Query(default=None),
    no_id_required: bool | None = Query(default=None),
    district: str | None = Query(default=None, max_length=80),
) -> list[Pantry]:
    """Emergency food sites. `open_now` uses the seeded weekly schedule in America/Chicago."""
    return list_pantries(
        open_now=open_now,
        no_id_required=no_id_required,
        district=district,
    )
