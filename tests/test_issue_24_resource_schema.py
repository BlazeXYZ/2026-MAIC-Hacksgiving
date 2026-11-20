"""Issue #24: community resource schemas and GeoJSON."""

import sys
from pathlib import Path

import pytest
from pydantic import ValidationError

REPO_ROOT = Path(__file__).resolve().parent.parent
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from src.server.resources.schema import (
    CommunityResource,
    to_feature_collection,
)

CONTRACTS = REPO_ROOT / "src" / "client" / "src" / "contracts" / "resources.ts"


def test_resource_geojson_uses_lon_lat_order():
    place = CommunityResource(
        id="demo-shelter",
        name="Demo Family Center",
        category="shelter",
        address="100 Demo Ave, Milwaukee, WI 53202",
        latitude=43.05,
        longitude=-87.91,
        phone="414-555-0152",
        hours_description="Demo hours.",
        is_staffed=True,
        no_id_required=True,
    )
    feature = place.to_feature()
    assert feature["geometry"]["coordinates"] == [-87.91, 43.05]
    collection = to_feature_collection([place])
    assert collection["type"] == "FeatureCollection"
    assert collection["features"][0]["id"] == "demo-shelter"
    assert "414-555-0152" in feature["properties"]["phone"]


def test_resource_rejects_impossible_coordinates():
    with pytest.raises(ValidationError):
        CommunityResource(
            id="bad",
            name="Nowhere",
            category="shelter",
            address="100 Demo Ave",
            latitude=120,
            longitude=-87.9,
            hours_description="n/a",
            is_staffed=False,
            no_id_required=True,
        )


def test_frontend_contract_uses_the_same_field_names():
    text = CONTRACTS.read_text(encoding="utf-8")
    for name in (
        "hours_description",
        "no_id_required",
        "latitude",
        "longitude",
        "is_staffed",
        "accessibility_notes",
        "open_now",
    ):
        assert name in text
