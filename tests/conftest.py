"""Shared setup for API tests."""

import sys
from pathlib import Path

import pytest

REPO_ROOT = Path(__file__).resolve().parent.parent
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))


@pytest.fixture(autouse=True)
def _isolated_api(monkeypatch):
    """Keep tests off the network and clear tickets between cases."""
    from src.server.core.config import settings
    from src.server.tickets import reset_state

    monkeypatch.setattr(settings, "OPENAI_API_KEY", None, raising=False)
    monkeypatch.setattr(settings, "GEMINI_API_KEY", None, raising=False)
    reset_state()
    yield
    reset_state()
