"""Community resource contracts and GeoJSON helpers.

Latitude and longitude are decimal degrees for a Leaflet marker.
GeoJSON coordinates are `[longitude, latitude]`.
"""

from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field


class CommunityResource(BaseModel):
    id: str = Field(min_length=1, max_length=80)
    name: str = Field(min_length=1, max_length=160)
    category: str = Field(min_length=1, max_length=40)
    address: str = Field(min_length=1, max_length=240)
    latitude: float = Field(ge=-90, le=90)
    longitude: float = Field(ge=-180, le=180)
    phone: str | None = Field(default=None, max_length=40)
    hours_description: str = Field(min_length=1, max_length=240)
    is_staffed: bool
    no_id_required: bool

    def to_feature(self) -> dict[str, Any]:
        return {
            "type": "Feature",
            "id": self.id,
            "geometry": {
                "type": "Point",
                "coordinates": [self.longitude, self.latitude],
            },
            "properties": self.model_dump(),
        }


class SafePlace(CommunityResource):
    district: str = Field(min_length=1, max_length=80)


class Pantry(CommunityResource):
    district: str = Field(min_length=1, max_length=80)
    accessibility_notes: str = Field(min_length=1, max_length=400)
    open_now: bool


def to_feature_collection(resources: list[CommunityResource]) -> dict[str, Any]:
    """Serialize resources as a GeoJSON FeatureCollection of points."""
    return {
        "type": "FeatureCollection",
        "features": [item.to_feature() for item in resources],
    }
