"""Lit walking guide toward a staffed place.

Destination name, address, and coordinates come from the safe-places
catalog. The campus corridor adds Diercks Hall and the center walk on
the way to MSOE Public Safety. This is not a turn-by-turn router.
"""

from __future__ import annotations

from fastapi import HTTPException
from pydantic import BaseModel

from src.server.resources.places import list_safe_places
from src.server.resources.schema import SafePlace

# Campus corridor: Diercks Hall atrium, the center walk, then Public Safety.
DIERCKS_HALL = (-87.90655, 43.04535)
CAMPUS_CENTER = (-87.90705, 43.04440)

# Milwaukee County, loose box so a pin just outside the city still fails closed.
_LAT = (42.84, 43.19)
_LON = (-88.07, -87.86)

_WALK_IDS = ("msoe_safety", "sojourner", "womens_center")


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


def in_milwaukee(latitude: float, longitude: float) -> bool:
    lat_min, lat_max = _LAT
    lon_min, lon_max = _LON
    return lat_min <= latitude <= lat_max and lon_min <= longitude <= lon_max


def near_msoe_campus(latitude: float, longitude: float) -> bool:
    return 43.040 <= latitude <= 43.048 and -87.912 <= longitude <= -87.901


def walk_destinations() -> dict[str, SafePlace]:
    """Staffed stops a safe-walk can end at, keyed by catalog id."""
    return {
        place.id: place
        for place in list_safe_places(None, False)
        if place.id in _WALK_IDS
    }


def _campus_walk(
    origin_lat: float, origin_lon: float, place: SafePlace
) -> SafeWalkFeature:
    return SafeWalkFeature(
        geometry=LineStringGeometry(
            coordinates=[
                [origin_lon, origin_lat],
                [DIERCKS_HALL[0], DIERCKS_HALL[1]],
                [CAMPUS_CENTER[0], CAMPUS_CENTER[1]],
                [place.longitude, place.latitude],
            ]
        ),
        properties=SafeWalkProperties(
            destination_id=place.id,
            destination_name=place.name,
            address=place.address,
            lit_corridor=True,
            instructions=[
                "Leave through the lit atrium at Diercks Hall.",
                "Stay on the campus walkway toward Broadway.",
                "Public Safety is staffed at the end of this corridor.",
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
                    name=place.name,
                    longitude=place.longitude,
                    latitude=place.latitude,
                    emergency=True,
                ),
            ],
        ),
    )


def _direct_walk(
    origin_lat: float, origin_lon: float, place: SafePlace
) -> SafeWalkFeature:
    return SafeWalkFeature(
        geometry=LineStringGeometry(
            coordinates=[
                [origin_lon, origin_lat],
                [place.longitude, place.latitude],
            ]
        ),
        properties=SafeWalkProperties(
            destination_id=place.id,
            destination_name=place.name,
            address=place.address,
            lit_corridor=False,
            instructions=[
                "Use lit main streets. This line is a straight guide, not turn-by-turn directions.",
                f"{place.name} is the staffed stop at the end of the line.",
            ],
            checkpoints=[
                WalkCheckpoint(
                    name=place.name,
                    longitude=place.longitude,
                    latitude=place.latitude,
                    emergency=True,
                )
            ],
        ),
    )


def build_safe_walk(
    origin_lat: float, origin_lon: float, destination: str
) -> SafeWalkFeature:
    if not in_milwaukee(origin_lat, origin_lon):
        raise HTTPException(
            status_code=422,
            detail="Origin must be inside the Milwaukee area.",
        )
    chosen = walk_destinations().get(destination)
    if chosen is None:
        raise HTTPException(
            status_code=422,
            detail="Unknown destination. Use msoe_safety, sojourner, or womens_center.",
        )
    if near_msoe_campus(origin_lat, origin_lon) and destination == "msoe_safety":
        return _campus_walk(origin_lat, origin_lon, chosen)
    return _direct_walk(origin_lat, origin_lon, chosen)
