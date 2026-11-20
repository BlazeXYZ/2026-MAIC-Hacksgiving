"""Schema contracts for the survey, triage output, and community resources."""

import sys
from pathlib import Path

import pytest
from pydantic import ValidationError

REPO_ROOT = Path(__file__).resolve().parent.parent
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from src.server.intake_schema import SurveyRequest, TriageResult
from src.server.resource_schema import CommunityResource, to_feature_collection

CONTRACTS = REPO_ROOT / "src" / "client" / "src" / "contracts.ts"


def test_survey_schema_round_trip_and_export():
    payload = SurveyRequest(
        selected_options=["Food", "Today"],
        free_text="  need groceries  ",
        district="Haymarket",
        language="en",
    )
    again = SurveyRequest.model_validate(payload.model_dump())
    assert again.free_text == "need groceries"
    assert again.selected_options == ["Food", "Today"]

    schema = SurveyRequest.model_json_schema()
    assert set(schema["properties"]) >= {
        "selected_options",
        "free_text",
        "district",
        "language",
    }
    assert "language" in schema["required"]


def test_survey_rejects_blank_and_bad_types():
    with pytest.raises(ValidationError):
        SurveyRequest(selected_options=[], language="en")
    with pytest.raises(ValidationError):
        SurveyRequest(selected_options=["food"], language="e")
    with pytest.raises(ValidationError):
        SurveyRequest.model_validate({"selected_options": "food", "language": "en"})


def test_triage_schema_rejects_unknown_urgency():
    with pytest.raises(ValidationError):
        TriageResult(
            urgency="whenever",
            category="food",
            summary="You need food.",
        )
    exported = TriageResult.model_json_schema()
    urgency = exported["$defs"]["UrgencyLevel"]["enum"]
    category = exported["$defs"]["ServiceCategory"]["enum"]
    assert urgency == ["urgent", "today", "this_week"]
    assert category == ["food", "ride", "shelter", "warmth", "support", "other"]


def test_resource_geojson_uses_lon_lat_order():
    place = CommunityResource(
        id="sojourner",
        name="Sojourner Family Peace Center",
        category="shelter",
        address="619 W Walnut St, Milwaukee, WI 53212",
        latitude=43.052153,
        longitude=-87.919154,
        phone="414-933-2722",
        hours_description="24/7 crisis line.",
        is_staffed=True,
        no_id_required=True,
    )
    feature = place.to_feature()
    assert feature["geometry"]["coordinates"] == [-87.919154, 43.052153]
    collection = to_feature_collection([place])
    assert collection["type"] == "FeatureCollection"
    assert collection["features"][0]["id"] == "sojourner"


def test_resource_rejects_impossible_coordinates():
    with pytest.raises(ValidationError):
        CommunityResource(
            id="bad",
            name="Nowhere",
            category="shelter",
            address="1 Main St",
            latitude=120,
            longitude=-87.9,
            hours_description="n/a",
            is_staffed=False,
            no_id_required=True,
        )


def test_frontend_contract_uses_the_same_field_names():
    text = CONTRACTS.read_text(encoding="utf-8")
    for name in (
        "selected_options",
        "free_text",
        "district",
        "language",
        "suggested_service_id",
        "hours_description",
        "no_id_required",
        "open_now",
        "lit_corridor",
    ):
        assert name in text
