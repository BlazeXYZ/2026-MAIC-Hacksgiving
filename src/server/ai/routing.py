"""Lit-corridor route optimization heuristic.

Graph weighting that prioritizes well-lit ways and main streets over dark
alleys, modeled on OpenStreetMap way tags (``highway=*``, ``lit=yes/no``).

Landmark context (Milwaukee): Diercks Hall <-> MSOE Public Safety
(1025 N Broadway) on the MSOE campus, and the Sojourner Family Peace
Center (619 W Walnut St) in the wider city.
"""

from __future__ import annotations

import heapq
import itertools
import math
from dataclasses import dataclass

# Base cost multiplier per meter, keyed by OSM ``highway`` tag. Lower is
# better: walkable, well-trafficked corridors beat service roads and alleys.
HIGHWAY_MULTIPLIER: dict[str, float] = {
    "pedestrian": 0.8,
    "primary": 1.0,
    "secondary": 1.2,
    "residential": 1.4,
    "service": 2.0,
    # dark alley fallback for anything unmapped / alley-like
    "alley": 2.5,
    "unclassified": 2.5,
}

# Lighting multipliers applied on top of the highway multiplier.
LIT_MULTIPLIER: dict[str, float] = {
    "yes": 0.6,
    "no": 1.8,
}
LIT_MISSING_MULTIPLIER = 1.3


def way_cost(tags: dict[str, str], length_m: float) -> float:
    """Return the routing cost of traversing ``length_m`` of a way.

    Cost = length_m x highway multiplier x lighting multiplier.
    Well-lit pedestrian/primary corridors are cheapest; unlit alleys are
    penalized heavily.
    """
    highway = tags.get("highway", "unclassified")
    base = HIGHWAY_MULTIPLIER.get(highway, HIGHWAY_MULTIPLIER["unclassified"])
    lit = tags.get("lit")
    lighting = LIT_MULTIPLIER.get(lit, LIT_MISSING_MULTIPLIER)
    return length_m * base * lighting


@dataclass(frozen=True)
class Way:
    """A single OSM-style way: an ordered sequence of node ids plus tags."""

    nodes: tuple[str, ...]
    tags: dict[str, str]
    length_m: float


@dataclass(frozen=True)
class RouteGraph:
    """A routable graph: node coordinates plus a tuple of ways."""

    nodes: dict[str, tuple[float, float]]
    ways: tuple[Way, ...]

    def neighbors(self, node_id: str) -> list[tuple[str, float]]:
        """Return ``(neighbor_id, cost)`` pairs reachable from ``node_id``."""
        result: list[tuple[str, float]] = []
        for way in self.ways:
            node_ids = way.nodes
            if node_id in node_ids:
                index = node_ids.index(node_id)
                for other_index in (index - 1, index + 1):
                    if 0 <= other_index < len(node_ids):
                        neighbor = node_ids[other_index]
                        result.append((neighbor, way_cost(way.tags, way.length_m)))
        return result


def shortest_lit_path(graph: RouteGraph, origin: str, destination: str) -> list[str]:
    """Dijkstra shortest path (by ``way_cost``) from origin to destination.

    Raises ``ValueError`` if either node is unknown or the destination is
    unreachable from the origin.
    """
    if origin not in graph.nodes:
        raise ValueError(f"unknown origin node: {origin!r}")
    if destination not in graph.nodes:
        raise ValueError(f"unknown destination node: {destination!r}")

    distances: dict[str, float] = {origin: 0.0}
    previous: dict[str, str] = {}
    heap: list[tuple[float, str]] = [(0.0, origin)]
    visited: set[str] = set()

    while heap:
        dist, node = heapq.heappop(heap)
        if node in visited:
            continue
        visited.add(node)
        if node == destination:
            break
        for neighbor, cost in graph.neighbors(node):
            if neighbor in visited:
                continue
            new_dist = dist + cost
            if new_dist < distances.get(neighbor, math.inf):
                distances[neighbor] = new_dist
                previous[neighbor] = node
                heapq.heappush(heap, (new_dist, neighbor))

    if destination not in distances:
        raise ValueError(f"destination {destination!r} unreachable from {origin!r}")

    path: list[str] = []
    node = destination
    while node != origin:
        path.append(node)
        node = previous[node]
    path.append(origin)
    path.reverse()
    return path


def _haversine_m(a: tuple[float, float], b: tuple[float, float]) -> float:
    """Approximate great-circle distance in meters between (lat, lon) points."""
    lat1, lon1 = math.radians(a[0]), math.radians(a[1])
    lat2, lon2 = math.radians(b[0]), math.radians(b[1])
    dlat = lat2 - lat1
    dlon = lon2 - lon1
    h = (
        math.sin(dlat / 2) ** 2
        + math.cos(lat1) * math.cos(lat2) * math.sin(dlon / 2) ** 2
    )
    return 6371000.0 * 2 * math.asin(math.sqrt(h))


def _way_length_m(graph: RouteGraph, way: Way) -> float:
    """Length of a way computed from node coordinates, if available."""
    if len(way.nodes) < 2:
        return 0.0
    total = 0.0
    for first, second in zip(way.nodes, way.nodes[1:]):
        a = graph.nodes.get(first)
        b = graph.nodes.get(second)
        if a is None or b is None:
            continue
        total += _haversine_m(a, b)
    return total


def path_summary(graph: RouteGraph, path: list[str]) -> dict:
    """Summarize a routed path for display/tests.

    Returns total ``distance_m``, total ``cost``, and ``lit_fraction``
    (fraction of the path's *length* spent on ways tagged ``lit=yes``).
    """
    distance_m = 0.0
    cost = 0.0
    lit_distance = 0.0
    for first, second in itertools.pairwise(path):
        for way in graph.ways:
            node_ids = way.nodes
            if first in node_ids and second in node_ids:
                index_a = node_ids.index(first)
                index_b = node_ids.index(second)
                if abs(index_a - index_b) == 1:
                    length = way.length_m
                    distance_m += length
                    cost += way_cost(way.tags, length)
                    if way.tags.get("lit") == "yes":
                        lit_distance += length
                    break
    lit_fraction = lit_distance / distance_m if distance_m > 0 else 0.0
    return {"distance_m": distance_m, "cost": cost, "lit_fraction": lit_fraction}


def build_demo_graph() -> RouteGraph:
    """Build a small Milwaukee graph around MSOE and the near west side.

    Contains Diercks Hall, MSOE Public Safety (1025 N Broadway), the
    Sojourner Family Peace Center (619 W Walnut St), and campus/street
    intersections on Broadway and Walnut. Includes both a short dark
    service alley and a slightly longer lit pedestrian way connecting the
    same endpoints, so the router provably prefers lit paths.
    """
    # Approximate coordinates (lat, lon).
    nodes: dict[str, tuple[float, float]] = {
        "diercks_hall": (43.0440, -87.9065),
        "campus_center": (43.0445, -87.9075),
        "msoe_public_safety": (43.0455, -87.9079),  # 1025 N Broadway
        "broadway_arch": (43.0432, -87.9071),
        "broadway_state": (43.0443, -87.9074),
        "broadwell_e_state": (43.0448, -87.9076),
        "broadway_walnut": (43.0480, -87.9082),
        "alley_mid": (43.0441, -87.9069),
        "sojourner": (43.0525, -87.9140),  # 619 W Walnut St
        "walnut_4th": (43.0522, -87.9120),
        "walnut_6th": (43.0528, -87.9160),
        "van_buren_walnut": (43.0520, -87.9090),
        "kleg_walnut": (43.0526, -87.9105),
        "water_walnut": (43.0518, -87.9080),
        # Deliberately isolated: used to exercise the unreachable error path.
        "isolated_node": (43.0600, -87.9200),
    }

    def edge(a: str, b: str, tags: dict[str, str]) -> Way:
        length = _haversine_m(nodes[a], nodes[b])
        return Way(nodes=(a, b), tags=dict(tags), length_m=length)

    lit_ped = {"highway": "pedestrian", "lit": "yes"}
    lit_primary = {"highway": "primary", "lit": "yes"}
    lit_residential = {"highway": "residential", "lit": "yes"}
    dark_alley = {"highway": "service", "lit": "no"}

    ways = [
        # Lit pedestrian spine through campus.
        edge("diercks_hall", "campus_center", lit_ped),
        edge("campus_center", "broadwell_e_state", lit_ped),
        edge("broadwell_e_state", "msoe_public_safety", lit_ped),
        # Lit primary (Broadway) route.
        edge("diercks_hall", "broadway_arch", lit_primary),
        edge("broadway_arch", "broadway_state", lit_primary),
        edge("broadway_state", "broadwell_e_state", lit_primary),
        edge("broadwell_e_state", "broadway_walnut", lit_primary),
        # Short DARK alley connecting the same endpoints as the lit
        # pedestrian spine (diercks_hall side -> broadway_state side).
        edge("diercks_hall", "alley_mid", dark_alley),
        edge("alley_mid", "broadway_state", dark_alley),
        # Walnut corridor west toward Sojourner Family Peace Center.
        edge("broadway_walnut", "water_walnut", lit_primary),
        edge("water_walnut", "van_buren_walnut", lit_residential),
        edge("van_buren_walnut", "kleg_walnut", lit_residential),
        edge("kleg_walnut", "walnut_4th", lit_residential),
        edge("walnut_4th", "sojourner", lit_residential),
        # Alternate lit path via 6th.
        edge("sojourner", "walnut_6th", lit_residential),
    ]

    return RouteGraph(nodes=nodes, ways=tuple(ways))
