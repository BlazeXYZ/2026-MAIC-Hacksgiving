"""Tests for Issue #139: distinguishing verified service listings from sample resource data."""

from __future__ import annotations

import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

import pytest

from src.server.core.config import settings
from src.server.resources.pantries import list_pantries
from src.server.resources.places import list_safe_places


def test_resource_provenance_and_verification_attributes() -> None:
    safe = list_safe_places(include_sample=True)
    assert len(safe) >= 8
    verified_safe = [p for p in safe if p.verified]
    sample_safe = [p for p in safe if not p.verified]

    assert len(verified_safe) >= 4
    assert len(sample_safe) >= 4
    assert all(p.provenance == "verified" for p in verified_safe)
    assert all(p.provenance == "sample" for p in sample_safe)

    pantries = list_pantries(open_now=None, no_id_required=None, district=None, include_sample=True)
    assert len(pantries) >= 8
    verified_pantries = [p for p in pantries if p.verified]
    sample_pantries = [p for p in pantries if not p.verified]

    assert len(verified_pantries) >= 2
    assert len(sample_pantries) >= 6
    assert all(p.provenance == "verified" for p in verified_pantries)
    assert all(p.provenance == "sample" for p in sample_pantries)


def test_production_mode_excludes_sample_placeholders_by_default(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(settings, "APP_ENV", "production")

    safe_prod = list_safe_places()
    assert all(p.verified for p in safe_prod)
    assert not any(p.id.startswith("demo_") for p in safe_prod)
    assert not any("Placeholder St" in p.address for p in safe_prod)

    pantries_prod = list_pantries(open_now=None, no_id_required=None, district=None)
    assert all(p.verified for p in pantries_prod)
    assert not any("Placeholder St" in p.address for p in pantries_prod)
