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
from src.server.inventory.matching import matches_for
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
    kind: Literal["have", "offer"]
    quantity: int
    distance_miles: float


class MatchOut(BaseModel):
    need_id: str
    item: ItemOut
    quantity: int
    sources: list[SourceOut]


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


class UnresolvedOut(BaseModel):
    id: str
    location_id: str
    kind: str
    quantity: int
    label: str
    created_at: str


class ResolveBody(BaseModel):
    item_id: str = Field(min_length=1, max_length=80)
    remember: bool = Field(default=True, description="Teach the system this phrase for next time.")


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


def _raise(err: store.InventoryError) -> NoReturn:
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
            sources=[
                SourceOut(
                    location=s.location.name,
                    location_id=s.location.id,
                    kind=s.kind,  # type: ignore[arg-type]
                    quantity=s.quantity,
                    distance_miles=round(s.distance_m / 1609.34, 2),
                )
                for s in m.sources
            ],
        )
        for m in matches_for(loc.id)
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
    status: Literal["seeded", "suggested", "approved", "rejected"] | None = Query(default=None),
) -> list[AliasOut]:
    """Every wording the system knows. Filter to `suggested` for the review queue."""
    return [_alias_out(a) for a in store.list_aliases(status)]


@admin.post("/aliases", response_model=AliasOut, status_code=201)
def create_alias(body: AliasCreate) -> AliasOut:
    try:
        return _alias_out(store.add_alias(body.text, body.item_id, status="approved", source="coordinator"))
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


@admin.get("/unresolved", response_model=list[UnresolvedOut])
def unresolved() -> list[UnresolvedOut]:
    """Entries the system could not match. Teach it the wording with `resolve`."""
    return [
        UnresolvedOut(
            id=e.id,
            location_id=e.location_id,
            kind=e.kind,
            quantity=e.quantity,
            label=e.label,
            created_at=e.created_at.isoformat(),
        )
        for e in store.unresolved_entries()
    ]


@admin.post("/entries/{entry_id}/resolve", response_model=EntryOut)
def resolve_entry(entry_id: str, body: ResolveBody) -> EntryOut:
    try:
        return _entry_out(store.resolve_entry(entry_id, body.item_id, remember=body.remember))
    except store.InventoryError as err:
        _raise(err)


@admin.post("/entries/{entry_id}/close", status_code=204)
def close_entry(entry_id: str) -> None:
    """Mark a need or offer as filled, or remove a bad post."""
    try:
        store.close_entry(entry_id)
    except store.InventoryError as err:
        _raise(err)


router.include_router(admin)
