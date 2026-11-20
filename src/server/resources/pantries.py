"""Emergency food pantries and the demo weekly schedule.

`open_now` is evaluated in America/Chicago against these windows.
"""

from __future__ import annotations

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


def _weekdays(start_hour: int, end_hour: int, days: range) -> tuple[HoursWindow, ...]:
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
