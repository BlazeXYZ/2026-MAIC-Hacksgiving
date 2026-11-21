"""Emergency food pantries and the demo weekly schedule.

`open_now` is evaluated in America/Chicago against these windows.
"""

from __future__ import annotations

from collections.abc import Iterable
from dataclasses import dataclass
from datetime import datetime
from zoneinfo import ZoneInfo

from src.server.resources.schema import Pantry

CHICAGO = ZoneInfo("America/Chicago")


@dataclass(frozen=True)
class HoursWindow:
    weekday: int  # Monday is 0
    start_minute: int
    end_minute: int


@dataclass(frozen=True)
class PantrySeed:
    place: Pantry
    windows: tuple[HoursWindow, ...]


def _weekdays(start_hour: int, end_hour: int, days: Iterable[int]) -> tuple[HoursWindow, ...]:
    start = start_hour * 60
    end = end_hour * 60
    return tuple(HoursWindow(day, start, end) for day in days)


_PANTRY_SEEDS: tuple[PantrySeed, ...] = (
    PantrySeed(
        place=Pantry(
            id="hunger-task-force-south",
            name="Hunger Task Force Southside Community Resource Center",
            category="food",
            address="802 W Mitchell St, Milwaukee, WI 53204",
            latitude=43.01215,
            longitude=-87.9224,
            phone="414-555-0110",
            hours_description="Demo schedule: Monday–Friday 9am–5pm.",
            is_staffed=True,
            no_id_required=True,
            district="Near South Side",
            accessibility_notes=(
                "Demo seed. Street-level entrance. No ID in this demo profile. "
                "Confirm hours before you go."
            ),
            open_now=False,
        ),
        windows=_weekdays(9, 17, range(5)),
    ),
    PantrySeed(
        place=Pantry(
            id="house-of-peace",
            name="House of Peace food pantry",
            category="food",
            address="1702 W Walnut St, Milwaukee, WI 53205",
            latitude=43.0522,
            longitude=-87.9334,
            phone="414-555-0111",
            hours_description="Demo schedule: Wednesday and Friday 10am–2pm.",
            is_staffed=True,
            no_id_required=False,
            district="Haymarket",
            accessibility_notes=(
                "Demo seed. Ask at the desk about what to bring. "
                "Confirm hours before you go."
            ),
            open_now=False,
        ),
        windows=_weekdays(10, 14, range(2, 5, 2)),
    ),
)


def _demo_pantry(
    pantry_id: str,
    name: str,
    address: str,
    latitude: float,
    longitude: float,
    phone: str,
    district: str,
    hours: str,
    days: tuple[int, ...],
    start_hour: int,
    end_hour: int,
    *,
    no_id_required: bool = True,
    notes: str = "Demo seed. Confirm hours before you go.",
) -> PantrySeed:
    """Build a synthetic pantry with one weekly window repeated over ``days``."""
    return PantrySeed(
        place=Pantry(
            id=pantry_id,
            name=name,
            category="food",
            address=address,
            latitude=latitude,
            longitude=longitude,
            phone=phone,
            hours_description=f"Demo schedule: {hours}",
            is_staffed=True,
            no_id_required=no_id_required,
            district=district,
            accessibility_notes=notes,
            open_now=False,
        ),
        windows=_weekdays(start_hour, end_hour, days),
    )


_PANTRY_SEEDS = _PANTRY_SEEDS + (
    _demo_pantry(
        "riverbend-pantry", "Riverbend Neighbors Pantry",
        "1200 E Example Ave, Milwaukee, WI 53212", 43.0610, -87.9015,
        "414-555-0112", "Riverwest", "Tuesday and Saturday 9am-1pm.",
        (1, 5), 9, 13,
        notes="Demo seed. Ramp at side door. Produce table on Saturdays.",
    ),
    _demo_pantry(
        "harbor-district-cupboard", "Harbor District Community Cupboard",
        "410 N Sample St, Milwaukee, WI 53202", 43.0442, -87.9068,
        "414-555-0113", "Juneautown", "Monday-Saturday 10am-6pm.",
        (0, 1, 2, 3, 4, 5), 10, 18,
        notes="Demo seed. Street-level entrance. Shelf-stable and fresh items.",
    ),
    _demo_pantry(
        "northside-family-table", "Northside Family Table",
        "3300 N Demo Blvd, Milwaukee, WI 53206", 43.0795, -87.9170,
        "414-555-0114", "Harambee", "Monday-Saturday 9am-3pm.",
        (0, 1, 2, 3, 4, 5), 9, 15, no_id_required=False,
        notes="Demo seed. Bring a piece of mail if you have one. Infant supplies available.",
    ),
    _demo_pantry(
        "southside-sharing-shelf", "Southside Sharing Shelf",
        "1800 S Placeholder St, Milwaukee, WI 53204", 43.0150, -87.9300,
        "414-555-0115", "Clarke Square", "Wednesday and Saturday 10am-2pm.",
        (2, 5), 10, 14,
        notes="Demo seed. Spanish and English volunteers on site.",
    ),
    _demo_pantry(
        "bay-view-grocery-share", "Bay View Grocery Share",
        "2500 S Fictional Ave, Milwaukee, WI 53207", 42.9930, -87.8960,
        "414-555-0116", "Bay View", "Thursday-Saturday 12pm-5pm.",
        (3, 4, 5), 12, 17,
        notes="Demo seed. Curbside pickup available on request.",
    ),
    _demo_pantry(
        "westside-warm-meals", "Westside Warm Meals and Pantry",
        "2900 W Sample Ave, Milwaukee, WI 53208", 43.0430, -87.9520,
        "414-555-0117", "Avenues West", "Monday-Saturday 8am-8pm.",
        (0, 1, 2, 3, 4, 5), 8, 20,
        notes="Demo seed. Hot meal at noon. Wheelchair accessible.",
    ),
)


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
        found.append(seed.place.model_copy(update={"open_now": open_flag}))
    return found
