"""Turn what a person typed into a catalog item.

Order, cheapest first:
  1. exact alias            "diapers" -> Diapers
  2. known phrase inside    "two cases of baby formula" -> Infant formula
  3. fuzzy match            "infnat formula" -> Infant formula (saved as a suggestion)
  4. model fallback         one tiny call per phrase we have never seen (saved as a suggestion)
  5. unmatched              held for a coordinator, who can teach the system the phrase

Anything the system guesses (steps 3 and 4) is stored as a `suggested` alias,
so it is used right away but stays flagged until a coordinator approves it.
The model is only asked about phrases the alias table does not know, and its
answer is cached as an alias, so each new phrase costs one call, once.
"""

from __future__ import annotations

import difflib
import logging
import re
from collections.abc import Awaitable, Callable
from dataclasses import dataclass

from src.server.ai.mock import mock_mode_active
from src.server.ai.pii import scrub_pii
from src.server.core.config import settings
from src.server.inventory import store

logger = logging.getLogger(__name__)

FUZZY_CUTOFF = 0.86
MAX_LABEL = 120

#: Given the cleaned text and the catalog, returns an item id, or None for "no match".
ModelPicker = Callable[[str, list[store.Item]], Awaitable[str | None]]


@dataclass(frozen=True)
class Resolution:
    item_id: str | None
    alias_id: str | None
    via: str  # alias, phrase, fuzzy, llm, unmatched


def clean_label(text: str) -> str:
    """Scrub contact details and bound the length before anything is stored or sent to a model."""
    return re.sub(r"\s+", " ", scrub_pii(text)).strip()[:MAX_LABEL]


def _phrase_match(key: str) -> store.Alias | None:
    """The longest known alias that appears as whole words inside `key`."""
    padded = f" {key} "
    best: store.Alias | None = None
    for alias_key, alias in store.alias_index().items():
        if f" {alias_key} " in padded and (best is None or len(alias_key) > len(best.key)):
            best = alias
    return best


def resolve_local(label: str) -> Resolution:
    """Steps 1 to 3. No network, no model, no cost."""
    key = store.normalize(label)
    if not key:
        return Resolution(None, None, "unmatched")
    index = store.alias_index()
    if key in index:
        return Resolution(index[key].item_id, index[key].id, "alias")
    phrase = _phrase_match(key)
    if phrase is not None:
        return Resolution(phrase.item_id, phrase.id, "phrase")
    if key in store.rejected_keys():  # a coordinator already said no; wait for a human instead
        return Resolution(None, None, "unmatched")
    close = difflib.get_close_matches(key, list(index), n=1, cutoff=FUZZY_CUTOFF)
    if close:
        try:
            alias = store.add_alias(label, index[close[0]].item_id, status="suggested", source="fuzzy")
        except store.AliasConflict:  # same text typed twice at once; reuse the first
            alias = store.alias_index()[key]
        return Resolution(alias.item_id, alias.id, "fuzzy")
    return Resolution(None, None, "unmatched")


async def pick_with_model(text: str, items: list[store.Item]) -> str | None:
    """Ask the configured model to choose one catalog id. Returns None when it is off or unsure."""
    if mock_mode_active(settings.GEMINI_API_KEY, settings.OPENAI_API_KEY, settings.AI_MOCK_MODE):
        return None
    from src.server.ai.client import (
        TriageLLMClient,  # imported late so tests and mock mode never touch httpx
    )

    catalog = "\n".join(f"{i.id}: {i.name}" for i in items)
    prompt = (
        "You match donated or requested goods to a fixed list. Reply with exactly one id "
        f"from the list, or NONE if nothing fits. No other words.\n\nList:\n{catalog}\n\nGoods: {text}"
    )
    try:
        answer = (await TriageLLMClient().complete(prompt)).strip().strip("`'\" ").split()[0]
    except Exception:  # noqa: BLE001 - a model failure just means the entry waits for a coordinator
        logger.warning("Inventory model call failed")
        return None
    return answer if answer in {i.id for i in items} else None


async def resolve(label: str, picker: ModelPicker = pick_with_model) -> Resolution:
    """Steps 1 to 5. `label` must already be cleaned with `clean_label`."""
    local = resolve_local(label)
    if local.item_id is not None or not store.normalize(label) or store.normalize(label) in store.rejected_keys():
        return local
    item_id = await picker(label, store.list_items())
    if item_id is None:
        return local
    try:
        alias = store.add_alias(label, item_id, status="suggested", source="llm")
    except store.AliasConflict:
        alias = store.alias_index()[store.normalize(label)]
    return Resolution(alias.item_id, alias.id, "llm")
