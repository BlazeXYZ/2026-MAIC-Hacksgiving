"""Tests for the geospatial hotspot clustering service (#41)."""

import sys
from pathlib import Path

# Ensure repository root is on sys.path
REPO_ROOT = Path(__file__).resolve().parent.parent
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from fastapi.testclient import TestClient

from src.server.ai.hotspots import (
    DEFAULT_CELL_DEG,
    bin_points,
    cell_polygon,
    compute_hotspots,
)
from src.server.main import app

client = TestClient(app)


def test_bin_points_counts_and_assignment():
    points = [
        (43.03, -87.92),
        (43.03, -87.92),
        (43.03, -87.91),
    ]
    cells = bin_points(points)
    assert sum(cells.values()) == 3
    # Both longitudes fall in distinct cells since cell_deg is 0.005
    # and -87.92/-87.91 differ by 0.01 (> 0.005).
    lon_cells = {key[0] for key in cells}
    assert len(lon_cells) == 2
    assert any(count == 2 for count in cells.values())
    assert any(count == 1 for count in cells.values())


def test_bin_points_skips_invalid():
    points = [
        (91.0, -87.92),
        (-91.0, -87.92),
        (43.03, -181.0),
        (43.03, 181.0),
        (43.03, -87.92),
    ]
    cells = bin_points(points)
    assert sum(cells.values()) == 1


def test_cell_polygon_closed_ring():
    ring = cell_polygon((100, 200), DEFAULT_CELL_DEG)
    assert len(ring) == 5
    assert ring[0] == ring[-1]
    lon_cell, lat_cell = 100, 200
    lon_w = lon_cell * DEFAULT_CELL_DEG
    lat_s = lat_cell * DEFAULT_CELL_DEG
    assert ring[0] == [lon_w, lat_s]  # SW
    assert ring[1] == [lon_w + DEFAULT_CELL_DEG, lat_s]  # SE
    assert ring[2] == [
        lon_w + DEFAULT_CELL_DEG,
        lat_s + DEFAULT_CELL_DEG,
    ]  # NE
    assert ring[3] == [lon_w, lat_s + DEFAULT_CELL_DEG]  # NW


def test_compute_hotspots_structure_and_density():
    points = [
        (43.03, -87.92),
        (43.03, -87.92),
        (43.03, -87.92),
        (43.049, -87.90),
        (43.048, -87.899),
    ]
    result = compute_hotspots(points)
    assert result["type"] == "FeatureCollection"
    cells = bin_points(points)
    assert len(result["features"]) == len(cells)
    densities = []
    for feature in result["features"]:
        assert feature["type"] == "Feature"
        assert feature["geometry"]["type"] == "Polygon"
        assert "properties" in feature
        props = feature["properties"]
        assert isinstance(props["count"], int)
        assert 0.0 <= props["density"] <= 1.0
        densities.append(props["density"])
        ring = feature["geometry"]["coordinates"][0]
        assert ring[0] == ring[-1]
        assert len(ring) == 5
    assert max(densities) == 1.0


def test_compute_hotspots_single_point_density_one():
    result = compute_hotspots([(43.03, -87.92)])
    assert len(result["features"]) == 1
    assert result["features"][0]["properties"]["density"] == 1.0
    assert result["features"][0]["properties"]["count"] == 1


def test_compute_hotspots_empty_input():
    result = compute_hotspots([])
    assert result == {"type": "FeatureCollection", "features": []}


def test_hotspots_endpoint_authorized():
    response = client.get(
        "/api/v1/coordinator/hotspots",
        headers={"X-Coordinator-Key": "dev-coordinator-key"},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["type"] == "FeatureCollection"
    assert len(data["features"]) > 0
    for feature in data["features"]:
        assert feature["geometry"]["type"] == "Polygon"
        assert 0.0 <= feature["properties"]["density"] <= 1.0


def test_hotspots_endpoint_wrong_or_missing_key():
    response = client.get(
        "/api/v1/coordinator/hotspots",
        headers={"X-Coordinator-Key": "wrong-key"},
    )
    assert response.status_code == 403
    response = client.get("/api/v1/coordinator/hotspots")
    assert response.status_code == 403


def test_resident_root_exposes_no_hotspot_data():
    response = client.get("/")
    assert response.status_code == 200
    data = response.json()
    assert "features" not in data
    assert "hotspots" not in data
    assert "density" not in data
