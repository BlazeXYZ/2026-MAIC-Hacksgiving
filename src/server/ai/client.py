"""Async LLM client for the AI triage pipeline.

Calls Gemini or OpenAI (depending on which key is configured) via httpx,
with a deterministic mock-engine fallback on timeout or any failure.
"""

import asyncio
import logging
import time

import httpx

from src.server.core.config import settings

logger = logging.getLogger(__name__)

GEMINI_URL = (
    "https://generativelanguage.googleapis.com/v1beta/models/"
    "{model}:generateContent?key={key}"
)
OPENAI_URL = "https://api.openai.com/v1/chat/completions"


class TriageLLMClient:
    """Minimal async LLM client with timeout + mock fallback."""

    def __init__(self, settings=settings, http_client: httpx.AsyncClient | None = None):
        self.settings = settings
        self._http_client = http_client

    async def complete(self, prompt: str) -> str:
        """Send ``prompt`` to the configured LLM and return raw text."""
        start = time.monotonic()
        if self.settings.GEMINI_API_KEY:
            text, usage = await self._gemini_complete(prompt)
        elif self.settings.OPENAI_API_KEY:
            text, usage = await self._openai_complete(prompt)
        else:
            raise ValueError(
                "No LLM API key configured: set GEMINI_API_KEY or OPENAI_API_KEY"
            )
        latency_ms = (time.monotonic() - start) * 1000
        logger.debug(
            "LLM complete: %.1f ms, usage=%s", latency_ms, usage or "unavailable"
        )
        return text

    async def _request(self, method: str, url: str, **kwargs) -> httpx.Response:
        client = self._http_client or httpx.AsyncClient(
            timeout=self.settings.AI_TIMEOUT_SECONDS
        )
        try:
            response = await client.request(method, url, **kwargs)
        finally:
            if self._http_client is None:
                await client.aclose()
        if response.status_code >= 400:
            raise httpx.HTTPStatusError(
                f"LLM request failed: {response.status_code} {response.text}",
                request=response.request,
                response=response,
            )
        return response

    async def _gemini_complete(self, prompt: str) -> tuple[str, dict]:
        url = GEMINI_URL.format(
            model=self.settings.AI_MODEL, key=self.settings.GEMINI_API_KEY
        )
        payload = {"contents": [{"parts": [{"text": prompt}]}]}
        response = await self._request("POST", url, json=payload)
        data = response.json()
        parts = data.get("candidates", [{}])[0].get("content", {}).get("parts", [])
        text = "".join(p.get("text", "") for p in parts)
        return text, data.get("usageMetadata", {})

    async def _openai_complete(self, prompt: str) -> tuple[str, dict]:
        payload = {
            "model": self.settings.AI_MODEL,
            "messages": [{"role": "user", "content": prompt}],
        }
        response = await self._request(
            "POST",
            OPENAI_URL,
            json=payload,
            headers={"Authorization": f"Bearer {self.settings.OPENAI_API_KEY}"},
        )
        data = response.json()
        text = data.get("choices", [{}])[0].get("message", {}).get("content", "")
        return text, data.get("usage", {})

    async def triage(self, text: str, prompt_builder=None) -> "TriageOutputSchema":
        """Triage ``text`` via the LLM, falling back to the mock engine."""
        if mock_mode_active(self.settings):
            logger.info("AI mock mode active; using MockTriageEngine")
            return await MockTriageEngine().triage(text)

        prompt = await self._build_prompt(text, prompt_builder)
        start = time.monotonic()
        try:
            raw = await asyncio.wait_for(
                self.complete(prompt),
                timeout=self.settings.AI_TIMEOUT_SECONDS,
            )
            latency_ms = (time.monotonic() - start) * 1000
            logger.debug("LLM triage completed in %.1f ms", latency_ms)
            return parse_triage_output(raw)
        except Exception as exc:  # noqa: BLE001 — fallback must catch all failures
            logger.warning(
                "LLM triage failed (%s); falling back to MockTriageEngine", exc
            )
            return await MockTriageEngine().triage(text)

    async def _build_prompt(self, text: str, prompt_builder) -> str:
        if prompt_builder is not None:
            result = prompt_builder(text)
            if asyncio.iscoroutine(result):
                result = await result
            return result
        try:
            from src.server.ai.prompts import build_triage_prompt

            return build_triage_prompt(text)
        except ImportError:
            return (
                "You are an emergency-communication triage assistant. "
                "Analyze the following message and respond with structured "
                "triage data.\n\nMessage:\n" + text
            )


# Shared schema/parser/mock contract provided by PRs #33/#34/#35. TEMPORARY
# fallbacks keep this module importable until those PRs merge.
try:
    from src.server.ai.mock import MockTriageEngine, mock_mode_active
    from src.server.ai.parser import parse_triage_output
    from src.server.ai.schemas import TriageOutputSchema
except ImportError:  # TEMPORARY until PRs #33/#34/#35 merge
    from pydantic import BaseModel, Field

    class TriageOutputSchema(BaseModel):  # type: ignore[no-redef]
        severity: str = Field(default="unknown")
        category: str = Field(default="unknown")
        summary: str = ""
        confidence: float = 0.0

    def parse_triage_output(raw: str) -> "TriageOutputSchema":  # type: ignore[no-redef]
        import json
        import re

        match = re.search(r"\{.*\}", raw, re.DOTALL)
        data = json.loads(match.group(0)) if match else {}
        return TriageOutputSchema(**data)

    class MockTriageEngine:  # type: ignore[no-redef]
        """Deterministic stand-in for PR #35's mock engine."""

        async def triage(self, text: str) -> "TriageOutputSchema":
            return TriageOutputSchema(
                severity="moderate",
                category="general",
                summary=f"Mock triage for: {text[:50]}",
                confidence=0.5,
            )

    def mock_mode_active(settings=None) -> bool:  # type: ignore[no-redef]
        return bool(getattr(settings, "AI_MOCK_MODE", False))
