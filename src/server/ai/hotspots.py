"""Geospatial density and hotspot clustering service (coordinator-facing).

Aggregates help-ticket and incident points into grid cells and outputs
normalized density scores (0.0-1.0) as GeoJSON polygons for the
coordinator dashboard. Hotspot data is strictly coordinator-facing:
endpoints are gated by the X-Coordinator-Key header via ``require_coordinator``.
"""

import math
import os
import secrets
from typing import Any

from fastapi import APIRouter, Depends, Header, HTTPException

try:
    from src.server.core.config import settings
except ModuleNotFoundError:
    from core.config import settings

DEFAULT_CELL_DEG = 0.005  # ~500 m at Milwaukee latitudes
DEV_COORDINATOR_KEY = "dev-coordinator-key"


def get_coordinator_api_key() -> str | None:
    """Return the active coordinator API key, or None if unconfigured / invalid in production."""
    key = getattr(settings, "COORDINATOR_API_KEY", None) or os.getenv("COORDINATOR_API_KEY")
    if getattr(settings, "APP_ENV", "development") == "production":
        # In production, require explicitly configured non-default credential
        if not key or key == DEV_COORDINATOR_KEY:
            return None
        return key
    return key or DEV_COORDINATOR_KEY


COORDINATOR_API_KEY = get_coordinator_api_key() or DEV_COORDINATOR_KEY


def __getattr__(name: str) -> Any:
    if name == "COORDINATOR_API_KEY":
        return get_coordinator_api_key() or DEV_COORDINATOR_KEY
    raise AttributeError(f"module {__name__!r} has no attribute {name!r}")


def bin_points(
    points: list[tuple[float, float]],
    cell_deg: float = DEFAULT_CELL_DEG,
) -> dict[tuple[int, int], int]:
    """Aggregate (lat, lon) points into grid cells keyed by (lon_cell, lat_cell).

    Points with lat outside [-90, 90] or lon outside [-180, 180] are skipped.
    """
    cells: dict[tuple[int, int], int] = {}
    for lat, lon in points:
        if not (-90.0 <= lat <= 90.0) or not (-180.0 <= lon <= 180.0):
            continue
        key = (math.floor(lon / cell_deg), math.floor(lat / cell_deg))
        cells[key] = cells.get(key, 0) + 1
    return cells


def cell_polygon(
    cell: tuple[int, int],
    cell_deg: float = DEFAULT_CELL_DEG,
) -> list[list[float]]:
    """Return a closed GeoJSON ring [[lon, lat] x 5] for the cell's corners."""
    lon_cell, lat_cell = cell
    lon_w = lon_cell * cell_deg
    lat_s = lat_cell * cell_deg
    return [
        [lon_w, lat_s],  # SW
        [lon_w + cell_deg, lat_s],  # SE
        [lon_w + cell_deg, lat_s + cell_deg],  # NE
        [lon_w, lat_s + cell_deg],  # NW
        [lon_w, lat_s],  # SW (close ring)
    ]


def compute_hotspots(
    points: list[tuple[float, float]],
    cell_deg: float = DEFAULT_CELL_DEG,
) -> dict:
    """Build a GeoJSON FeatureCollection of occupied cells with densities.

    Each feature's ``density`` is count / max_count (0.0-1.0); a single-point
    grid yields density 1.0. Empty input returns a FeatureCollection with an
    empty features list.
    """
    cells = bin_points(points, cell_deg)
    max_count = max(cells.values(), default=0)
    features = []
    for cell, count in sorted(cells.items()):
        density = count / max_count if max_count else 0.0
        features.append(
            {
                "type": "Feature",
                "geometry": {
                    "type": "Polygon",
                    "coordinates": [cell_polygon(cell, cell_deg)],
                },
                "properties": {"count": count, "density": density},
            }
        )
    return {"type": "FeatureCollection", "features": features}


# ~25 realistic points around Milwaukee (43.03-43.05, -87.92 to -87.89),
# clustered near 27th St & Wisconsin Ave.
DEMO_POINTS: list[tuple[float, float]] = [
    (43.0389, -87.9047),
    (43.0391, -87.9042),
    (43.0385, -87.9050),
    (43.0393, -87.9045),
    (43.0387, -87.9049),
    (43.0390, -87.9044),
    (43.0392, -87.9048),
    (43.0388, -87.9043),
    (43.0394, -87.9046),
    (43.0386, -87.9044),
    (43.0380, -87.9035),
    (43.0395, -87.9060),
    (43.0375, -87.9055),
    (43.0400, -87.9040),
    (43.0378, -87.9062),
    (43.0402, -87.9053),
    (43.0372, -87.9048),
    (43.0405, -87.9045),
    (43.0370, -87.9058),
    (43.0410, -87.9050),
    (43.0330, -87.9100),
    (43.0490, -87.9200),
    (43.0350, -87.8950),
    (43.0470, -87.9150),
    (43.0310, -87.9000),
    # Secondary cluster near 27th St & Wisconsin Ave (search area).
    (43.0389, -87.9480),
    (43.0391, -87.9475),
    (43.0386, -87.9483),
    (43.0392, -87.9478),
    (43.0384, -87.9472),
    (43.0396, -87.9486),
    (43.0381, -87.9490),
    (43.0398, -87.9470),
    # Walker's Point and Bay View scatter.
    (43.0120, -87.9120),
    (43.0105, -87.9135),
    (43.0140, -87.9100),
    (42.9890, -87.8950),
    (42.9905, -87.8962),
]


def require_coordinator(
    x_coordinator_key: str | None = Header(
        default=None, alias="X-Coordinator-Key"
    ),
) -> None:
    """Dependency rejecting non-coordinator clients with 403 or 503 if unconfigured in production."""
    active_key = get_coordinator_api_key()
    if active_key is None:
        raise HTTPException(
            status_code=503,
            detail="Coordinator access is unconfigured or disabled in this environment.",
        )
    if x_coordinator_key is None or not secrets.compare_digest(
        x_coordinator_key, active_key
    ):
        raise HTTPException(
            status_code=403, detail="Coordinator access required."
        )


router = APIRouter(prefix="/api/v1/coordinator", tags=["coordinator"])


@router.get("/hotspots")
def get_hotspots(
    _authorized: None = Depends(require_coordinator),
) -> dict:
    """Return demo hotspot density grid for the coordinator dashboard."""
    return compute_hotspots(DEMO_POINTS)
