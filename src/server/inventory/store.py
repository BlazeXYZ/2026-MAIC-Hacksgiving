"""Process-local inventory, item catalog, and alias table.

One lock covers every read and write, like `intake/store.py`. A later
database issue can replace this module without touching the API.
"""

from __future__ import annotations

import re
import threading
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Literal

from src.server.inventory.catalog import SEED_ITEMS

Kind = Literal["have", "need", "offer"]
AliasStatus = Literal["seeded", "suggested", "approved", "rejected"]
AliasSource = Literal["seed", "fuzzy", "llm", "coordinator"]

#: How long an entry stays visible. Old requests mislead, so everything expires.
TTL: dict[str, timedelta] = {
    "need": timedelta(days=14),
    "offer": timedelta(days=7),
    "have": timedelta(days=30),
}

#: Alias statuses that mean a human has accepted the mapping.
TRUSTED: frozenset[str] = frozenset({"seeded", "approved"})

_lock = threading.RLock()


class InventoryError(Exception):
    """Base class for store errors the API turns into HTTP responses."""


class ItemNotFound(InventoryError):
    pass


class AliasNotFound(InventoryError):
    pass


class EntryNotFound(InventoryError):
    pass


class AliasConflict(InventoryError):
    """The alias text already points somewhere else."""


def now_utc() -> datetime:
    return datetime.now(timezone.utc)


def _singular(word: str) -> str:
    if len(word) <= 3 or word.endswith("ss"):
        return word
    if word.endswith("ies"):
        return word[:-3] + "y"
    if word.endswith(("ches", "shes", "xes", "sses")):
        return word[:-2]
    if word.endswith("s"):
        return word[:-1]
    return word


def normalize(text: str) -> str:
    """Lowercase, drop punctuation, singularize each word: `Baby Formulas!` -> `baby formula`."""
    words = re.sub(r"[^a-z0-9]+", " ", text.casefold().replace("&", " and ")).split()
    return " ".join(_singular(w) for w in words)


@dataclass
class Item:
    id: str
    name: str


@dataclass
class Alias:
    id: str
    text: str
    item_id: str
    status: AliasStatus
    source: AliasSource
    created_at: datetime

    @property
    def key(self) -> str:
        return normalize(self.text)


@dataclass
class Entry:
    id: str
    location_id: str
    kind: Kind
    quantity: int
    label: str  # what the person typed, already scrubbed of contact details
    item_id: str | None
    alias_id: str | None
    via: str  # how it was matched: picked, alias, phrase, fuzzy, llm, coordinator, unmatched
    created_at: datetime
    expires_at: datetime
    closed: bool = False


_items: dict[str, Item] = {}
_aliases: dict[str, Alias] = {}
_entries: dict[str, Entry] = {}
_counters = {"al": 0, "en": 0}


def _next(prefix: str) -> str:
    _counters[prefix] += 1
    return f"{prefix}-{_counters[prefix]}"


def _add_alias_locked(text: str, item_id: str, status: AliasStatus, source: AliasSource, at: datetime) -> Alias:
    alias = Alias(_next("al"), text.strip(), item_id, status, source, at)
    _aliases[alias.id] = alias
    return alias


def reset() -> None:
    """Restore the seed catalog and clear all entries. Called at import and by tests."""
    with _lock:
        _items.clear()
        _aliases.clear()
        _entries.clear()
        _counters.update(al=0, en=0)
        taken: set[str] = set()
        for item_id, name, extras in SEED_ITEMS:
            _items[item_id] = Item(item_id, name)
            for text in (name, *extras):
                key = normalize(text)
                if key not in taken:
                    taken.add(key)
                    _add_alias_locked(text, item_id, "seeded", "seed", now_utc())


# ---------- catalog ----------


def list_items() -> list[Item]:
    with _lock:
        return list(_items.values())


def get_item(item_id: str) -> Item:
    with _lock:
        if item_id not in _items:
            raise ItemNotFound(item_id)
        return _items[item_id]


def rename_item(item_id: str, name: str) -> Item:
    with _lock:
        item = get_item(item_id)
        item.name = name.strip()
        return item


# ---------- aliases ----------


def list_aliases(status: str | None = None) -> list[Alias]:
    with _lock:
        found = [a for a in _aliases.values() if status is None or a.status == status]
        return sorted(found, key=lambda a: (a.item_id, a.text.casefold()))


def get_alias(alias_id: str) -> Alias:
    with _lock:
        if alias_id not in _aliases:
            raise AliasNotFound(alias_id)
        return _aliases[alias_id]


def alias_index() -> dict[str, Alias]:
    """Normalized text -> alias, for every alias that has not been rejected."""
    with _lock:
        return {a.key: a for a in _aliases.values() if a.status != "rejected"}


def rejected_keys() -> set[str]:
    """Wordings a coordinator turned down. The system must not guess them again."""
    with _lock:
        return {a.key for a in _aliases.values() if a.status == "rejected"}


def add_alias(
    text: str, item_id: str, *, status: AliasStatus, source: AliasSource, at: datetime | None = None
) -> Alias:
    with _lock:
        get_item(item_id)
        clash = alias_index().get(normalize(text))
        if clash is not None:
            raise AliasConflict(clash.id)
        return _add_alias_locked(text, item_id, status, source, at or now_utc())


def update_alias(
    alias_id: str,
    *,
    text: str | None = None,
    item_id: str | None = None,
    status: AliasStatus | None = None,
) -> Alias:
    """Coordinator edit: rename, remap, approve, or reject.

    Entries that matched this alias follow it: a remap moves them to the new
    item, and a rejection sends them back to the unresolved list.
    """
    with _lock:
        alias = get_alias(alias_id)
        if item_id is not None:
            get_item(item_id)
        if text is not None:
            clash = alias_index().get(normalize(text))
            if clash is not None and clash.id != alias.id:
                raise AliasConflict(clash.id)
            alias.text = text.strip()
        if item_id is not None:
            alias.item_id = item_id
            for entry in _entries.values():
                if entry.alias_id == alias.id:
                    entry.item_id = item_id
        if status is not None:
            alias.status = status
            if status == "rejected":
                for entry in _entries.values():
                    if entry.alias_id == alias.id:
                        entry.item_id, entry.alias_id, entry.via = None, None, "unmatched"
        return alias


# ---------- entries ----------


def add_entry(
    *,
    location_id: str,
    kind: Kind,
    quantity: int,
    label: str,
    item_id: str | None,
    alias_id: str | None,
    via: str,
    at: datetime | None = None,
) -> Entry:
    with _lock:
        created = at or now_utc()
        entry = Entry(
            _next("en"), location_id, kind, quantity, label, item_id, alias_id, via, created, created + TTL[kind]
        )
        _entries[entry.id] = entry
        return entry


def get_entry(entry_id: str) -> Entry:
    with _lock:
        if entry_id not in _entries:
            raise EntryNotFound(entry_id)
        return _entries[entry_id]


def active_entries(
    *, location_id: str | None = None, kind: str | None = None, item_id: str | None = None, at: datetime | None = None
) -> list[Entry]:
    """Open entries that have been matched to an item and have not expired."""
    moment = at or now_utc()
    with _lock:
        return [
            e
            for e in _entries.values()
            if not e.closed
            and e.expires_at > moment
            and e.item_id is not None
            and (location_id is None or e.location_id == location_id)
            and (kind is None or e.kind == kind)
            and (item_id is None or e.item_id == item_id)
        ]


def unresolved_entries(at: datetime | None = None) -> list[Entry]:
    moment = at or now_utc()
    with _lock:
        return [e for e in _entries.values() if not e.closed and e.expires_at > moment and e.item_id is None]


def resolve_entry(entry_id: str, item_id: str, *, remember: bool) -> Entry:
    """A coordinator picks the item for an entry the system could not match."""
    with _lock:
        entry = get_entry(entry_id)
        get_item(item_id)
        entry.item_id, entry.via = item_id, "coordinator"
        key = normalize(entry.label)
        if remember and key and key not in alias_index():
            entry.alias_id = _add_alias_locked(entry.label, item_id, "approved", "coordinator", now_utc()).id
        return entry


def close_entry(entry_id: str) -> Entry:
    with _lock:
        entry = get_entry(entry_id)
        entry.closed = True
        return entry


def is_verified(entry: Entry) -> bool:
    """True when a human accepted how this entry was matched."""
    with _lock:
        if entry.alias_id is None:
            return entry.via in ("picked", "coordinator")
        return _aliases[entry.alias_id].status in TRUSTED


reset()
