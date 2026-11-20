"""Pantry stocking advisor: LLM prompt plus deterministic offline fallback.

This module provides the prompt used by an LLM supply advisor for Milwaukee
food pantries, together with a deterministic scoring engine that acts as an
offline fallback/sample so the endpoint always returns a useful answer.
"""

from fastapi import APIRouter
from pydantic import BaseModel, Field

# ---------------------------------------------------------------------------
# LLM prompt (used when wiring a real model; the scoring engine below is the
# deterministic offline fallback/sample that powers the endpoint today).
# ---------------------------------------------------------------------------

PANTRY_ADVISOR_PROMPT = """
# Persona
You are a supply advisor for Milwaukee food pantries. You help coordinators
stock their shelves with dignity-first, high-need items for their districts.

# Inputs
You receive:
- `recent_ticket_tags`: tags drawn from recent community support tickets in
  the coordinator's district (e.g. "infant formula", "winter coats").
- `district_profile`: named demographic signals with weights from 0 to 1
  (e.g. {"cold_snap": 0.9, "newborns": 0.4}).

# Task
Recommend the top 5 stocking items for the pantry this week. For each item,
write a one-sentence justification focused on dignity and current need,
grounded in the matched ticket tags and district signals.

# Output
Return a strict JSON list (no prose, no markdown fences) of exactly 5
objects, each with:
- "item": the stocking item name (string)
- "justification": one sentence, at most 160 characters (string)
- "priority_score": number between 0.0 and 1.0 (float)

Order the list from highest to lowest priority_score.
""".strip()


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------


class StockingRecommendation(BaseModel):
    """A single pantry stocking recommendation."""

    item: str
    justification: str = Field(..., max_length=160)
    priority_score: float = Field(..., ge=0.0, le=1.0)


class PantryStockingRequest(BaseModel):
    """Input signals for the pantry stocking advisor."""

    recent_ticket_tags: list[str] = Field(..., min_length=1)
    district_profile: dict[str, float] = Field(default_factory=dict)


# ---------------------------------------------------------------------------
# Deterministic scoring engine (offline fallback/sample)
# ---------------------------------------------------------------------------

#: (item, keyword tags, base priority) catalog of pantry stocking items.
CATALOG: tuple[tuple[str, tuple[str, ...], float], ...] = (
    ("Infant formula", ("infant", "formula", "baby", "bottle"), 0.9),
    ("Diapers", ("diaper", "nappies", "infant"), 0.85),
    ("Winter coats", ("winter", "coat", "jacket", "cold"), 0.8),
    ("Blankets", ("blanket", "warm", "cold", "sleep"), 0.7),
    ("Canned vegetables", ("canned", "vegetable", "non-perishable", "food"), 0.75),
    ("Rice & grains", ("rice", "grain", "pasta", "staple"), 0.65),
    ("Hygiene kits", ("hygiene", "toiletries", "soap", "sanitary"), 0.72),
    ("Transit cards", ("transit", "bus", "fare", "transport"), 0.6),
    ("Shelf-stable milk", ("milk", "shelf-stable", "dairy"), 0.68),
    ("First-aid supplies", ("first-aid", "first aid", "bandage", "medical"), 0.62),
)


def _match_count(tag: str, keywords: tuple[str, ...]) -> int:
    tag_lower = tag.lower()
    return sum(1 for kw in keywords if kw.lower() in tag_lower)


def recommend_stocking(
    request: PantryStockingRequest, top_n: int = 5
) -> list[StockingRecommendation]:
    """Score catalog items against request signals; return top_n recommendations.

    Score = base * (1 + matched tag count) * (1 + sum of matched district
    weights), normalized to 0-1 against the max. With no matches, falls back
    to base-priority ordering so the endpoint always returns top_n items.
    """
    signals = list(request.recent_ticket_tags) + list(request.district_profile)

    scored: list[tuple[str, float, list[str]]] = []
    for item, keywords, base in CATALOG:
        hits = sum(_match_count(s, keywords) for s in signals)
        matched = [s for s in signals if _match_count(s, keywords) > 0]
        district_boost = sum(
            request.district_profile[s] for s in matched if s in request.district_profile
        )
        score = base * (1 + hits) * (1 + district_boost)
        scored.append((item, score, matched))

    max_score = max((s for _, s, _ in scored), default=0.0)
    if max_score <= 0.0:
        # No matches: fall back to base priority ordering.
        scored = [
            (item, base, []) for item, keywords, base in CATALOG  # noqa: B007
        ]
        max_score = max(s for _, s, _ in scored)

    scored.sort(key=lambda entry: entry[1], reverse=True)
    return [
        StockingRecommendation(
            item=item,
            justification=_justify(item, matched),
            priority_score=round(score / max_score, 4),
        )
        for item, score, matched in scored[:top_n]
    ]


def _justify(item: str, matched: list[str]) -> str:
    if matched:
        signals = ", ".join(matched[:3])
        return (
            f"Several families this week signaled {signals}, so {item.lower()} "
            "helps meet the need with dignity."
        )[:160]
    return (
        f"{item} is a pantry staple that keeps shelves reliable for "
        "any family walking through the door."
    )[:160]


# ---------------------------------------------------------------------------
# Endpoint
# ---------------------------------------------------------------------------

router = APIRouter(prefix="/api/v1/advisors", tags=["advisors"])


@router.post("/pantry-stocking", response_model=list[StockingRecommendation])
def pantry_stocking_advice(
    request: PantryStockingRequest,
) -> list[StockingRecommendation]:
    """Recommend top 5 pantry stocking items from ticket tags and district
    demographic signals."""
    return recommend_stocking(request)
