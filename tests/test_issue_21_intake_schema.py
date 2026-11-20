"""Issue #21: intake survey and triage schemas."""

import sys
from pathlib import Path

import pytest
from pydantic import ValidationError

REPO_ROOT = Path(__file__).resolve().parent.parent
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from src.server.intake.schema import (
    SurveyRequest,
    TriageResult,
    export_json_schemas,
)

CONTRACTS = REPO_ROOT / "src" / "client" / "src" / "contracts" / "intake.ts"


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

    exported = export_json_schemas()
    assert set(exported["SurveyRequest"]["properties"]) >= {
        "selected_options",
        "free_text",
        "district",
        "language",
    }
    assert "language" in exported["SurveyRequest"]["required"]


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
    exported = export_json_schemas()["TriageResult"]
    urgency = exported["$defs"]["UrgencyLevel"]["enum"]
    category = exported["$defs"]["ServiceCategory"]["enum"]
    assert urgency == ["urgent", "today", "this_week"]
    assert category == ["food", "ride", "shelter", "warmth", "support", "other"]


def test_frontend_contract_uses_the_same_field_names():
    text = CONTRACTS.read_text(encoding="utf-8")
    for name in (
        "selected_options",
        "free_text",
        "district",
        "language",
        "urgency",
        "category",
        "summary",
        "suggested_service_id",
    ):
        assert name in text
