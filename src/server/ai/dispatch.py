"""Smart volunteer dispatch notification filter.

Selects the most relevant volunteers for a new ticket by combining
geographic distance, past response history, and quiet hours, so we
never blast the whole roster and never ping anyone during rest time.
"""

import datetime
import math
from dataclasses import dataclass

MAX_NOTIFY = 5
MIN_NOTIFY = 3

_EARTH_RADIUS_M = 6_371_000.0


@dataclass(frozen=True)
class Volunteer:
    volunteer_id: str
    lat: float
    lon: float
    active: bool = True
    quiet_hours: tuple[datetime.time, datetime.time] | None = None
    accepted: int = 0
    declined: int = 0


@dataclass(frozen=True)
class DispatchCandidate:
    volunteer: Volunteer
    score: float
    distance_m: float
    in_quiet_hours: bool = False


def haversine_m(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Great-circle distance in meters between two lat/lon points."""
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlmb = math.radians(lon2 - lon1)
    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(
        dlmb / 2
    ) ** 2
    return 2 * _EARTH_RADIUS_M * math.asin(math.sqrt(a))


def is_in_quiet_hours(
    quiet_hours: tuple[datetime.time, datetime.time] | None,
    now: datetime.time,
) -> bool:
    """Whether ``now`` falls inside the (start, end) quiet window.

    Handles windows that wrap past midnight (e.g. 22:00-07:00).
    A window that starts and ends at the same time is treated as empty.
    """
    if quiet_hours is None:
        return False
    start, end = quiet_hours
    if start == end:
        return False
    if start < end:
        return start <= now < end
    return now >= start or now < end


def response_rate(accepted: int, declined: int) -> float:
    """Historical acceptance rate; 0.5 when there is no history."""
    total = accepted + declined
    if total == 0:
        return 0.5
    return accepted / total


def _score(distance_m: float, accepted: int, declined: int) -> float:
    distance_score = 1.0 / (1.0 + distance_m / 1000.0)
    reliability = response_rate(accepted, declined)
    return 0.6 * distance_score + 0.4 * reliability


def rank_volunteers(
    ticket_lat: float,
    ticket_lon: float,
    volunteers: list[Volunteer],
    now: datetime.datetime | None = None,
) -> list[DispatchCandidate]:
    """Rank active volunteers for a ticket and return up to MAX_NOTIFY.

    Volunteers in quiet hours are skipped unless doing so would leave
    fewer than MIN_NOTIFY candidates, in which case they are backfilled
    (flagged ``in_quiet_hours=True``). Inactive volunteers are never
    notified.
    """
    moment = (now or datetime.datetime.now()).time()

    def build(vol: Volunteer, in_quiet: bool) -> DispatchCandidate:
        dist = haversine_m(ticket_lat, ticket_lon, vol.lat, vol.lon)
        return DispatchCandidate(
            volunteer=vol,
            score=_score(dist, vol.accepted, vol.declined),
            distance_m=dist,
            in_quiet_hours=in_quiet,
        )

    active = [v for v in volunteers if v.active]
    eligible = [
        build(v, False)
        for v in active
        if not is_in_quiet_hours(v.quiet_hours, moment)
    ]
    resting = [
        build(v, True)
        for v in active
        if is_in_quiet_hours(v.quiet_hours, moment)
    ]

    key = lambda c: (-c.score, c.distance_m, c.volunteer.volunteer_id)
    eligible.sort(key=key)
    resting.sort(key=key)

    chosen = eligible[:MAX_NOTIFY]
    if len(chosen) < MIN_NOTIFY:
        needed = MIN_NOTIFY - len(chosen)
        chosen.extend(resting[:needed])
    return chosen
