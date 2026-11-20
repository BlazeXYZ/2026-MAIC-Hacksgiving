"""Verified safe places for the resident map.

Phones are synthetic 555 numbers. Coordinates are approximate public
locations so a Leaflet pin can be placed.
"""

from __future__ import annotations

from src.server.resources.schema import SafePlace

_SAFE_PLACES: tuple[SafePlace, ...] = (
    SafePlace(
        id="sojourner",
        name="Sojourner Family Peace Center",
        category="shelter",
        address="619 W Walnut St, Milwaukee, WI 53212",
        latitude=43.052153,
        longitude=-87.919154,
        phone="414-555-0101",
        hours_description="24/7 crisis line. Office hours are posted at the desk.",
        is_staffed=True,
        no_id_required=True,
        district="Haymarket",
    ),
    SafePlace(
        id="msoe_safety",
        name="MSOE Public Safety",
        category="public_safety",
        address="1025 N Broadway, Milwaukee, WI 53202",
        latitude=43.04385,
        longitude=-87.90745,
        phone="414-555-0102",
        hours_description="Staffed campus safety desk.",
        is_staffed=True,
        no_id_required=True,
        district="MSOE Campus",
    ),
    SafePlace(
        id="womens_center",
        name="Milwaukee Women's Center",
        category="shelter",
        address="3025 W Mitchell St, Milwaukee, WI 53215",
        latitude=43.01221,
        longitude=-87.95241,
        phone="414-555-0103",
        hours_description="Listed as open around the clock.",
        is_staffed=True,
        no_id_required=True,
        district="Near South Side",
    ),
    SafePlace(
        id="king_library",
        name="King Library Safe Haven",
        category="safe_place",
        address="310 W Locust St, Milwaukee, WI 53212",
        latitude=43.0565,
        longitude=-87.9138,
        phone=None,
        hours_description="Public library lobby during posted library hours.",
        is_staffed=False,
        no_id_required=True,
        district="Haymarket",
    ),
)


def list_safe_places(district: str | None, staffed_only: bool) -> list[SafePlace]:
    wanted = district.strip().casefold() if district and district.strip() else None
    found: list[SafePlace] = []
    for place in _SAFE_PLACES:
        if wanted is not None and place.district.casefold() != wanted:
            continue
        if staffed_only and not place.is_staffed:
            continue
        found.append(place)
    return found
