"""Process-local inventory, item catalog, and alias table.

One lock covers every read and write, like `intake/store.py`. A later
database issue can replace this module without touching the API.

The alias table is curated by people. Only seeded and coordinator-approved
wordings are ever stored; anything the system works out by itself (a fuzzy
match, a model answer) is recomputed each time and kept only as a flagged
guess on the entry, so a misspelling can never end up in the table.
"""

from __future__ import annotations

import difflib
import re
import threading
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Literal

from src.server.inventory.catalog import SEED_ITEMS

Kind = Literal["have", "need", "offer"]
AliasStatus = Literal["seeded", "approved", "rejected"]
AliasSource = Literal["seed", "coordinator"]

#: How long an entry stays visible. Old requests mislead, so everything expires.
TTL: dict[str, timedelta] = {
    "need": timedelta(days=14),
    "offer": timedelta(days=7),
    "have": timedelta(days=30),
}

#: Alias statuses that count when matching. `rejected` is kept only as a block list.
TRUSTED: frozenset[str] = frozenset({"seeded", "approved"})

#: How an entry was matched when the system, not a person, made the call. These are never "verified".
GUESS_VIA: frozenset[str] = frozenset({"fuzzy", "model"})

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


class InvalidHandoff(InventoryError):
    """The hand-off breaks a rule. The message is safe to show a coordinator."""


class SimilarItems(InventoryError):
    """The new item looks like one that already exists. Carries the closest matches."""

    def __init__(self, matches: list[Similar]) -> None:
        super().__init__(", ".join(m.item.id for m in matches))
        self.matches = matches


def now_utc() -> datetime:
    return datetime.now(timezone.utc)


def _as_utc(value: datetime) -> datetime:
    """Normalize SQLAlchemy SQLite timestamps to the timezone-aware runtime format."""
    return value.replace(tzinfo=timezone.utc) if value.tzinfo is None else value


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


@dataclass(frozen=True)
class Candidate:
    """One item the model thought a wording might be."""

    item_id: str
    probability: float | None  # None when the model gave a single answer with no probabilities


@dataclass
class Entry:
    id: str
    location_id: str
    kind: Kind
    quantity: int
    label: str  # what the person typed, already scrubbed of contact details
    item_id: str | None
    alias_id: str | None
    via: str  # how it was matched: picked, alias, phrase, fuzzy, model, coordinator, unmatched
    created_at: datetime
    expires_at: datetime
    closed: bool = False
    candidates: tuple[Candidate, ...] = ()  # the model's top choices, best first
    none_fit: float | None = None  # the model's probability that no catalog item fits


@dataclass(frozen=True)
class Handoff:
    """Something passed from one place to another. No names: only where, what, and how many."""

    id: str
    item_id: str
    quantity: int
    from_location_id: str
    to_location_id: str | None
    remaining: int  # how many the giving entry had left afterwards
    need_remaining: int | None  # how many the receiving need still asked for afterwards
    at: datetime


@dataclass(frozen=True)
class Similar:
    item: Item
    wording: str  # the existing wording that looked closest
    score: float  # 0 to 1


#: Shown as a hint on a held entry.
HINT_SCORE = 0.6
#: At or above this, creating a "new" item needs an explicit confirmation.
WARN_SCORE = 0.72
_STOPWORDS = frozenset({"and", "of", "the", "a", "an", "for", "with"})

_items: dict[str, Item] = {}
_aliases: dict[str, Alias] = {}
_entries: dict[str, Entry] = {}
_handoffs: list[Handoff] = []
_counters = {"al": 0, "en": 0, "ho": 0}


def _db_session():
    """Return a live shared-database session, or None for standalone/unit use."""
    try:
        from src.server.db import create_db_session

        return create_db_session()
    except ModuleNotFoundError:
        return None


def _counter_from_id(prefix: str, ids: list[str]) -> int:
    numbers = []
    for value in ids:
        if value.startswith(prefix + "-"):
            try:
                numbers.append(int(value.rsplit("-", 1)[1]))
            except ValueError:
                pass
    return max(numbers, default=0)


def reload_from_db() -> None:
    """Reload all shared inventory state after database initialization or process startup."""
    with _lock:
        session = _db_session()
        if session is None:
            return
        needs_seed = False
        try:
            from src.server.db import (
                InventoryAlias,
                InventoryEntry,
                InventoryHandoff,
                InventoryItem,
            )

            _items.clear()
            _aliases.clear()
            _entries.clear()
            _handoffs.clear()
            for row in session.query(InventoryItem).all():
                _items[row.id] = Item(row.id, row.name)
            needs_seed = not _items
            for row in session.query(InventoryAlias).all():
                _aliases[row.id] = Alias(
                    row.id,
                    row.text,
                    row.item_id,
                    row.status,
                    row.source,
                    _as_utc(row.created_at),
                )
            for row in session.query(InventoryEntry).all():
                candidates = tuple(
                    Candidate(candidate["item_id"], candidate.get("probability"))
                    for candidate in (row.candidates or [])
                )
                _entries[row.id] = Entry(
                    row.id,
                    row.location_id,
                    row.kind,
                    row.quantity,
                    row.label,
                    row.item_id,
                    row.alias_id,
                    row.via,
                    _as_utc(row.created_at),
                    _as_utc(row.expires_at),
                    row.closed,
                    candidates,
                    row.none_fit,
                )
            for row in session.query(InventoryHandoff).all():
                _handoffs.append(
                    Handoff(
                        row.id,
                        row.item_id,
                        row.quantity,
                        row.from_location_id,
                        row.to_location_id,
                        row.remaining,
                        row.need_remaining,
                        _as_utc(row.at),
                    )
                )
            _handoffs.sort(key=lambda record: record.at)
            _counters["al"] = _counter_from_id("al", list(_aliases))
            _counters["en"] = _counter_from_id("en", list(_entries))
            _counters["ho"] = _counter_from_id("ho", [record.id for record in _handoffs])
        finally:
            session.close()
        if needs_seed:
            reset()


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
        _handoffs.clear()
        _counters.update(al=0, en=0, ho=0)
        taken: set[str] = set()
        for item_id, name, extras in SEED_ITEMS:
            _items[item_id] = Item(item_id, name)
            for text in (name, *extras):
                key = normalize(text)
                if key not in taken:
                    taken.add(key)
                    _add_alias_locked(text, item_id, "seeded", "seed", now_utc())
        session = _db_session()
        if session is not None:
            try:
                from src.server.db import (
                    InventoryAlias,
                    InventoryEntry,
                    InventoryHandoff,
                    InventoryItem,
                )

                session.query(InventoryHandoff).delete()
                session.query(InventoryEntry).delete()
                session.query(InventoryAlias).delete()
                session.query(InventoryItem).delete()
                for item in _items.values():
                    session.add(InventoryItem(id=item.id, name=item.name))
                for alias in _aliases.values():
                    session.add(
                        InventoryAlias(
                            id=alias.id,
                            text=alias.text,
                            item_id=alias.item_id,
                            status=alias.status,
                            source=alias.source,
                            created_at=alias.created_at,
                        )
                    )
                session.commit()
            except Exception:
                session.rollback()
                raise
            finally:
                session.close()


# ---------- catalog ----------


def list_items() -> list[Item]:
    with _lock:
        reload_from_db()
        return list(_items.values())


def get_item(item_id: str) -> Item:
    with _lock:
        reload_from_db()
        if item_id not in _items:
            raise ItemNotFound(item_id)
        return _items[item_id]


def rename_item(item_id: str, name: str) -> Item:
    with _lock:
        reload_from_db()
        item = get_item(item_id)
        item.name = name.strip()
        session = _db_session()
        if session is not None:
            try:
                from src.server.db import InventoryItem

                row = session.get(InventoryItem, item.id)
                if row is not None:
                    row.name = item.name
                    session.commit()
            except Exception:
                session.rollback()
                raise
            finally:
                session.close()
        return item


def _similarity(a: str, b: str) -> float:
    """How alike two normalized wordings are. A short wording fully inside a longer one counts as close."""
    ratio = difflib.SequenceMatcher(None, a, b).ratio()
    ta = {w for w in a.split() if w not in _STOPWORDS}
    tb = {w for w in b.split() if w not in _STOPWORDS}
    if not ta or not tb:
        return ratio
    shared = len(ta & tb)
    smaller = min(len(ta), len(tb))
    overlap = 0.9 if shared == smaller else 0.6 * shared / smaller
    return max(ratio, overlap)


def similar_items(text: str, *, min_score: float = HINT_SCORE, limit: int = 3) -> list[Similar]:
    """Existing items whose wordings look like `text`, closest first, one entry per item."""
    key = normalize(text)
    if not key:
        return []
    with _lock:
        best: dict[str, Similar] = {}
        for alias in _aliases.values():
            if alias.status == "rejected" or alias.item_id not in _items:
                continue
            score = _similarity(key, alias.key)
            if score >= min_score and (alias.item_id not in best or score > best[alias.item_id].score):
                best[alias.item_id] = Similar(_items[alias.item_id], alias.text, round(score, 2))
        return sorted(best.values(), key=lambda m: -m.score)[:limit]


def _slug(name: str) -> str:
    return "-".join(re.sub(r"[^a-z0-9]+", " ", name.casefold()).split())[:60] or "item"


def add_item(name: str, extra_aliases: tuple[str, ...] = (), *, confirm_new: bool = False) -> Item:
    """A coordinator adds a catalog item the seed list does not have, with the wordings that mean it.

    If the name looks like an existing item, raises `SimilarItems` unless `confirm_new` is set, so
    "another name for something we already have" is not created as a duplicate by accident.
    Held and guessed entries that use any of these wordings are matched to the new item right away.
    """
    with _lock:
        reload_from_db()
        clean = name.strip()
        wordings = [clean, *(a.strip() for a in extra_aliases if a.strip())]
        index = alias_index()
        for text in wordings:
            if normalize(text) in index:
                raise AliasConflict(index[normalize(text)].id)
        if not confirm_new:
            close: dict[str, Similar] = {}
            for text in wordings:
                for found in similar_items(text, min_score=WARN_SCORE):
                    if found.item.id not in close or found.score > close[found.item.id].score:
                        close[found.item.id] = found
            if close:
                raise SimilarItems(sorted(close.values(), key=lambda m: -m.score))
        base = _slug(clean)
        item_id, n = base, 2
        while item_id in _items:
            item_id, n = f"{base}-{n}", n + 1
        item = _items[item_id] = Item(item_id, clean)
        seen: set[str] = set()
        created_aliases = []
        for text in wordings:
            key = normalize(text)
            if key and key not in seen:
                seen.add(key)
                created_aliases.append(
                    _add_alias_locked(text, item.id, "approved", "coordinator", now_utc())
                )
        rematch_unresolved()
        session = _db_session()
        if session is not None:
            try:
                from src.server.db import InventoryAlias, InventoryEntry, InventoryItem

                session.add(InventoryItem(id=item.id, name=item.name))
                for alias in created_aliases:
                    session.add(
                        InventoryAlias(
                            id=alias.id,
                            text=alias.text,
                            item_id=alias.item_id,
                            status=alias.status,
                            source=alias.source,
                            created_at=alias.created_at,
                        )
                    )
                for entry in _entries.values():
                    row = session.get(InventoryEntry, entry.id)
                    if (
                        row is not None
                        and (row.item_id != entry.item_id or row.alias_id != entry.alias_id or row.via != entry.via)
                    ):
                        row.item_id = entry.item_id
                        row.alias_id = entry.alias_id
                        row.via = entry.via
                session.commit()
            except Exception:
                session.rollback()
                raise
            finally:
                session.close()
        return item


# ---------- aliases ----------


def list_aliases(status: str | None = None) -> list[Alias]:
    with _lock:
        reload_from_db()
        found = [a for a in _aliases.values() if status is None or a.status == status]
        return sorted(found, key=lambda a: (a.item_id, a.text.casefold()))


def get_alias(alias_id: str) -> Alias:
    with _lock:
        reload_from_db()
        if alias_id not in _aliases:
            raise AliasNotFound(alias_id)
        return _aliases[alias_id]


def alias_index() -> dict[str, Alias]:
    """Normalized text -> alias, for every alias that has not been rejected. All of them are trusted."""
    with _lock:
        return {a.key: a for a in _aliases.values() if a.status in TRUSTED}


def rejected_keys() -> set[str]:
    """Wordings a coordinator turned down. The system must not guess them again."""
    with _lock:
        return {a.key for a in _aliases.values() if a.status == "rejected"}


def add_alias(text: str, item_id: str, *, at: datetime | None = None) -> Alias:
    """A coordinator teaches the system another wording for an existing item."""
    with _lock:
        reload_from_db()
        get_item(item_id)
        clash = alias_index().get(normalize(text))
        if clash is not None:
            raise AliasConflict(clash.id)
        alias = _add_alias_locked(text, item_id, "approved", "coordinator", at or now_utc())
        rematch_unresolved()
        session = _db_session()
        if session is not None:
            try:
                from src.server.db import InventoryAlias, InventoryEntry

                session.add(
                    InventoryAlias(
                        id=alias.id,
                        text=alias.text,
                        item_id=alias.item_id,
                        status=alias.status,
                        source=alias.source,
                        created_at=alias.created_at,
                    )
                )
                for entry in _entries.values():
                    row = session.get(InventoryEntry, entry.id)
                    if row is not None and entry.alias_id == alias.id:
                        row.item_id, row.alias_id, row.via = entry.item_id, entry.alias_id, entry.via
                session.commit()
            except Exception:
                session.rollback()
                raise
            finally:
                session.close()
        return alias


def update_alias(
    alias_id: str,
    *,
    text: str | None = None,
    item_id: str | None = None,
    status: Literal["approved", "rejected"] | None = None,
) -> Alias:
    """Coordinator edit: rename, remap, or reject or restore an alias.

    Entries that matched this alias follow it: a remap moves them to the new
    item, and a rejection sends them back to the held list.
    """
    with _lock:
        reload_from_db()
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
                rejected_entry_ids = {
                    entry.id for entry in _entries.values() if entry.alias_id == alias.id
                }
                for entry in _entries.values():
                    if entry.alias_id == alias.id:
                        entry.item_id, entry.alias_id, entry.via = None, None, "unmatched"
            else:
                rejected_entry_ids = set()
                rematch_unresolved()
        else:
            rejected_entry_ids = set()
        session = _db_session()
        if session is not None:
            try:
                from src.server.db import InventoryAlias, InventoryEntry

                row = session.get(InventoryAlias, alias.id)
                if row is not None:
                    row.text, row.item_id, row.status = alias.text, alias.item_id, alias.status
                for entry in _entries.values():
                    entry_row = session.get(InventoryEntry, entry.id)
                    if entry_row is not None and entry.id not in rejected_entry_ids and entry.alias_id == alias.id:
                        entry_row.item_id, entry_row.alias_id, entry_row.via = entry.item_id, entry.alias_id, entry.via
                    elif entry_row is not None and entry.id in rejected_entry_ids:
                        entry_row.item_id = None
                        entry_row.alias_id = None
                        entry_row.via = "unmatched"
                session.commit()
            except Exception:
                session.rollback()
                raise
            finally:
                session.close()
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
    candidates: tuple[Candidate, ...] = (),
    none_fit: float | None = None,
    at: datetime | None = None,
) -> Entry:
    with _lock:
        reload_from_db()
        created = at or now_utc()
        entry = Entry(
            _next("en"),
            location_id,
            kind,
            quantity,
            label,
            item_id,
            alias_id,
            via,
            created,
            created + TTL[kind],
            candidates=candidates,
            none_fit=none_fit,
        )
        _entries[entry.id] = entry
        linked = rematch_unresolved() if alias_id is not None else 0
        session = _db_session()
        if session is not None:
            try:
                from src.server.db import InventoryEntry

                session.add(
                    InventoryEntry(
                        id=entry.id,
                        location_id=entry.location_id,
                        kind=entry.kind,
                        quantity=entry.quantity,
                        label=entry.label,
                        item_id=entry.item_id,
                        alias_id=entry.alias_id,
                        via=entry.via,
                        created_at=entry.created_at,
                        expires_at=entry.expires_at,
                        closed=entry.closed,
                        candidates=[
                            {"item_id": candidate.item_id, "probability": candidate.probability}
                            for candidate in entry.candidates
                        ],
                        none_fit=entry.none_fit,
                    )
                )
                if linked:
                    for other in _entries.values():
                        if other.id == entry.id:
                            continue
                        row = session.get(InventoryEntry, other.id)
                        if row is None:
                            continue
                        if (
                            row.item_id != other.item_id
                            or row.alias_id != other.alias_id
                            or row.via != other.via
                        ):
                            row.item_id = other.item_id
                            row.alias_id = other.alias_id
                            row.via = other.via
                session.commit()
            except Exception:
                session.rollback()
                raise
            finally:
                session.close()
        return entry


def get_entry(entry_id: str) -> Entry:
    with _lock:
        reload_from_db()
        if entry_id not in _entries:
            raise EntryNotFound(entry_id)
        return _entries[entry_id]


def _open(entry: Entry, moment: datetime) -> bool:
    return not entry.closed and entry.expires_at > moment


def active_entries(
    *, location_id: str | None = None, kind: str | None = None, item_id: str | None = None, at: datetime | None = None
) -> list[Entry]:
    """Open entries that have been matched to an item and have not expired."""
    moment = at or now_utc()
    with _lock:
        reload_from_db()
        return [
            e
            for e in _entries.values()
            if _open(e, moment)
            and e.item_id is not None
            and (location_id is None or e.location_id == location_id)
            and (kind is None or e.kind == kind)
            and (item_id is None or e.item_id == item_id)
        ]


def unresolved_entries(at: datetime | None = None) -> list[Entry]:
    moment = at or now_utc()
    with _lock:
        reload_from_db()
        return [e for e in _entries.values() if _open(e, moment) and e.item_id is None]


def guess_entries(at: datetime | None = None) -> list[Entry]:
    """Open entries the system matched itself (fuzzy or model) and no person has confirmed."""
    moment = at or now_utc()
    with _lock:
        reload_from_db()
        return [e for e in _entries.values() if _open(e, moment) and e.item_id is not None and e.via in GUESS_VIA]


def rematch_unresolved() -> int:
    """Link held and guessed entries whose wording now has an exact alias. Needs and donations alike."""
    with _lock:
        # Use the caller's working state: reloading here would discard pending alias changes.
        index = alias_index()
        moment = now_utc()
        linked = 0
        for entry in _entries.values():
            if not _open(entry, moment) or (entry.item_id is not None and entry.via not in GUESS_VIA):
                continue
            alias = index.get(normalize(entry.label))
            if alias is not None:
                entry.item_id, entry.alias_id, entry.via = alias.item_id, alias.id, "alias"
                linked += 1
        return linked


@dataclass(frozen=True)
class Guess:
    wording: str
    item: Item
    count: int
    via: str  # "fuzzy" or "model"
    entry_id: str  # one entry with this wording, to act on with resolve or promote
    candidates: tuple[Candidate, ...]


def guesses() -> list[Guess]:
    """Wordings the system matched by itself, grouped, most common first.

    Nothing here is stored as an alias. A coordinator confirms one with `resolve_entry`, typing the
    correct spelling, or turns it into a new item with `promote_entry`.
    """
    with _lock:
        groups: dict[tuple[str, str], list[Entry]] = {}
        for entry in guess_entries():
            assert entry.item_id is not None
            groups.setdefault((normalize(entry.label), entry.item_id), []).append(entry)
        found = [
            Guess(rows[0].label, _items[item_id], len(rows), rows[0].via, rows[0].id, rows[0].candidates)
            for (_, item_id), rows in groups.items()
        ]
        return sorted(found, key=lambda g: (-g.count, g.wording))


def resolve_entry(entry_id: str, item_id: str, *, alias_text: str | None = None) -> Entry:
    """A coordinator sets the item for a held or guessed entry.

    `alias_text` is the correct wording to remember for next time. It is typed by the coordinator, so
    a misspelling is never stored. Leave it out to settle just these entries and learn nothing.
    Every other held or guessed entry with the same typed wording is settled too, needs and donations alike.
    """
    with _lock:
        reload_from_db()
        entry = get_entry(entry_id)
        get_item(item_id)
        index = alias_index()
        alias_id: str | None = None
        if alias_text and normalize(alias_text):
            existing = index.get(normalize(alias_text))
            if existing is not None and existing.item_id != item_id:
                raise AliasConflict(existing.id)
            alias_id = existing.id if existing else _add_alias_locked(
                alias_text, item_id, "approved", "coordinator", now_utc()
            ).id
        key = normalize(entry.label)
        twins = [
            e
            for e in _entries.values()
            if e.id != entry.id
            and _open(e, now_utc())
            and (e.item_id is None or e.via in GUESS_VIA)
            and normalize(e.label) == key
        ]
        for target in [entry, *twins]:
            target.item_id, target.alias_id, target.via = item_id, alias_id, "coordinator"
        session = _db_session()
        if session is not None:
            try:
                from src.server.db import InventoryAlias, InventoryEntry

                if alias_id is not None:
                    alias = _aliases[alias_id]
                    row = session.get(InventoryAlias, alias.id)
                    if row is None:
                        session.add(
                            InventoryAlias(
                                id=alias.id,
                                text=alias.text,
                                item_id=alias.item_id,
                                status=alias.status,
                                source=alias.source,
                                created_at=alias.created_at,
                            )
                        )
                for target in [entry, *twins]:
                    row = session.get(InventoryEntry, target.id)
                    if row is not None:
                        row.item_id = target.item_id
                        row.alias_id = target.alias_id
                        row.via = target.via
                session.commit()
            except Exception:
                session.rollback()
                raise
            finally:
                session.close()
        return entry


def promote_entry(
    entry_id: str, name: str | None = None, *, alias_text: str | None = None, confirm_new: bool = False
) -> Entry:
    """Create a new catalog item and settle the entry, and its twins, to it.

    `name` is the item's name and its first alias; it defaults to the typed wording, so give a clean one
    when the wording was misspelled. `alias_text` adds one more correct wording.
    """
    with _lock:
        entry = get_entry(entry_id)
        title = name.strip() if name and name.strip() else entry.label.title()
        item = add_item(title, (alias_text,) if alias_text else (), confirm_new=confirm_new)
        return resolve_entry(entry.id, item.id)


def handoff(entry_id: str, quantity: int, to_need_id: str | None = None, *, at: datetime | None = None) -> Handoff:
    """Record that `quantity` of a stock or offer entry was passed over.

    The entry shrinks and disappears at zero, so "who can help" stops pointing at it. If `to_need_id` is
    given, that need shrinks too (and closes when covered); handing over more than it asked for is fine.
    """
    moment = at or now_utc()
    with _lock:
        reload_from_db()
        entry = get_entry(entry_id)
        if entry.closed or entry.expires_at <= moment or entry.item_id is None:
            raise InvalidHandoff("That entry is no longer open.")
        if entry.kind not in ("have", "offer"):
            raise InvalidHandoff("Only stock or an offer can be passed over, not a need.")
        if quantity < 1 or quantity > entry.quantity:
            raise InvalidHandoff(f"Only {entry.quantity} {'is' if entry.quantity == 1 else 'are'} available to pass over.")
        need: Entry | None = None
        if to_need_id is not None:
            need = get_entry(to_need_id)
            if need.closed or need.expires_at <= moment or need.item_id is None:
                raise InvalidHandoff("That need is no longer open.")
            if need.kind != "need":
                raise InvalidHandoff("Things can only be passed over to a need.")
            if need.item_id != entry.item_id:
                raise InvalidHandoff("That need is for a different item.")
            if need.location_id == entry.location_id:
                raise InvalidHandoff("That need is at the same place.")
        entry.quantity -= quantity
        if entry.quantity == 0:
            entry.closed = True
        need_remaining: int | None = None
        if need is not None:
            need.quantity = max(0, need.quantity - quantity)
            if need.quantity == 0:
                need.closed = True
            need_remaining = need.quantity
        record = Handoff(
            _next("ho"),
            entry.item_id,
            quantity,
            entry.location_id,
            need.location_id if need is not None else None,
            entry.quantity,
            need_remaining,
            moment,
        )
        _handoffs.append(record)
        session = _db_session()
        if session is not None:
            try:
                from src.server.db import InventoryEntry, InventoryHandoff

                entry_row = session.get(InventoryEntry, entry.id)
                if entry_row is not None:
                    entry_row.quantity = entry.quantity
                    entry_row.closed = entry.closed
                if need is not None:
                    need_row = session.get(InventoryEntry, need.id)
                    if need_row is not None:
                        need_row.quantity = need.quantity
                        need_row.closed = need.closed
                session.add(
                    InventoryHandoff(
                        id=record.id,
                        item_id=record.item_id,
                        quantity=record.quantity,
                        from_location_id=record.from_location_id,
                        to_location_id=record.to_location_id,
                        remaining=record.remaining,
                        need_remaining=record.need_remaining,
                        at=record.at,
                    )
                )
                session.commit()
            except Exception:
                session.rollback()
                raise
            finally:
                session.close()
        return record


def list_handoffs(limit: int = 50) -> list[Handoff]:
    """Most recent first."""
    with _lock:
        reload_from_db()
        return list(reversed(_handoffs))[:limit]


def close_entry(entry_id: str) -> Entry:
    with _lock:
        reload_from_db()
        entry = get_entry(entry_id)
        entry.closed = True
        session = _db_session()
        if session is not None:
            try:
                from src.server.db import InventoryEntry

                row = session.get(InventoryEntry, entry.id)
                if row is not None:
                    row.closed = True
                    session.commit()
            except Exception:
                session.rollback()
                raise
            finally:
                session.close()
        return entry


def is_verified(entry: Entry) -> bool:
    """True when a person accepted how this entry was matched."""
    with _lock:
        if entry.via in GUESS_VIA:
            return False  # the system guessed, even when the answer points at a trusted alias
        if entry.alias_id is None:
            return entry.via in ("picked", "coordinator")
        return _aliases[entry.alias_id].status in TRUSTED


reset()
