"""Seed catalog: canonical items and the aliases that map to them.

The first ten items mirror the pantry stocking advisor's catalog
(`ai/advisor.py`) so its recommendations line up with what people post.
Coordinators grow the alias lists at runtime; this is only the starting set.
"""

from __future__ import annotations

# (item_id, display name, seed aliases). The display name is always an alias too.
SEED_ITEMS: tuple[tuple[str, str, tuple[str, ...]], ...] = (
    ("infant-formula", "Infant formula", ("baby formula", "formula", "baby milk")),
    ("diapers", "Diapers", ("diaper", "nappies", "pampers")),
    ("winter-coats", "Winter coats", ("winter coat", "coat", "jacket", "parka", "puffer jacket")),
    ("blankets", "Blankets", ("blanket", "quilt", "comforter")),
    ("canned-vegetables", "Canned vegetables", ("canned veggies", "canned veg", "canned green beans")),
    ("rice-grains", "Rice & grains", ("rice", "grains", "pasta", "noodles")),
    ("hygiene-kits", "Hygiene kits", ("hygiene kit", "toiletries", "soap", "shampoo", "toothpaste")),
    ("transit-cards", "Transit cards", ("transit card", "bus pass", "bus fare")),
    ("shelf-stable-milk", "Shelf-stable milk", ("boxed milk", "powdered milk", "shelf stable milk")),
    ("first-aid", "First-aid supplies", ("first aid kit", "bandages", "first aid supplies")),
    ("socks", "Warm socks", ("socks", "wool socks")),
    ("hats-gloves", "Hats & gloves", ("gloves", "mittens", "winter hat", "scarf", "beanie")),
    ("canned-protein", "Canned protein", ("canned tuna", "canned chicken", "canned beans")),
    ("peanut-butter", "Peanut butter", ("pb", "nut butter")),
    ("fresh-produce", "Fresh produce", ("fruit", "vegetables", "fresh vegetables", "fresh fruit")),
    ("menstrual-products", "Menstrual products", ("pads", "tampons", "period products", "sanitary pads")),
)
