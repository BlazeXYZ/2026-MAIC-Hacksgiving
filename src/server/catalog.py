"""Seeded Milwaukee places for the demo map.

These are public buildings used as stand-ins until the open-data seed lands.
Hours here are the schedule `open_now` checks. Confirm them before a real visit.
Coordinates are approximate, for Leaflet pins.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from zoneinfo import ZoneInfo

try:
    from src.server.intake_schema import ServiceCategory, ServiceMatch
    from src.server.resource_schema import Pantry, SafePlace
except ModuleNotFoundError:
    from intake_schema import ServiceCategory, ServiceMatch
    from resource_schema import Pantry, SafePlace

CHICAGO = ZoneInfo("America/Chicago")

# Milwaukee County, loose box so a pin just outside the city still fails closed.
MILWAUKEE_LAT = (42.84, 43.19)
MILWAUKEE_LON = (-88.07, -87.86)

# Campus corridor: Diercks Hall atrium, the center walk, then 1025 N Broadway.
DIERCKS_HALL = (-87.90655, 43.04535)
CAMPUS_CENTER = (-87.90705, 43.04440)
MSOE_SAFETY_POINT = (-87.90745, 43.04385)


@dataclass(frozen=True)
class HoursWindow:
    weekday: int  # Monday is 0
    start_minute: int
    end_minute: int


@dataclass(frozen=True)
class PantrySeed:
    place: SafePlace
    accessibility_notes: str
    windows: tuple[HoursWindow, ...]


def _weekdays(start_hour: int, end_hour: int, days: range) -> tuple[HoursWindow, ...]:
    start = start_hour * 60
    end = end_hour * 60
    return tuple(HoursWindow(day, start, end) for day in days)


_SAFE_PLACES: tuple[SafePlace, ...] = (
    SafePlace(
        id="sojourner",
        name="Sojourner Family Peace Center",
        category="shelter",
        address="619 W Walnut St, Milwaukee, WI 53212",
        latitude=43.052153,
        longitude=-87.919154,
        phone="414-933-2722",
        hours_description="24/7 crisis line. Office Monday–Thursday 8am–6pm, Friday 8am–5pm.",
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
        phone="414-277-7159",
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
        phone="414-641-6140",
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
        hours_description="Public library lobby during posted library hours. Not a crisis desk.",
        is_staffed=False,
        no_id_required=True,
        district="Haymarket",
    ),
)


_PANTRY_SEEDS: tuple[PantrySeed, ...] = (
    PantrySeed(
        place=SafePlace(
            id="hunger-task-force-south",
            name="Hunger Task Force Southside Community Resource Center",
            category="food",
            address="802 W Mitchell St, Milwaukee, WI 53204",
            latitude=43.01215,
            longitude=-87.9224,
            phone=None,
            hours_description="Demo schedule: Monday–Friday 9am–5pm.",
            is_staffed=True,
            no_id_required=True,
            district="Near South Side",
        ),
        accessibility_notes=(
            "Demo seed. Street-level entrance. No ID in this demo profile. "
            "Confirm hours before you go."
        ),
        windows=_weekdays(9, 17, range(5)),
    ),
    PantrySeed(
        place=SafePlace(
            id="house-of-peace",
            name="House of Peace food pantry",
            category="food",
            address="1702 W Walnut St, Milwaukee, WI 53205",
            latitude=43.0522,
            longitude=-87.9334,
            phone=None,
            hours_description="Demo schedule: Wednesday and Friday 10am–2pm.",
            is_staffed=True,
            no_id_required=False,
            district="Haymarket",
        ),
        accessibility_notes=(
            "Demo seed. Ask at the desk about what to bring. Confirm hours before you go."
        ),
        windows=_weekdays(10, 14, range(2, 5, 2)),
    ),
)


_SERVICES: dict[ServiceCategory, ServiceMatch] = {
    ServiceCategory.food: ServiceMatch(
        id="hunger-task-force-south",
        name="Hunger Task Force Southside pantry",
        category=ServiceCategory.food,
        summary="Emergency groceries on the near south side.",
        next_step="Go to the pantry desk and say ComForce sent you. No appointment.",
    ),
    ServiceCategory.ride: ServiceMatch(
        id="comforce-ride-desk",
        name="ComForce ride desk",
        category=ServiceCategory.ride,
        summary="A volunteer ride to a public corner, not a home address.",
        next_step="A coordinator will match a driver. Share a corner and a time, not a house number.",
    ),
    ServiceCategory.shelter: ServiceMatch(
        id="sojourner",
        name="Sojourner Family Peace Center",
        category=ServiceCategory.shelter,
        summary="Staffed crisis support and a safe place to be heard.",
        next_step="Call or text the 24/7 line, or go to 619 W Walnut St. You do not need an ID.",
    ),
    ServiceCategory.warmth: ServiceMatch(
        id="king-library",
        name="King Library safe lobby",
        category=ServiceCategory.warmth,
        summary="A public lobby where you can warm up during library hours.",
        next_step="Head to King Library on Locust. If it is closed, the coordinator queue can find a warming room.",
    ),
    ServiceCategory.support: ServiceMatch(
        id="comforce-support-line",
        name="ComForce support line",
        category=ServiceCategory.support,
        summary="A person at ComForce who can listen and stay on the line.",
        next_step="Call ComForce at 414-395-0552. If you are in immediate danger, call 911.",
    ),
    ServiceCategory.other: ServiceMatch(
        id="impact-211",
        name="IMPACT 211",
        category=ServiceCategory.other,
        summary="Community information and referral for food, housing, and crisis support.",
        next_step="Call 211 and keep your ComForce token if you want a person here to follow up.",
    ),
}


def service_for(category: ServiceCategory) -> ServiceMatch:
    return _SERVICES[category]


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


def is_open(windows: tuple[HoursWindow, ...], at: datetime) -> bool:
    local = at.astimezone(CHICAGO)
    minute = local.hour * 60 + local.minute
    return any(
        window.weekday == local.weekday()
        and window.start_minute <= minute < window.end_minute
        for window in windows
    )


def list_pantries(
    *,
    open_now: bool | None,
    no_id_required: bool | None,
    district: str | None,
    at: datetime | None = None,
) -> list[Pantry]:
    clock = at or datetime.now(CHICAGO)
    wanted = district.strip().casefold() if district and district.strip() else None
    found: list[Pantry] = []
    for seed in _PANTRY_SEEDS:
        if wanted is not None and seed.place.district.casefold() != wanted:
            continue
        if (
            no_id_required is not None
            and seed.place.no_id_required is not no_id_required
        ):
            continue
        open_flag = is_open(seed.windows, clock)
        if open_now is not None and open_flag is not open_now:
            continue
        found.append(
            Pantry(
                **seed.place.model_dump(),
                accessibility_notes=seed.accessibility_notes,
                open_now=open_flag,
            )
        )
    return found


def in_milwaukee(latitude: float, longitude: float) -> bool:
    lat_min, lat_max = MILWAUKEE_LAT
    lon_min, lon_max = MILWAUKEE_LON
    return lat_min <= latitude <= lat_max and lon_min <= longitude <= lon_max


def near_msoe_campus(latitude: float, longitude: float) -> bool:
    return 43.040 <= latitude <= 43.048 and -87.912 <= longitude <= -87.901
