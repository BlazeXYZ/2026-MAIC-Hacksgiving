"""Data privacy utility re-exporting PII scrubbing."""

from __future__ import annotations

from src.server.ai.pii import scrub_pii, scrub_ticket

# Alias scrub to scrub_pii for convenience and backwards compatibility
scrub = scrub_pii

__all__ = ["scrub", "scrub_pii", "scrub_ticket"]
