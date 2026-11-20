"""Tests for the smart volunteer dispatch filter."""

import datetime
import sys
from pathlib import Path

# Ensure repository root is on sys.path
REPO_ROOT = Path(__file__).resolve().parent.parent
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from src.server.ai.dispatch import (
    MAX_NOTIFY,
    MIN_NOTIFY,
    DispatchCandidate,
    Volunteer,
    haversine_m,
    is_in_quiet_hours,
    rank_volunteers,
    response_rate,
)

NINE_AM = datetime.datetime(2026, 11, 20, 9, 0, 0)


def _t(hour: int, minute: int = 0) -> datetime.time:
    return datetime.time(hour, minute)


# --- haversine ---------------------------------------------------------------


def test_haversine_same_point_is_zero():
    assert haversine_m(45.5, -73.5, 45.5, -73.5) == 0.0


def test_haversine_one_degree_latitude():
    dist = haversine_m(45.0, -73.0, 46.0, -73.0)
    assert abs(dist - 111_000) / 111_000 < 0.01


def test_haversine_known_city_distance():
    # Montreal -> Toronto is ~504 km
    dist = haversine_m(45.5019, -73.5674, 43.6532, -79.3832)
    assert abs(dist - 504_000) / 504_000 < 0.01


# --- quiet hours -------------------------------------------------------------


def test_quiet_hours_none_is_always_false():
    assert not is_in_quiet_hours(None, _t(23, 0))


def test_quiet_hours_midday_not_in_overnight_window():
    assert not is_in_quiet_hours((_t(22), _t(7)), _t(12))


def test_quiet_hours_23h_in_overnight_window():
    assert is_in_quiet_hours((_t(22), _t(7)), _t(23))


def test_quiet_hours_early_morning_in_overnight_window():
    assert is_in_quiet_hours((_t(22), _t(7)), _t(6, 30))


def test_quiet_hours_just_before_overnight_window():
    assert not is_in_quiet_hours((_t(22), _t(7)), _t(21, 59))


def test_quiet_hours_non_wrapping_window():
    window = (_t(13), _t(15))
    assert is_in_quiet_hours(window, _t(13))
    assert is_in_quiet_hours(window, _t(14, 59))
    assert not is_in_quiet_hours(window, _t(12, 59))
    assert not is_in_quiet_hours(window, _t(15))


# --- response rate -----------------------------------------------------------


def test_response_rate_no_history_is_half():
    assert response_rate(0, 0) == 0.5


def test_response_rate_all_accepted():
    assert response_rate(4, 0) == 1.0


def test_response_rate_all_declined():
    assert response_rate(0, 4) == 0.0


def test_response_rate_mixed():
    assert response_rate(3, 1) == 0.75


# --- ranking -----------------------------------------------------------------


def _roster() -> list[Volunteer]:
    return [
        Volunteer("near_reliable", 45.01, -73.01, accepted=8, declined=2),
        Volunteer("near_flaky", 45.02, -73.02, accepted=1, declined=9),
        Volunteer("mid_ok", 45.10, -73.10, accepted=5, declined=5),
        Volunteer("far_reliable", 46.00, -74.00, accepted=9, declined=1),
        Volunteer("mid_good", 45.12, -73.12, accepted=6, declined=2),
    ]


def test_nearest_and_most_reliable_ranks_first():
    result = rank_volunteers(45.0, -73.0, _roster(), now=NINE_AM)
    assert result[0].volunteer.volunteer_id == "near_reliable"


def test_result_count_capped_at_max_notify():
    assert len(rank_volunteers(45.0, -73.0, _roster(), now=NINE_AM)) <= MAX_NOTIFY


def test_result_count_respects_min_notify_when_roster_allows():
    result = rank_volunteers(45.0, -73.0, _roster(), now=NINE_AM)
    assert len(result) >= min(MIN_NOTIFY, len(_roster()))
    assert len(result) == min(len(_roster()), MAX_NOTIFY)


def test_small_roster_returns_everyone_active():
    small = _roster()[:2]
    result = rank_volunteers(45.0, -73.0, small, now=NINE_AM)
    assert len(result) == 2


def test_inactive_volunteers_never_notified():
    roster = _roster() + [
        Volunteer("inactive_near", 45.001, -73.001, active=False),
        Volunteer(
            "inactive_resting",
            45.002,
            -73.002,
            active=False,
            quiet_hours=(_t(22), _t(7)),
        ),
    ]
    result = rank_volunteers(45.0, -73.0, roster, now=_dt(23))
    ids = {c.volunteer.volunteer_id for c in result}
    assert "inactive_near" not in ids
    assert "inactive_resting" not in ids


def _dt(hour: int, minute: int = 0) -> datetime.datetime:
    return datetime.datetime(2026, 11, 20, hour, minute)


def test_quiet_hours_excluded_when_enough_eligible():
    roster = _roster()
    roster[4] = Volunteer(
        "resting", 45.12, -73.12, quiet_hours=(_t(22), _t(7))
    )
    result = rank_volunteers(45.0, -73.0, roster, now=_dt(23))
    ids = {c.volunteer.volunteer_id for c in result}
    assert "resting" not in ids


def test_quiet_hours_backfilled_and_flagged_when_few_eligible():
    roster = [
        Volunteer("a", 45.01, -73.01),
        Volunteer("b", 45.02, -73.02, quiet_hours=(_t(22), _t(7))),
        Volunteer("c", 45.03, -73.03, quiet_hours=(_t(22), _t(7))),
        Volunteer("d", 45.04, -73.04, quiet_hours=(_t(22), _t(7))),
        Volunteer("e", 45.05, -73.05, quiet_hours=(_t(22), _t(7))),
    ]
    result = rank_volunteers(45.0, -73.0, roster, now=_dt(23))
    assert len(result) >= MIN_NOTIFY
    ids = {c.volunteer.volunteer_id for c in result}
    assert ids == {"a", "b", "c"}
    flagged = {c.volunteer.volunteer_id for c in result if c.in_quiet_hours}
    assert flagged == {"b", "c"}
    # eligible volunteer is not flagged
    by_id = {c.volunteer.volunteer_id: c for c in result}
    assert not by_id["a"].in_quiet_hours


def test_backfill_only_to_min_notify():
    roster = [Volunteer(f"r{i}", 45.0 + i * 0.01, -73.0) for i in range(3)]
    roster += [
        Volunteer(f"q{i}", 45.0 + i * 0.001, -73.0, quiet_hours=(_t(22), _t(7)))
        for i in range(5)
    ]
    result = rank_volunteers(45.0, -73.0, roster, now=_dt(23))
    assert len(result) == MIN_NOTIFY
    flagged = [c for c in result if c.in_quiet_hours]
    assert len(flagged) == 0


def test_ranking_is_deterministic():
    roster = _roster()
    r1 = rank_volunteers(45.0, -73.0, roster, now=NINE_AM)
    r2 = rank_volunteers(45.0, -73.0, roster, now=NINE_AM)
    assert r1 == r2
    assert all(isinstance(c, DispatchCandidate) for c in r1)


def test_tiebreak_prefers_shorter_distance():
    roster = [
        Volunteer("far", 46.0, -73.0),
        Volunteer("near", 45.5, -73.0),
    ]
    result = rank_volunteers(45.0, -73.0, roster, now=NINE_AM)
    assert result[0].volunteer.volunteer_id == "near"


def test_distances_recorded():
    result = rank_volunteers(45.0, -73.0, _roster(), now=NINE_AM)
    assert all(c.distance_m >= 0 for c in result)
    first = result[0]
    assert first.distance_m == haversine_m(
        45.0, -73.0, first.volunteer.lat, first.volunteer.lon
    )
