"""GET /api/v1/resources/pantries."""

from __future__ import annotations

from fastapi import APIRouter, Query

from src.server.resources.pantries import list_pantries
from src.server.resources.schema import Pantry

router = APIRouter(prefix="/api/v1/resources", tags=["resources"])


@router.get("/pantries", response_model=list[Pantry])
def pantries(
    open_now: bool | None = Query(default=None),
    no_id_required: bool | None = Query(default=None),
    district: str | None = Query(default=None, max_length=80),
    include_sample: bool | None = Query(default=None),
) -> list[Pantry]:
    """Emergency food sites. `open_now` uses the seeded weekly schedule."""
    return list_pantries(
        open_now=open_now,
        no_id_required=no_id_required,
        district=district,
        include_sample=include_sample,
    )
