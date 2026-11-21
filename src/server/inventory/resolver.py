"""Turn what a person typed into a catalog item.

Order, cheapest first:
  1. exact alias            "diapers" -> Diapers
  2. known phrase inside    "two cases of baby formula" -> Infant formula
  3. fuzzy match            "infnat formula" -> Infant formula (a guess)
  4. decision model         "rubish bn" -> top 3 candidates, or "None fit" (a guess)
  5. unmatched              held for a coordinator, with the model's candidates attached

The alias table stays human-curated: only seeded and coordinator-approved wordings are stored.
Fuzzy matches and model answers are recomputed each time and kept on the entry as flagged guesses,
so a misspelling can never end up in the table. A coordinator confirms a guess by typing the correct
wording, or turns it into a new item. Wordings a coordinator rejected are never guessed again.

The decision model (Jev, with Gemini or OpenAI as fallbacks) is only asked about text that steps 1 to 3
could not place, and only sees scrubbed, length-capped wording.
"""

from __future__ import annotations

import difflib
import logging
import re
from collections.abc import Awaitable, Callable
from dataclasses import dataclass

from src.server.ai.pii import scrub_pii
from src.server.core.config import settings
from src.server.inventory import jev, store
from src.server.inventory.jev import ModelAnswer

logger = logging.getLogger(__name__)

FUZZY_CUTOFF = 0.86
MAX_LABEL = 120

#: A model answer is used (and flagged) when its best item is at least this likely and beats "None fit".
#: "Confidence is not permission": it still waits for a coordinator to confirm.
ACCEPT_PROBABILITY = 0.6

#: Given the cleaned text and the catalog, returns the model's ranked answer, or None when it has none.
ModelPicker = Callable[[str, list[store.Item]], Awaitable[ModelAnswer | None]]


@dataclass(frozen=True)
class Resolution:
    item_id: str | None
    alias_id: str | None
    via: str  # alias, phrase, fuzzy, model, unmatched
    candidates: tuple[store.Candidate, ...] = ()
    none_fit: float | None = None


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
        return Resolution(index[close[0]].item_id, index[close[0]].id, "fuzzy")
    return Resolution(None, None, "unmatched")


async def _pick_with_llm(text: str, items: list[store.Item]) -> ModelAnswer | None:
    """The older single-answer path (Gemini or OpenAI): one catalog id or nothing, no probabilities."""
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
    if answer not in {i.id for i in items}:
        return ModelAnswer((), 1.0)
    return ModelAnswer((store.Candidate(answer, None),), 0.0)


async def pick_with_model(text: str, items: list[store.Item]) -> ModelAnswer | None:
    """Ask the configured decision model. Jev is preferred; Gemini or OpenAI are fallbacks; mock mode is silent."""
    if settings.AI_MOCK_MODE:
        return None
    if settings.TYPESAFE_API_KEY:
        return await jev.pick(text, items)
    if settings.GEMINI_API_KEY or settings.OPENAI_API_KEY:
        return await _pick_with_llm(text, items)
    return None


async def resolve(label: str, picker: ModelPicker = pick_with_model) -> Resolution:
    """Steps 1 to 5. `label` must already be cleaned with `clean_label`."""
    local = resolve_local(label)
    key = store.normalize(label)
    if local.item_id is not None or not key or key in store.rejected_keys():
        return local
    answer = await picker(label, store.list_items())
    if answer is None:
        return local
    top = answer.candidates[0] if answer.candidates else None
    if top is not None and (top.probability is None or (top.probability >= ACCEPT_PROBABILITY and top.probability > answer.none_fit)):
        return Resolution(top.item_id, None, "model", answer.candidates, answer.none_fit)
    return Resolution(None, None, "unmatched", answer.candidates, answer.none_fit)
