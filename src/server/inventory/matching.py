"""Match open needs to places that have or are offering the same item. A plain query, no model."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime

from src.server.ai.dispatch import haversine_m
from src.server.inventory import store
from src.server.inventory.locations import InventoryLocation, eligible_locations


@dataclass(frozen=True)
class Source:
    location: InventoryLocation
    kind: str  # "have" or "offer"
    quantity: int
    distance_m: float


@dataclass(frozen=True)
class Match:
    need: store.Entry
    item: store.Item
    sources: list[Source]


def matches_for(location_id: str, at: datetime | None = None) -> list[Match]:
    """For each open need at `location_id`, the nearest other locations that can fill it."""
    places = eligible_locations()
    here = places[location_id]
    found: list[Match] = []
    for need in store.active_entries(location_id=location_id, kind="need", at=at):
        assert need.item_id is not None  # active_entries only returns matched entries
        sources: list[Source] = []
        for kind in ("have", "offer"):
            for other in store.active_entries(kind=kind, item_id=need.item_id, at=at):
                if other.location_id == location_id or other.location_id not in places:
                    continue
                there = places[other.location_id]
                meters = haversine_m(here.latitude, here.longitude, there.latitude, there.longitude)
                sources.append(Source(there, kind, other.quantity, meters))
        sources.sort(key=lambda s: s.distance_m)
        found.append(Match(need, store.get_item(need.item_id), sources))
    return found
