"""Tests for the lit-corridor route weighting heuristic (issue #40)."""

import itertools
import random
import sys
import time
from pathlib import Path

# Ensure repository root is on sys.path
REPO_ROOT = Path(__file__).resolve().parent.parent
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

import pytest

from src.server.ai.routing import (
    RouteGraph,
    Way,
    build_demo_graph,
    path_summary,
    shortest_lit_path,
    way_cost,
)


def _assert_valid_path(graph, path, origin, destination):
    assert path[0] == origin
    assert path[-1] == destination
    assert all(node in graph.nodes for node in path)
    # Every consecutive pair must be connected by some way.
    for first, second in itertools.pairwise(path):
        connected = any(
            first in way.nodes and second in way.nodes for way in graph.ways
        )
        assert connected, f"no way connects {first!r} to {second!r}"


def test_routes_diercks_to_public_safety():
    graph = build_demo_graph()
    path = shortest_lit_path(graph, "diercks_hall", "msoe_public_safety")
    _assert_valid_path(graph, path, "diercks_hall", "msoe_public_safety")


def test_routes_diercks_to_sojourner():
    graph = build_demo_graph()
    path = shortest_lit_path(graph, "diercks_hall", "sojourner")
    _assert_valid_path(graph, path, "diercks_hall", "sojourner")


def test_lit_path_beats_shorter_dark_alley():
    graph = build_demo_graph()
    path = shortest_lit_path(graph, "diercks_hall", "msoe_public_safety")

    # The chosen path must exclude the dark alley nodes.
    assert "alley_mid" not in path
    assert "broadway_state" not in path  # only reachable via the alley here

    summary = path_summary(graph, path)
    assert summary["lit_fraction"] > 0.5


def test_way_cost_ordering():
    lit_ped = way_cost({"highway": "pedestrian", "lit": "yes"}, 1.0)
    unlit_res = way_cost({"highway": "residential"}, 1.0)
    dark_alley = way_cost({"highway": "service", "lit": "no"}, 1.0)
    assert lit_ped < unlit_res < dark_alley


def test_unknown_node_raises_value_error():
    graph = build_demo_graph()
    with pytest.raises(ValueError):
        shortest_lit_path(graph, "diercks_hall", "nowhere")
    with pytest.raises(ValueError):
        shortest_lit_path(graph, "nowhere", "diercks_hall")


def test_unreachable_node_raises_value_error():
    graph = build_demo_graph()
    with pytest.raises(ValueError):
        shortest_lit_path(graph, "diercks_hall", "isolated_node")


def test_performance_random_grid():
    rng = random.Random(40)
    size = 30  # 30x30 grid = 900 nodes
    nodes = {
        f"n{x}_{y}": (43.0 + x * 0.001, -87.9 - y * 0.001)
        for x in range(size)
        for y in range(size)
    }
    ways = []
    for x in range(size):
        for y in range(size):
            for nx, ny in ((x + 1, y), (x, y + 1)):
                if nx < size and ny < size:
                    tags = {
                        "highway": rng.choice(
                            [
                                "pedestrian",
                                "primary",
                                "secondary",
                                "residential",
                                "service",
                            ]
                        ),
                        "lit": rng.choice(["yes", "no"]),
                    }
                    ways.append(
                        Way(
                            nodes=(f"n{x}_{y}", f"n{nx}_{ny}"),
                            tags=tags,
                            length_m=rng.uniform(50.0, 150.0),
                        )
                    )
    graph = RouteGraph(nodes=nodes, ways=tuple(ways))
    assert len(nodes) == 900
    assert len(ways) >= 1700

    start = time.perf_counter()
    path = shortest_lit_path(graph, "n0_0", f"n{size - 1}_{size - 1}")
    elapsed = time.perf_counter() - start
    assert len(path) > 1
    assert elapsed < 0.1
