"""Community inventory API: what each place has, needs, and is offered.

Public routes cover the community side. Everything under `/admin` is for
coordinators and sits behind the same `X-Coordinator-Key` gate as the rest of
the coordinator tools. Entries never record who made them.
"""

from __future__ import annotations

from typing import Literal, NoReturn

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field, model_validator

from src.server.ai.advisor import (
    PantryStockingRequest,
    StockingRecommendation,
    recommend_stocking,
)
from src.server.ai.hotspots import require_coordinator
from src.server.inventory import store
from src.server.inventory.locations import InventoryLocation, eligible_locations
from src.server.inventory.matching import Source, demand_for, matches_for
from src.server.inventory.resolver import clean_label, resolve

router = APIRouter(prefix="/api/v1/inventory", tags=["inventory"])
admin = APIRouter(
    prefix="/admin",
    tags=["inventory-admin"],
    dependencies=[Depends(require_coordinator)],
)


# ---------- shapes ----------


class ItemOut(BaseModel):
    id: str
    name: str


class CatalogItem(ItemOut):
    aliases: list[str]


class LocationOut(BaseModel):
    id: str
    name: str
    kind: str
    district: str
    address: str
    open_needs: int
    have: int
    offers: int


class EntryOut(BaseModel):
    id: str
    item: ItemOut
    quantity: int
    verified: bool = Field(description="False while the match is only a system guess awaiting coordinator review.")
    expires_at: str


class LocationDetail(BaseModel):
    location: LocationOut
    have: list[EntryOut]
    need: list[EntryOut]
    offer: list[EntryOut]


class EntryCreate(BaseModel):
    location_id: str = Field(min_length=1, max_length=80)
    kind: Literal["have", "need", "offer"]
    quantity: int = Field(default=1, ge=1, le=10_000)
    item_id: str | None = Field(default=None, max_length=80, description="Pick from the catalog.")
    text: str | None = Field(default=None, max_length=200, description="Or describe it in your own words.")

    @model_validator(mode="after")
    def one_way_to_name_it(self) -> EntryCreate:
        if bool(self.item_id) == bool(self.text and self.text.strip()):
            raise ValueError("Send exactly one of item_id or text.")
        return self


class EntryResult(BaseModel):
    id: str
    status: Literal["matched", "held"]
    item: ItemOut | None
    via: str
    verified: bool
    message: str


class SourceOut(BaseModel):
    location: str
    location_id: str
    kind: Literal["have", "offer", "need"]
    quantity: int
    distance_miles: float
    entry_id: str = Field(description="The stock, offer, or need this row stands for. Use it to record a hand-off.")


class MatchOut(BaseModel):
    need_id: str
    item: ItemOut
    quantity: int
    sources: list[SourceOut]


class DemandOut(BaseModel):
    entry_id: str
    kind: Literal["have", "offer"]
    item: ItemOut
    quantity: int
    needed_at: list[SourceOut]


class CandidateOut(BaseModel):
    item: ItemOut
    probability: float | None = Field(description="The model's probability for this item, when it gave one.")


class AliasOut(BaseModel):
    id: str
    text: str
    item: ItemOut
    status: str
    source: str
    open_entries: int


class AliasCreate(BaseModel):
    text: str = Field(min_length=1, max_length=80)
    item_id: str = Field(min_length=1, max_length=80)


class AliasUpdate(BaseModel):
    text: str | None = Field(default=None, min_length=1, max_length=80)
    item_id: str | None = Field(default=None, max_length=80)
    status: Literal["approved", "rejected"] | None = None

    @model_validator(mode="after")
    def something_to_change(self) -> AliasUpdate:
        if self.text is None and self.item_id is None and self.status is None:
            raise ValueError("Send at least one of text, item_id, or status.")
        return self


class ItemUpdate(BaseModel):
    name: str = Field(min_length=1, max_length=80)


class ItemCreate(ItemUpdate):
    aliases: list[str] = Field(default_factory=list, max_length=20, description="Other wordings that mean the same thing.")
    confirm_new: bool = Field(default=False, description="Set after reviewing the similar items a 409 listed.")


class PromoteBody(BaseModel):
    name: str | None = Field(
        default=None, min_length=1, max_length=80, description="The new item's name. Defaults to the wording typed, so fix it if it was misspelled."
    )
    alias_text: str | None = Field(default=None, min_length=1, max_length=80, description="One more correct wording to remember.")
    confirm_new: bool = Field(default=False, description="Set after reviewing the similar items a 409 listed.")


class SimilarOut(BaseModel):
    item: ItemOut
    wording: str = Field(description="The existing wording that looked closest.")
    score: float


class UnresolvedOut(BaseModel):
    id: str
    location_id: str
    kind: str
    quantity: int
    label: str
    same_wording: int = Field(description="Held entries with this wording, needs and donations together.")
    candidates: list[CandidateOut] = Field(description="The decision model's top choices, best first. Empty if it was off or unsure.")
    none_fit: float | None = Field(description="The model's probability that no catalog item fits.")
    similar: list[SimilarOut] = Field(description="Existing items this might be another name for, closest first.")
    created_at: str


class GuessOut(BaseModel):
    wording: str
    item: ItemOut
    count: int = Field(description="Open entries matched this way.")
    via: Literal["fuzzy", "model"]
    entry_id: str = Field(description="One entry with this wording. Use it with resolve or promote.")
    candidates: list[CandidateOut]


class HandoffBody(BaseModel):
    quantity: int = Field(ge=1, le=10_000, description="How many were passed over.")
    to_need_id: str | None = Field(
        default=None, max_length=40, description="The open need it went to, if known. That need shrinks too."
    )


class HandoffOut(BaseModel):
    id: str
    item: ItemOut
    quantity: int
    from_location: str
    to_location: str | None
    remaining: int = Field(description="How many the giving entry has left. Zero means it is gone from every list.")
    need_remaining: int | None = Field(description="How many the receiving need still asks for, if one was named.")
    at: str


class ResolveBody(BaseModel):
    item_id: str = Field(min_length=1, max_length=80)
    alias_text: str | None = Field(
        default=None,
        min_length=1,
        max_length=80,
        description="The correct wording to remember for next time. Typed by you, so a misspelling is never stored. Omit to learn nothing.",
    )


# ---------- helpers ----------


def _item_out(item: store.Item) -> ItemOut:
    return ItemOut(id=item.id, name=item.name)


def _location(location_id: str) -> InventoryLocation:
    """Ineligible locations answer exactly like unknown ones, so nothing is revealed."""
    found = eligible_locations().get(location_id)
    if found is None:
        raise HTTPException(status_code=404, detail="Location not found.")
    return found


def _location_out(loc: InventoryLocation) -> LocationOut:
    return LocationOut(
        id=loc.id,
        name=loc.name,
        kind=loc.kind,
        district=loc.district,
        address=loc.address,
        open_needs=len(store.active_entries(location_id=loc.id, kind="need")),
        have=len(store.active_entries(location_id=loc.id, kind="have")),
        offers=len(store.active_entries(location_id=loc.id, kind="offer")),
    )


def _entry_out(entry: store.Entry) -> EntryOut:
    assert entry.item_id is not None
    return EntryOut(
        id=entry.id,
        item=_item_out(store.get_item(entry.item_id)),
        quantity=entry.quantity,
        verified=store.is_verified(entry),
        expires_at=entry.expires_at.isoformat(),
    )


def _candidates_out(entry_candidates: tuple[store.Candidate, ...]) -> list[CandidateOut]:
    return [
        CandidateOut(item=_item_out(store.get_item(c.item_id)), probability=c.probability)
        for c in entry_candidates
        if c.item_id in {i.id for i in store.list_items()}
    ]


def _source_out(source: Source) -> SourceOut:
    return SourceOut(
        location=source.location.name,
        location_id=source.location.id,
        kind=source.kind,  # type: ignore[arg-type]
        quantity=source.quantity,
        distance_miles=round(source.distance_m / 1609.34, 2),
        entry_id=source.entry_id,
    )


def _alias_out(alias: store.Alias) -> AliasOut:
    open_entries = sum(1 for e in store.active_entries() if e.alias_id == alias.id)
    return AliasOut(
        id=alias.id,
        text=alias.text,
        item=_item_out(store.get_item(alias.item_id)),
        status=alias.status,
        source=alias.source,
        open_entries=open_entries,
    )


def _similar_out(found: store.Similar) -> SimilarOut:
    return SimilarOut(item=_item_out(found.item), wording=found.wording, score=found.score)


def _handoff_out(record: store.Handoff) -> HandoffOut:
    places = eligible_locations()

    def name(location_id: str) -> str:
        return places[location_id].name if location_id in places else "a place"

    return HandoffOut(
        id=record.id,
        item=_item_out(store.get_item(record.item_id)),
        quantity=record.quantity,
        from_location=name(record.from_location_id),
        to_location=name(record.to_location_id) if record.to_location_id else None,
        remaining=record.remaining,
        need_remaining=record.need_remaining,
        at=record.at.isoformat(),
    )


def _raise(err: store.InventoryError) -> NoReturn:
    if isinstance(err, store.SimilarItems):
        raise HTTPException(
            status_code=409,
            detail={
                "message": "This looks like an item we already have. If it is another name for one of them, "
                "resolve or add an alias instead. If it really is new, send confirm_new: true.",
                "similar": [_similar_out(m).model_dump() for m in err.matches],
            },
        ) from err
    if isinstance(err, store.InvalidHandoff):
        raise HTTPException(status_code=409, detail=str(err)) from err
    if isinstance(err, store.AliasConflict):
        raise HTTPException(status_code=409, detail=f"That wording already belongs to alias {err}.") from err
    names = {store.ItemNotFound: "Item", store.AliasNotFound: "Alias", store.EntryNotFound: "Entry"}
    raise HTTPException(status_code=404, detail=f"{names.get(type(err), 'Record')} not found.") from err


# ---------- public ----------


@router.get("/catalog", response_model=list[CatalogItem])
def catalog() -> list[CatalogItem]:
    """The shared item list with the wordings people can use. Unreviewed guesses are left out."""
    trusted = [a for a in store.list_aliases() if a.status in store.TRUSTED]
    return [
        CatalogItem(id=i.id, name=i.name, aliases=sorted(a.text for a in trusted if a.item_id == i.id))
        for i in store.list_items()
    ]


@router.get("/locations", response_model=list[LocationOut])
def locations() -> list[LocationOut]:
    """Pantries and community safe places that can list inventory."""
    return [_location_out(loc) for loc in eligible_locations().values()]


@router.get("/locations/{location_id}", response_model=LocationDetail)
def location_detail(location_id: str) -> LocationDetail:
    loc = _location(location_id)
    groups = {
        kind: [_entry_out(e) for e in store.active_entries(location_id=loc.id, kind=kind)]
        for kind in ("have", "need", "offer")
    }
    return LocationDetail(location=_location_out(loc), **groups)


@router.post("/entries", response_model=EntryResult, status_code=201)
async def create_entry(body: EntryCreate) -> EntryResult:
    """Post something a place has, needs, or is being offered."""
    loc = _location(body.location_id)
    if body.item_id:
        try:
            item = store.get_item(body.item_id)
        except store.InventoryError as err:
            _raise(err)
        entry = store.add_entry(
            location_id=loc.id,
            kind=body.kind,
            quantity=body.quantity,
            label=item.name,
            item_id=item.id,
            alias_id=None,
            via="picked",
        )
    else:
        label = clean_label(body.text or "")
        if not store.normalize(label):
            raise HTTPException(status_code=422, detail="Describe the item in a few words.")
        match = await resolve(label)
        entry = store.add_entry(
            location_id=loc.id,
            kind=body.kind,
            quantity=body.quantity,
            label=label,
            item_id=match.item_id,
            alias_id=match.alias_id,
            via=match.via,
            candidates=match.candidates,
            none_fit=match.none_fit,
        )
    if entry.item_id is None:
        return EntryResult(
            id=entry.id,
            status="held",
            item=None,
            via=entry.via,
            verified=False,
            message="We could not tell which item this is. A coordinator will review it.",
        )
    verified = store.is_verified(entry)
    return EntryResult(
        id=entry.id,
        status="matched",
        item=_item_out(store.get_item(entry.item_id)),
        via=entry.via,
        verified=verified,
        message="Posted." if verified else "Posted. A coordinator will confirm we understood the wording.",
    )


@router.get("/locations/{location_id}/matches", response_model=list[MatchOut])
def matches(location_id: str) -> list[MatchOut]:
    """Open needs here, with the nearest places that have or are offering the item."""
    loc = _location(location_id)
    return [
        MatchOut(
            need_id=m.need.id,
            item=_item_out(m.item),
            quantity=m.need.quantity,
            sources=[_source_out(s) for s in m.sources],
        )
        for m in matches_for(loc.id)
    ]


@router.get("/locations/{location_id}/demand", response_model=list[DemandOut])
def demand(location_id: str) -> list[DemandOut]:
    """The other direction: for what this place has or offers, the nearest open needs elsewhere."""
    loc = _location(location_id)
    return [
        DemandOut(
            entry_id=d.offer.id,
            kind=d.offer.kind,  # type: ignore[arg-type]
            item=_item_out(d.item),
            quantity=d.offer.quantity,
            needed_at=[_source_out(s) for s in d.needs],
        )
        for d in demand_for(loc.id)
    ]


@router.get("/locations/{location_id}/advice", response_model=list[StockingRecommendation])
def advice(location_id: str) -> list[StockingRecommendation]:
    """Stocking recommendations driven by this place's open needs, not hand-passed tags."""
    loc = _location(location_id)
    tags = [store.get_item(e.item_id).name for e in store.active_entries(location_id=loc.id, kind="need") if e.item_id]
    if not tags:
        return []
    return recommend_stocking(PantryStockingRequest(recent_ticket_tags=tags))


# ---------- coordinator ----------


@admin.get("/aliases", response_model=list[AliasOut])
def list_aliases(
    status: Literal["seeded", "approved", "rejected"] | None = Query(default=None),
) -> list[AliasOut]:
    """Every wording the system knows. Only these are ever stored; model and fuzzy guesses live on entries."""
    return [_alias_out(a) for a in store.list_aliases(status)]


@admin.get("/guesses", response_model=list[GuessOut])
def guesses() -> list[GuessOut]:
    """Wordings the system matched by itself (fuzzy or the decision model), most common first.

    Nothing here is stored. Confirm one with `POST entries/{entry_id}/resolve` and type the correct
    spelling, or make it a new item with `promote`. Until then every repeat is simply guessed again.
    """
    return [
        GuessOut(
            wording=g.wording,
            item=_item_out(g.item),
            count=g.count,
            via=g.via,  # type: ignore[arg-type]
            entry_id=g.entry_id,
            candidates=_candidates_out(g.candidates),
        )
        for g in store.guesses()
    ]


@admin.post("/aliases", response_model=AliasOut, status_code=201)
def create_alias(body: AliasCreate) -> AliasOut:
    try:
        return _alias_out(store.add_alias(body.text, body.item_id))
    except store.InventoryError as err:
        _raise(err)


@admin.patch("/aliases/{alias_id}", response_model=AliasOut)
def update_alias(alias_id: str, body: AliasUpdate) -> AliasOut:
    """Rename an alias, point it at a different item, or approve or reject it."""
    try:
        return _alias_out(store.update_alias(alias_id, text=body.text, item_id=body.item_id, status=body.status))
    except store.InventoryError as err:
        _raise(err)


@admin.patch("/items/{item_id}", response_model=ItemOut)
def rename_item(item_id: str, body: ItemUpdate) -> ItemOut:
    try:
        return _item_out(store.rename_item(item_id, body.name))
    except store.InventoryError as err:
        _raise(err)


@admin.post("/items", response_model=ItemOut, status_code=201)
def create_item(body: ItemCreate) -> ItemOut:
    """Add a catalog item the seed list lacks. Held entries that use its wordings link up right away."""
    try:
        return _item_out(store.add_item(body.name, tuple(body.aliases), confirm_new=body.confirm_new))
    except store.InventoryError as err:
        _raise(err)


@admin.get("/unresolved", response_model=list[UnresolvedOut])
def unresolved() -> list[UnresolvedOut]:
    """Entries the system could not match. Use `resolve` to point one at an item, or `promote` to make a new item."""
    held = store.unresolved_entries()
    return [
        UnresolvedOut(
            id=e.id,
            location_id=e.location_id,
            kind=e.kind,
            quantity=e.quantity,
            label=e.label,
            same_wording=sum(1 for h in held if store.normalize(h.label) == store.normalize(e.label)),
            candidates=_candidates_out(e.candidates),
            none_fit=e.none_fit,
            similar=[_similar_out(m) for m in store.similar_items(e.label)],
            created_at=e.created_at.isoformat(),
        )
        for e in held
    ]


@admin.post("/entries/{entry_id}/resolve", response_model=EntryOut)
def resolve_entry(entry_id: str, body: ResolveBody) -> EntryOut:
    try:
        return _entry_out(store.resolve_entry(entry_id, body.item_id, alias_text=body.alias_text))
    except store.InventoryError as err:
        _raise(err)


@admin.post("/entries/{entry_id}/promote", response_model=EntryOut)
def promote_entry(entry_id: str, body: PromoteBody) -> EntryOut:
    """Make a held entry's wording a brand-new catalog item. Every held need and donation with that wording joins it.

    Answers 409 with the closest existing items if this looks like another name for one of them.
    """
    try:
        return _entry_out(
            store.promote_entry(entry_id, body.name, alias_text=body.alias_text, confirm_new=body.confirm_new)
        )
    except store.InventoryError as err:
        _raise(err)


@admin.post("/entries/{entry_id}/handoff", response_model=HandoffOut, status_code=201)
def hand_off(entry_id: str, body: HandoffBody) -> HandoffOut:
    """Record that some of a stock or offer entry was passed over.

    The entry shrinks and disappears at zero, so it stops showing in "who can help". Name the open need it went to
    and that need shrinks too, closing when covered.
    """
    try:
        return _handoff_out(store.handoff(entry_id, body.quantity, body.to_need_id))
    except store.InventoryError as err:
        _raise(err)


@admin.get("/handoffs", response_model=list[HandoffOut])
def handoffs() -> list[HandoffOut]:
    """Recent hand-offs, newest first. Only where, what, and how many; never who."""
    return [_handoff_out(h) for h in store.list_handoffs()]


@admin.post("/entries/{entry_id}/close", status_code=204)
def close_entry(entry_id: str) -> None:
    """Mark a need or offer as filled, or remove a bad post."""
    try:
        store.close_entry(entry_id)
    except store.InventoryError as err:
        _raise(err)


router.include_router(admin)
