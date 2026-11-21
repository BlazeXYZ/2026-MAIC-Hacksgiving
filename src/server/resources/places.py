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
    SafePlace(
        id="demo_eastside_center",
        name="Eastside Neighbors Community Center",
        category="safe_place",
        address="1500 E Example St, Milwaukee, WI 53202",
        latitude=43.0505,
        longitude=-87.8995,
        phone="414-555-0104",
        hours_description="Staffed front desk, Monday-Saturday 8am-9pm.",
        is_staffed=True,
        no_id_required=True,
        district="Juneautown",
        verified=False,
        provenance="sample",
    ),
    SafePlace(
        id="demo_northside_shelter",
        name="Northside Family Shelter (demo)",
        category="shelter",
        address="3100 N Sample Ave, Milwaukee, WI 53206",
        latitude=43.0770,
        longitude=-87.9180,
        phone="414-555-0105",
        hours_description="24/7 intake. Family rooms available.",
        is_staffed=True,
        no_id_required=True,
        district="Harambee",
        verified=False,
        provenance="sample",
    ),
    SafePlace(
        id="demo_fire_station_2",
        name="Neighborhood Fire Station 2",
        category="public_safety",
        address="800 W Placeholder St, Milwaukee, WI 53233",
        latitude=43.0395,
        longitude=-87.9230,
        phone="414-555-0106",
        hours_description="Staffed around the clock. Knock at the main door.",
        is_staffed=True,
        no_id_required=True,
        district="Avenues West",
        verified=False,
        provenance="sample",
    ),
    SafePlace(
        id="demo_southside_library",
        name="Southside Library Safe Haven",
        category="safe_place",
        address="2200 S Demo St, Milwaukee, WI 53207",
        latitude=43.0125,
        longitude=-87.9350,
        phone=None,
        hours_description="Public library lobby during posted library hours.",
        is_staffed=False,
        no_id_required=True,
        district="Near South Side",
        verified=False,
        provenance="sample",
    ),
    SafePlace(
        id="demo_bayview_hub",
        name="Bay View Neighborhood Hub",
        category="safe_place",
        address="2600 S Fictional Ave, Milwaukee, WI 53207",
        latitude=42.9960,
        longitude=-87.8940,
        phone="414-555-0107",
        hours_description="Staffed lobby, Monday-Friday 9am-7pm.",
        is_staffed=True,
        no_id_required=True,
        district="Bay View",
        verified=False,
        provenance="sample",
    ),
)


def list_safe_places(
    district: str | None = None,
    staffed_only: bool = False,
    include_sample: bool | None = None,
) -> list[SafePlace]:
    from src.server.core.config import settings

    wanted = district.strip().casefold() if district and district.strip() else None
    should_include_sample = (
        include_sample
        if include_sample is not None
        else (settings.APP_ENV != "production")
    )

    found: list[SafePlace] = []
    for place in _SAFE_PLACES:
        if not should_include_sample and not place.verified:
            continue
        if wanted is not None and place.district.casefold() != wanted:
            continue
        if staffed_only and not place.is_staffed:
            continue
        found.append(place)
    return found
