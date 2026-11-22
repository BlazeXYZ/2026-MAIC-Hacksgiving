"""Preset service matches for a triaged request.

Copy is demo text. It names a desk and leaves street addresses on the
resource endpoints.
"""

from __future__ import annotations

from src.server.intake.schema import ServiceCategory, ServiceMatch

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
        next_step=(
            "A coordinator will match a driver. Share a corner and a time, "
            "not a house number."
        ),
    ),
    ServiceCategory.shelter: ServiceMatch(
        id="sojourner",
        name="Sojourner Family Peace Center",
        category=ServiceCategory.shelter,
        summary="Staffed crisis support and a safe place to be heard.",
        next_step="Call the 24/7 line or go to the safe-places pin. You do not need an ID.",
    ),
    ServiceCategory.warmth: ServiceMatch(
        id="king_library",
        name="King Library safe lobby",
        category=ServiceCategory.warmth,
        summary="A public lobby where you can warm up during library hours.",
        next_step=(
            "Head to King Library. If it is closed, the coordinator queue "
            "can find a warming room."
        ),
    ),
    ServiceCategory.support: ServiceMatch(
        id="comforce-support-line",
        name="ComForce support line",
        category=ServiceCategory.support,
        summary="A person at ComForce who can listen and stay on the line.",
        next_step="Call ComForce at 414-555-0100. If you are in immediate danger, call 911.",
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
