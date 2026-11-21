# ComForce MKE Backend Server

FastAPI backend application for the ComforceMKE community platform.

## Quick Start

### Using `uv`
```bash
uv venv
uv sync
uv run python main.py
```

### Using standard `pip`
```bash
# Windows
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r ../../requirements.txt
python main.py
```

## API Endpoints

* `GET /`: Health check.
* `GET /api/communities`: Returns active ComforceMKE initiatives, member counts, and open tickets.
* `GET /api/alerts/priority`: Returns active emergency alerts (such as nearby missing persons searches).
* `GET /api/districts/stats`: Returns request volume and volunteer coverage across Milwaukee districts.
* `POST /api/routes/safe-path`: Calculates verified routes to MSOE Public Safety or city safe havens.

### Sample volunteer tickets

- `GET /api/tickets` lists fictional pantry tickets and their current status.
- `POST /api/tickets/{ticket_id}/claim` reserves an open ticket.
- `POST /api/tickets/{ticket_id}/unclaim` reopens a ticket when given the same 64-character hexadecimal key as the claim body.

The demo stores claims in memory. Restarting the server resets the board.

## Community inventory

Pantries and community safe places can list what they **have**, what they **need**, and what is **offered**. People pick an item from the shared catalog or describe it in their own words; free text is mapped to a catalog item through an alias table.

Matching order, cheapest first: exact alias, known phrase inside the text, fuzzy match, then one small model call for phrases never seen before (skipped in mock mode). The alias table stays human-curated:

- Phrase and fuzzy matching compare only against **trusted** aliases (seeded or approved), so a guess can never become the anchor for more guesses.
- A fuzzy match is **not stored**. It is recomputed each time and flagged `verified: false`, so misspellings do not pile up. `GET admin/guesses` lists the most common ones; adding one as an alias confirms it for good.
- Only a **model answer** (it costs a call) is saved, as a `suggested` alias. It works for exact repeats, stays flagged until a coordinator approves it, and is dropped after 30 days if nobody does.
- Rejected wordings are never guessed again. Text that cannot be matched is held for a coordinator.

Public routes (`/api/v1/inventory`): `catalog`, `locations`, `locations/{id}`, `locations/{id}/matches`, `locations/{id}/advice`, and `POST entries`.

Coordinator routes (`/api/v1/inventory/admin`, need `X-Coordinator-Key`): list, create, rename, remap, approve or reject aliases; rename catalog items; list and resolve held entries; close entries.

**Privacy:** shelters are excluded from inventory entirely (see `inventory/locations.py`). They are left out of every list and answer 404 like an unknown place. Entries never store who made them, and typed text is scrubbed of contact details. Needs expire after 14 days, offers after 7, stock after 30. Data is held in memory and resets on restart.

**Unknown items work both ways.** A need or a donation of something not in the catalog (say, a crib) is held for a coordinator. Held needs and donations with the same wording are grouped (`same_wording` on `GET admin/unresolved`). One coordinator decision, `promote` (make it a new catalog item) or `resolve` (point it at an existing item), settles all of them, and `POST admin/items` adds an item up front. From then on the wording matches instantly for both sides. `GET locations/{id}/matches` shows who can fill a place's needs, and `GET locations/{id}/demand` shows which open needs elsewhere a place's stock or offers could fill.

**New item or another name?** The coordinator decides, and the system helps. Each held entry lists the closest existing items (`similar`, with the wording that looked closest and a score), so "crib" shows up next to "Baby crib". Creating or promoting an item that looks like an existing one is refused with a 409 that lists those items; the coordinator either resolves it to the existing item or repeats the request with `confirm_new: true`. A short wording fully inside a longer one counts as close ("crib" and "baby crib"), but sharing one generic word does not ("baby monitor" and "baby formula").
