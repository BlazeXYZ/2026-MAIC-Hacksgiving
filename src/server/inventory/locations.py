"""Which locations may hold community inventory.

Fail closed: only places we can positively identify as safe to list are
eligible. Domestic-safety shelters must never appear in a public inventory
feed, and the resource data does not mark which shelters those are, so every
`shelter` place is excluded until it is added to `ALLOWED_SHELTER_IDS` on
purpose. Ineligible locations behave as if they do not exist.
"""

from __future__ import annotations

from dataclasses import dataclass

from src.server.resources.pantries import list_pantries
from src.server.resources.places import list_safe_places

#: Safe-place categories that may hold inventory. `shelter` is deliberately absent.
ALLOWED_SAFE_PLACE_CATEGORIES: frozenset[str] = frozenset({"safe_place"})

#: Shelters that a coordinator has explicitly confirmed are not domestic-safety. Empty on purpose.
ALLOWED_SHELTER_IDS: frozenset[str] = frozenset()


@dataclass(frozen=True)
class InventoryLocation:
    id: str
    name: str
    kind: str  # "pantry" or "safe-place"
    district: str
    address: str
    latitude: float
    longitude: float


def eligible_locations() -> dict[str, InventoryLocation]:
    found: dict[str, InventoryLocation] = {}
    for p in list_pantries(open_now=None, no_id_required=None, district=None):
        found[p.id] = InventoryLocation(p.id, p.name, "pantry", p.district, p.address, p.latitude, p.longitude)
    for s in list_safe_places(None, False):
        allowed = s.category in ALLOWED_SAFE_PLACE_CATEGORIES or s.id in ALLOWED_SHELTER_IDS
        if allowed:
            found[s.id] = InventoryLocation(s.id, s.name, "safe-place", s.district, s.address, s.latitude, s.longitude)
    return found
