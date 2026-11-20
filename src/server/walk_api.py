"""Lit walking guide toward a staffed place.

The campus path is a fixed corridor from Diercks Hall to 1025 N Broadway.
Other origins get a straight guide plus a note to stay on main streets.
This is not a turn-by-turn router.
"""

from __future__ import annotations

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field

try:
    from src.server.catalog import (
        CAMPUS_CENTER,
        DIERCKS_HALL,
        MSOE_SAFETY_POINT,
        in_milwaukee,
        near_msoe_campus,
    )
except ModuleNotFoundError:
    from catalog import (
        CAMPUS_CENTER,
        DIERCKS_HALL,
        MSOE_SAFETY_POINT,
        in_milwaukee,
        near_msoe_campus,
    )

router = APIRouter(prefix="/api/v1/routes", tags=["routes"])


class WalkCheckpoint(BaseModel):
    name: str
    latitude: float
    longitude: float
    emergency: bool


class LineStringGeometry(BaseModel):
    type: str = "LineString"
    coordinates: list[list[float]]


class SafeWalkProperties(BaseModel):
    destination_id: str
    destination_name: str
    address: str
    lit_corridor: bool
    instructions: list[str]
    checkpoints: list[WalkCheckpoint]


class SafeWalkFeature(BaseModel):
    type: str = "Feature"
    geometry: LineStringGeometry
    properties: SafeWalkProperties


class _Destination(BaseModel):
    name: str
    address: str
    point: tuple[float, float] = Field(description="longitude, latitude")


_DESTINATIONS = {
    "msoe_safety": _Destination(
        name="MSOE Public Safety",
        address="1025 N Broadway, Milwaukee, WI 53202",
        point=MSOE_SAFETY_POINT,
    ),
    "sojourner": _Destination(
        name="Sojourner Family Peace Center",
        address="619 W Walnut St, Milwaukee, WI 53212",
        point=(-87.919154, 43.052153),
    ),
    "womens_center": _Destination(
        name="Milwaukee Women's Center",
        address="3025 W Mitchell St, Milwaukee, WI 53215",
        point=(-87.95241, 43.01221),
    ),
}


def _campus_walk(
    origin_lat: float, origin_lon: float, destination: _Destination
) -> SafeWalkFeature:
    coordinates = [
        [origin_lon, origin_lat],
        [DIERCKS_HALL[0], DIERCKS_HALL[1]],
        [CAMPUS_CENTER[0], CAMPUS_CENTER[1]],
        [destination.point[0], destination.point[1]],
    ]
    return SafeWalkFeature(
        geometry=LineStringGeometry(coordinates=coordinates),
        properties=SafeWalkProperties(
            destination_id="msoe_safety",
            destination_name=destination.name,
            address=destination.address,
            lit_corridor=True,
            instructions=[
                "Leave through the lit atrium at Diercks Hall.",
                "Stay on the campus walkway toward Broadway.",
                "Public Safety is staffed at 1025 N Broadway.",
            ],
            checkpoints=[
                WalkCheckpoint(
                    name="Diercks Hall Atrium",
                    longitude=DIERCKS_HALL[0],
                    latitude=DIERCKS_HALL[1],
                    emergency=True,
                ),
                WalkCheckpoint(
                    name="Campus Center Front Desk",
                    longitude=CAMPUS_CENTER[0],
                    latitude=CAMPUS_CENTER[1],
                    emergency=False,
                ),
                WalkCheckpoint(
                    name="MSOE Public Safety",
                    longitude=destination.point[0],
                    latitude=destination.point[1],
                    emergency=True,
                ),
            ],
        ),
    )


def _direct_walk(
    origin_lat: float,
    origin_lon: float,
    destination_id: str,
    destination: _Destination,
) -> SafeWalkFeature:
    return SafeWalkFeature(
        geometry=LineStringGeometry(
            coordinates=[
                [origin_lon, origin_lat],
                [destination.point[0], destination.point[1]],
            ]
        ),
        properties=SafeWalkProperties(
            destination_id=destination_id,
            destination_name=destination.name,
            address=destination.address,
            lit_corridor=False,
            instructions=[
                "Use lit main streets. This line is a straight guide, not turn-by-turn directions.",
                f"{destination.name} is the staffed stop at the end of the line.",
            ],
            checkpoints=[
                WalkCheckpoint(
                    name=destination.name,
                    longitude=destination.point[0],
                    latitude=destination.point[1],
                    emergency=True,
                )
            ],
        ),
    )


@router.get("/safe-walk", response_model=SafeWalkFeature)
def safe_walk(
    origin_lat: float = Query(..., ge=-90, le=90),
    origin_lon: float = Query(..., ge=-180, le=180),
    destination: str = Query(..., min_length=1, max_length=40),
) -> SafeWalkFeature:
    if not in_milwaukee(origin_lat, origin_lon):
        raise HTTPException(
            status_code=422, detail="Origin must be inside the Milwaukee area."
        )
    chosen = _DESTINATIONS.get(destination)
    if chosen is None:
        raise HTTPException(
            status_code=422,
            detail="Unknown destination. Use msoe_safety, sojourner, or womens_center.",
        )
    if near_msoe_campus(origin_lat, origin_lon) and destination == "msoe_safety":
        return _campus_walk(origin_lat, origin_lon, chosen)
    return _direct_walk(origin_lat, origin_lon, destination, chosen)
