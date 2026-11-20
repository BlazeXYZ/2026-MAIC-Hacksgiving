"""Tests for the async LLM client (TriageLLMClient).

Covers: happy-path Gemini parsing via httpx.MockTransport, error-path and
timeout-path fallback to MockTriageEngine, mock-mode short-circuit, and
debug-level latency logging.

TEMPORARY: schema/parser/mock imports use an inline fallback until PRs
#33/#34/#35 merge.
"""

import asyncio
import logging
import sys
from pathlib import Path

import httpx
import pytest

# Ensure repository root is on sys.path
REPO_ROOT = Path(__file__).resolve().parent.parent
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from src.server.ai.client import TriageLLMClient
from src.server.core.config import Settings

# TEMPORARY fallback until PRs #33/#34/#35 merge
try:
    from src.server.ai.schemas import TriageOutputSchema
except ModuleNotFoundError:  # TEMPORARY
    from src.server.ai.client import TriageOutputSchema


def _make_settings(**overrides):
    settings = Settings()
    settings.GEMINI_API_KEY = "test-key"
    settings.OPENAI_API_KEY = None
    settings.AI_MODEL = "gemini-2.0-flash"
    settings.AI_TIMEOUT_SECONDS = 4.0
    settings.AI_MOCK_MODE = False
    for key, value in overrides.items():
        setattr(settings, key, value)
    return settings


def _gemini_handler(prompt_text: str):
    def handler(request: httpx.Request) -> httpx.Response:
        body = {
            "candidates": [
                {
                    "content": {
                        "parts": [
                            {"text": prompt_text[:20]},
                            {"text": prompt_text[20:]},
                        ]
                    }
                }
            ],
            "usageMetadata": {
                "promptTokenCount": 10,
                "candidatesTokenCount": 5,
                "totalTokenCount": 15,
            },
        }
        return httpx.Response(200, json=body)

    return handler


def test_complete_parses_gemini_response():
    payload = '{"severity": "high", "category": "fire", "summary": "x"}'
    settings = _make_settings()
    transport = httpx.MockTransport(_gemini_handler(payload))
    http_client = httpx.AsyncClient(transport=transport)
    client = TriageLLMClient(settings=settings, http_client=http_client)

    result = asyncio.run(client.complete("test prompt"))

    assert result == payload


def test_triage_happy_path_returns_schema(caplog):
    payload = (
        '{"severity": "high", "category": "fire", '
        '"summary": "Active fire reported", "confidence": 0.9}'
    )
    settings = _make_settings()
    transport = httpx.MockTransport(_gemini_handler(payload))
    http_client = httpx.AsyncClient(transport=transport)
    client = TriageLLMClient(settings=settings, http_client=http_client)

    with caplog.at_level(logging.DEBUG, logger="src.server.ai.client"):
        result = asyncio.run(client.triage("smoke coming from building"))

    assert isinstance(result, TriageOutputSchema)
    assert result.severity == "high"
    assert result.category == "fire"
    assert "ms" in caplog.text


def test_triage_openai_path():
    payload = '{"severity": "low", "category": "noise", "summary": "y"}'

    def handler(request: httpx.Request) -> httpx.Response:
        assert request.headers["Authorization"] == "Bearer openai-key"
        body = {
            "choices": [{"message": {"content": payload}}],
            "usage": {"prompt_tokens": 3, "completion_tokens": 4},
        }
        return httpx.Response(200, json=body)

    settings = _make_settings(OPENAI_API_KEY="openai-key", GEMINI_API_KEY=None)
    transport = httpx.MockTransport(handler)
    http_client = httpx.AsyncClient(transport=transport)
    client = TriageLLMClient(settings=settings, http_client=http_client)

    result = asyncio.run(client.triage("loud music"))

    assert isinstance(result, TriageOutputSchema)
    assert result.severity == "low"


def test_triage_error_falls_back_to_mock(monkeypatch, caplog):
    settings = _make_settings()

    async def failing_complete(prompt: str) -> str:
        request = httpx.Request("POST", "https://example.com")
        raise httpx.HTTPStatusError(
            "boom", request=request, response=httpx.Response(500, request=request)
        )

    monkeypatch.setattr(TriageLLMClient, "complete", failing_complete)
    client = TriageLLMClient(settings=settings)

    with caplog.at_level(logging.WARNING, logger="src.server.ai.client"):
        result = asyncio.run(client.triage("urgent help needed"))

    assert isinstance(result, TriageOutputSchema)
    assert "falling back" in caplog.text


def test_triage_timeout_falls_back_to_mock(monkeypatch):
    settings = _make_settings(AI_TIMEOUT_SECONDS=0.05)

    async def slow_complete(prompt: str) -> str:
        await asyncio.sleep(5)
        return "never"

    monkeypatch.setattr(TriageLLMClient, "complete", slow_complete)
    client = TriageLLMClient(settings=settings)

    result = asyncio.run(client.triage("stuck elevator"))

    assert isinstance(result, TriageOutputSchema)


def test_triage_mock_mode_short_circuits(monkeypatch):
    settings = _make_settings(AI_MOCK_MODE=True)

    async def explode(prompt: str) -> str:
        raise AssertionError("complete() must not be called in mock mode")

    monkeypatch.setattr(TriageLLMClient, "complete", explode)
    client = TriageLLMClient(settings=settings)

    result = asyncio.run(client.triage("anything"))

    assert isinstance(result, TriageOutputSchema)


def test_complete_raises_without_key():
    settings = _make_settings(GEMINI_API_KEY=None, OPENAI_API_KEY=None)
    client = TriageLLMClient(settings=settings)

    with pytest.raises(ValueError, match="No LLM API key"):
        asyncio.run(client.complete("hello"))
