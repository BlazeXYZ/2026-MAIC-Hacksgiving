"""Database seed script for ComforceMKE community platform.

Loads verified safe places, Milwaukee food pantries, and sample support tickets.
Idempotent: safe to run multiple times without duplicating records.
All coordinates strictly verified within Milwaukee County bounds.
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any

from sqlalchemy import select

from src.server.db import Resource, Ticket, close_db, get_db, init_db

logger = logging.getLogger("comforce.seed")

# Milwaukee County bounding box: lat ~[42.84, 43.19], lon ~[-88.07, -87.82]
MILWAUKEE_LAT_MIN = 42.84
MILWAUKEE_LAT_MAX = 43.20
MILWAUKEE_LON_MIN = -88.10
MILWAUKEE_LON_MAX = -87.80


def _validate_milwaukee_coordinates(name: str, lat: float, lon: float) -> None:
    if not (MILWAUKEE_LAT_MIN <= lat <= MILWAUKEE_LAT_MAX and MILWAUKEE_LON_MIN <= lon <= MILWAUKEE_LON_MAX):
        raise ValueError(
            f"Resource '{name}' coordinates ({lat}, {lon}) are outside Milwaukee County bounds."
        )


def _seed_ticket(item: dict[str, Any]) -> dict[str, Any]:
    """Add the creation timestamp and initial timeline expected from intake tickets."""
    created_at = datetime.now(timezone.utc)
    return {
        **item,
        "created_at": created_at,
        "timeline": [{"at": created_at.isoformat(), "status": item["status"]}],
    }


def _repair_seed_ticket(ticket: Ticket, item: dict[str, Any]) -> None:
    """Fill missing seeded-ticket fields without changing valid existing values."""
    if ticket.ticket_id is None:
        ticket.ticket_id = item["ticket_id"]
    if not ticket.timeline:
        created_at = ticket.created_at
        if created_at.tzinfo is None:
            created_at = created_at.replace(tzinfo=timezone.utc)
        ticket.timeline = [{"at": created_at.isoformat(), "status": item["status"]}]


SAFE_PLACES: tuple[dict[str, Any], ...] = (
    {
        "id": "safe-place-sojourner",
        "name": "Sojourner Family Peace Center",
        "category": "Safe Place",
        "address": "619 W Walnut St, Milwaukee, WI 53212",
        "district": "Haymarket",
        "latitude": 43.0535,
        "longitude": -87.9194,
        "phone": "414-933-2722",
        "hours_description": "24/7 emergency shelter and safety resource center",
        "is_staffed": True,
        "no_id_required": True,
        "open_now": True,
        "accessibility_notes": "Wheelchair accessible, secure intake facility",
    },
    {
        "id": "safe-place-msoe",
        "name": "MSOE Public Safety",
        "category": "Safe Place",
        "address": "1025 N Broadway, Milwaukee, WI 53202",
        "district": "East Town",
        "latitude": 43.0445,
        "longitude": -87.9090,
        "phone": "414-277-7159",
        "hours_description": "24/7 staffed campus safety office and lit corridor refuge",
        "is_staffed": True,
        "no_id_required": True,
        "open_now": True,
        "accessibility_notes": "Street level entrance with automatic doors",
    },
    {
        "id": "safe-place-mwc",
        "name": "Milwaukee Women's Center",
        "category": "Safe Place",
        "address": "611 N 19th St, Milwaukee, WI 53233",
        "district": "Avenues West",
        "latitude": 43.0389,
        "longitude": -87.9366,
        "phone": "414-671-6140",
        "hours_description": "24/7 crisis response and emergency family shelter",
        "is_staffed": True,
        "no_id_required": True,
        "open_now": True,
        "accessibility_notes": "Accessible ramp and bilingual support",
    },
)

FOOD_PANTRIES: tuple[dict[str, Any], ...] = (
    {
        "id": "pantry-friedens-hope",
        "name": "Friedens Community Ministries - Hope House",
        "category": "Food Pantry",
        "address": "209 W Orchard St, Milwaukee, WI 53204",
        "district": "Walker's Point",
        "latitude": 43.0135,
        "longitude": -87.9135,
        "phone": "414-289-6030",
        "hours_description": "Mon-Fri 9:00 AM - 12:00 PM",
        "is_staffed": True,
        "no_id_required": True,
        "open_now": True,
        "accessibility_notes": "Ground level entrance, emergency grocery bags",
    },
    {
        "id": "pantry-despensa",
        "name": "Friedens Community Ministries - Despensa de la Paz",
        "category": "Food Pantry",
        "address": "1615 S 22nd St, Milwaukee, WI 53204",
        "district": "Clarke Square",
        "latitude": 43.0125,
        "longitude": -87.9405,
        "phone": "414-289-6030",
        "hours_description": "Sat 10:00 AM - 12:00 PM",
        "is_staffed": True,
        "no_id_required": True,
        "open_now": False,
        "accessibility_notes": "Bilingual Spanish/English volunteer team",
    },
    {
        "id": "pantry-riverwest",
        "name": "Kinship Riverwest Food Center",
        "category": "Food Pantry",
        "address": "924 E Clarke St, Milwaukee, WI 53212",
        "district": "Riverwest",
        "latitude": 43.0645,
        "longitude": -87.8995,
        "phone": "414-301-1478",
        "hours_description": "Tue 4:00 PM - 6:00 PM, Sat 8:30 AM - 10:30 AM",
        "is_staffed": True,
        "no_id_required": True,
        "open_now": True,
        "accessibility_notes": "Wheelchair accessible, fresh produce available",
    },
    {
        "id": "pantry-interchange",
        "name": "Interchange Food Pantry",
        "category": "Food Pantry",
        "address": "130 E Juneau Ave, Milwaukee, WI 53202",
        "district": "Juneautown",
        "latitude": 43.0450,
        "longitude": -87.9100,
        "phone": "414-551-1636",
        "hours_description": "Mon-Wed 4:00 PM - 6:00 PM",
        "is_staffed": True,
        "no_id_required": True,
        "open_now": True,
        "accessibility_notes": "Street level accessible doorway",
    },
    {
        "id": "pantry-central-city",
        "name": "Central City Churches Outreach Ministry",
        "category": "Food Pantry",
        "address": "2401 W Wisconsin Ave, Milwaukee, WI 53233",
        "district": "Avenues West",
        "latitude": 43.0385,
        "longitude": -87.9440,
        "phone": "414-342-1522",
        "hours_description": "Mon-Thu 9:30 AM - 11:30 AM",
        "is_staffed": True,
        "no_id_required": True,
        "open_now": False,
        "accessibility_notes": "Elevator access available upon arrival",
    },
    {
        "id": "pantry-salvation-army-citadel",
        "name": "Salvation Army Milwaukee Citadel Corps",
        "category": "Food Pantry",
        "address": "4129 W Villard Ave, Milwaukee, WI 53209",
        "district": "Old North Milwaukee",
        "latitude": 43.1040,
        "longitude": -87.9640,
        "phone": "414-463-3300",
        "hours_description": "Mon-Fri 9:00 AM - 3:00 PM",
        "is_staffed": True,
        "no_id_required": True,
        "open_now": True,
        "accessibility_notes": "Full ADA accessible entryway and parking",
    },
    {
        "id": "pantry-jfs",
        "name": "Jewish Family Services Food Pantry",
        "category": "Food Pantry",
        "address": "1300 N Jackson St, Milwaukee, WI 53202",
        "district": "Yankee Hill",
        "latitude": 43.0480,
        "longitude": -87.9030,
        "phone": "414-390-5800",
        "hours_description": "Mon-Fri 8:30 AM - 4:30 PM",
        "is_staffed": True,
        "no_id_required": True,
        "open_now": True,
        "accessibility_notes": "Kosher food packages and dietary accommodation",
    },
    {
        "id": "pantry-all-saints",
        "name": "All Saints Food Pantry",
        "category": "Food Pantry",
        "address": "4060 N 26th St, Milwaukee, WI 53209",
        "district": "Franklin Heights",
        "latitude": 43.0930,
        "longitude": -87.9460,
        "phone": "414-444-5610",
        "hours_description": "Thu 10:00 AM - 12:00 PM",
        "is_staffed": True,
        "no_id_required": True,
        "open_now": False,
        "accessibility_notes": "Curbside pickup assistance available",
    },
    {
        "id": "pantry-svdp-st-patrick",
        "name": "St. Vincent de Paul - St. Patrick Pantry",
        "category": "Food Pantry",
        "address": "723 W Washington St, Milwaukee, WI 53204",
        "district": "Walker's Point",
        "latitude": 43.0240,
        "longitude": -87.9210,
        "phone": "414-649-4040",
        "hours_description": "Mon-Fri 9:00 AM - 1:00 PM",
        "is_staffed": True,
        "no_id_required": True,
        "open_now": True,
        "accessibility_notes": "Spanish-speaking coordinators on site",
    },
    {
        "id": "pantry-kinship-center",
        "name": "Kinship Community Food Center - MLK",
        "category": "Food Pantry",
        "address": "2610 N Martin Luther King Jr Dr, Milwaukee, WI 53212",
        "district": "Harambee",
        "latitude": 43.0655,
        "longitude": -87.9145,
        "phone": "414-372-5881",
        "hours_description": "Tue & Thu 12:00 PM - 3:00 PM",
        "is_staffed": True,
        "no_id_required": True,
        "open_now": True,
        "accessibility_notes": "Ramped entrance from Martin Luther King Jr Dr",
    },
    {
        "id": "pantry-bay-view",
        "name": "Bay View Community Center Food Pantry",
        "category": "Food Pantry",
        "address": "1320 E Oklahoma Ave, Milwaukee, WI 53207",
        "district": "Bay View",
        "latitude": 42.9880,
        "longitude": -87.8950,
        "phone": "414-482-1000",
        "hours_description": "Mon-Wed 10:00 AM - 2:00 PM",
        "is_staffed": True,
        "no_id_required": True,
        "open_now": True,
        "accessibility_notes": "Elevator access and infant supplies",
    },
)

SAMPLE_TICKETS: tuple[dict[str, Any], ...] = (
    {
        "ticket_id": "0b0a4d8e6f124d0e9a7c5b2f1e3d8061",
        "token": "tok_mke_urgent_shelter",
        "status": "pending",
        "urgency": "urgent",
        "category": "shelter",
        "summary": "Immediate safe shelter needed tonight due to severe cold snap and displacement.",
        "district": "Near West Side",
        "language": "en",
        "suggested_service_id": "safe-place-sojourner",
        "notes": "Elderly resident with service animal.",
    },
    {
        "ticket_id": "1c2d3e4f506172839aabbccd4eef6072",
        "token": "tok_mke_urgent_formula",
        "status": "pending",
        "urgency": "urgent",
        "category": "food",
        "summary": "Emergency infant formula and newborn diapers needed for single parent without transportation.",
        "district": "Harambee",
        "language": "en",
        "suggested_service_id": "pantry-kinship-center",
        "notes": "Needs hypoallergenic formula if available.",
    },
    {
        "ticket_id": "2d3e4f506172839abbccddeeff607183",
        "token": "tok_mke_today_ride",
        "status": "assigned",
        "urgency": "today",
        "category": "ride",
        "summary": "Resident requires ride assistance to medical clinic appointment on Mitchell St.",
        "district": "Walker's Point",
        "language": "es",
        "suggested_service_id": "pantry-svdp-st-patrick",
        "assigned_volunteer_id": "vol_neighbor_maria",
        "assigned_volunteer_alias": "Volunteer Maria",
        "notes": "Appointment scheduled for 2:30 PM.",
    },
    {
        "ticket_id": "3e4f506172839abbccddeeff60718394",
        "token": "tok_mke_today_warmth",
        "status": "pending",
        "urgency": "today",
        "category": "warmth",
        "summary": "Winter coats and thermal blankets needed for family with two young children.",
        "district": "Riverwest",
        "language": "en",
        "suggested_service_id": "pantry-riverwest",
        "notes": "Sizes: Child Medium, Adult Large.",
    },
    {
        "ticket_id": "4f506172839abbccddeeff60718394a5",
        "token": "tok_mke_week_food",
        "status": "in_progress",
        "urgency": "this_week",
        "category": "food",
        "summary": "Weekly pantry delivery inquiry for mobility-impaired resident in Juneautown.",
        "district": "Juneautown",
        "language": "en",
        "suggested_service_id": "pantry-interchange",
        "assigned_volunteer_id": "vol_neighbor_dave",
        "assigned_volunteer_alias": "Volunteer Dave",
        "notes": "Coordinating drop-off window for Thursday afternoon.",
    },
)

# Additional synthetic demo records. Kept apart from the core fixtures above so
# seed_database() counts stay stable; applied by main() via seed_demo_extras().
DEMO_EXTRA_RESOURCES: tuple[dict[str, Any], ...] = (
    {
        "id": "demo-pantry-eastside",
        "name": "Eastside Neighbors Pantry (demo)",
        "category": "Food Pantry",
        "address": "1500 E Example St, Milwaukee, WI 53202",
        "district": "Juneautown",
        "latitude": 43.0505,
        "longitude": -87.8995,
        "phone": "414-555-0140",
        "hours_description": "Mon-Sat 10:00 AM - 4:00 PM",
        "is_staffed": True,
        "no_id_required": True,
        "open_now": True,
        "accessibility_notes": "Demo record. Ramp at side entrance.",
    },
    {
        "id": "demo-pantry-northside",
        "name": "Northside Family Table (demo)",
        "category": "Food Pantry",
        "address": "3300 N Demo Blvd, Milwaukee, WI 53206",
        "district": "Harambee",
        "latitude": 43.0795,
        "longitude": -87.9170,
        "phone": "414-555-0141",
        "hours_description": "Mon-Sat 9:00 AM - 3:00 PM",
        "is_staffed": True,
        "no_id_required": False,
        "open_now": True,
        "accessibility_notes": "Demo record. Infant supplies available.",
    },
    {
        "id": "demo-safe-fire-station-2",
        "name": "Neighborhood Fire Station 2 (demo)",
        "category": "Safe Place",
        "address": "800 W Placeholder St, Milwaukee, WI 53233",
        "district": "Avenues West",
        "latitude": 43.0395,
        "longitude": -87.9230,
        "phone": "414-555-0142",
        "hours_description": "Staffed around the clock",
        "is_staffed": True,
        "no_id_required": True,
        "open_now": True,
        "accessibility_notes": "Demo record. Knock at the main door.",
    },
)

DEMO_EXTRA_TICKETS: tuple[dict[str, Any], ...] = (
    {
        "ticket_id": "506172839abbccddeeff60718394a5b6",
        "token": "tok_mke_demo_ride_clinic",
        "status": "pending",
        "urgency": "today",
        "category": "ride",
        "summary": "Ride needed to a morning clinic visit. Resident uses a walker.",
        "district": "Bay View",
        "language": "en",
        "suggested_service_id": "demo-safe-fire-station-2",
        "notes": "Demo record only.",
    },
    {
        "ticket_id": "6172839abbccddeeff60718394a5b6c7",
        "token": "tok_mke_demo_support_call",
        "status": "assigned",
        "urgency": "this_week",
        "category": "support",
        "summary": "Wants a volunteer to check in by phone about a housing question.",
        "district": "Riverwest",
        "language": "en",
        "assigned_volunteer_id": "vol_neighbor_sam",
        "assigned_volunteer_alias": "Volunteer Sam",
        "notes": "Demo record only.",
    },
    {
        "ticket_id": "72839abbccddeeff60718394a5b6c7d8",
        "token": "tok_mke_demo_groceries",
        "status": "resolved",
        "urgency": "this_week",
        "category": "food",
        "summary": "Grocery box delivered to a homebound neighbor.",
        "district": "Harambee",
        "language": "en",
        "suggested_service_id": "demo-pantry-northside",
        "assigned_volunteer_id": "vol_neighbor_dave",
        "assigned_volunteer_alias": "Volunteer Dave",
        "notes": "Demo record only. Completed.",
    },
)


def seed_demo_extras(db_url: str | None = None) -> dict[str, int]:
    """Add the extra synthetic demo resources and tickets idempotently."""
    init_db(db_url)
    session = next(get_db())
    resources_added = 0
    tickets_added = 0
    for item in DEMO_EXTRA_RESOURCES:
        _validate_milwaukee_coordinates(item["name"], item["latitude"], item["longitude"])
        if session.scalar(select(Resource).where(Resource.id == item["id"])) is None:
            session.add(Resource(**item))
            resources_added += 1
    for item in DEMO_EXTRA_TICKETS:
        existing = session.scalar(select(Ticket).where(Ticket.token == item["token"]))
        if existing is None:
            session.add(Ticket(**_seed_ticket(item)))
            tickets_added += 1
        else:
            _repair_seed_ticket(existing, item)
    session.commit()
    return {"resources_added": resources_added, "tickets_added": tickets_added}


def seed_database(db_url: str | None = None) -> dict[str, int]:
    """Populate database with verified fixtures idempotently."""
    init_db(db_url)
    session = next(get_db())

    safe_places_added = 0
    pantries_added = 0
    tickets_added = 0

    try:
        # Validate and insert Safe Places
        for item in SAFE_PLACES:
            _validate_milwaukee_coordinates(item["name"], item["latitude"], item["longitude"])
            existing = session.scalar(select(Resource).where(Resource.id == item["id"]))
            if existing is None:
                session.add(Resource(**item))
                safe_places_added += 1

        # Validate and insert Food Pantries
        for item in FOOD_PANTRIES:
            _validate_milwaukee_coordinates(item["name"], item["latitude"], item["longitude"])
            existing = session.scalar(select(Resource).where(Resource.id == item["id"]))
            if existing is None:
                session.add(Resource(**item))
                pantries_added += 1

        # Insert Sample Tickets
        for item in SAMPLE_TICKETS:
            existing_ticket = session.scalar(select(Ticket).where(Ticket.token == item["token"]))
            if existing_ticket is None:
                session.add(Ticket(**_seed_ticket(item)))
                tickets_added += 1
            else:
                _repair_seed_ticket(existing_ticket, item)

        session.commit()
    finally:
        session.close()
    logger.info(
        "Seeding complete: %d safe places, %d pantries, %d tickets added.",
        safe_places_added,
        pantries_added,
        tickets_added,
    )
    return {
        "safe_places_added": safe_places_added,
        "pantries_added": pantries_added,
        "tickets_added": tickets_added,
    }


def main() -> None:
    """CLI entrypoint for uv run python -m src.server.seed."""
    logging.basicConfig(level=logging.INFO)
    print("Seeding ComforceMKE database with Milwaukee fixtures...")
    results = seed_database()
    print(
        f"Done! Added {results['safe_places_added']} safe places, "
        f"{results['pantries_added']} food pantries, and "
        f"{results['tickets_added']} sample tickets."
    )
    close_db()
    extras = seed_demo_extras()
    print(
        f"Demo extras: {extras['resources_added']} resources and "
        f"{extras['tickets_added']} tickets added."
    )
    close_db()


if __name__ == "__main__":
    main()
