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

## Hub forums

Each hub (`domestic-safety`, `missing-persons`, `food-pantry`) has threads and replies, seeded with synthetic posts from `forums/seed.py`. There are no accounts: every post goes up under a pseudonym from `forums/store.HANDLES`, and the response returns it so the client can keep using it for the session.

- **Held posts.** A post with a home address, phone number, email, or SSN (`ai/pii.py`), a line like "I live at", or wording the abuse classifier flags (`ai/moderation.py`) is held. It stays off the public list and the author gets `held_reason`. Hub listings only show `held_count`, never the text.
- **Model second opinion.** A post that passes the local checks is also classified by Jev (`forums/jev.py`, the same TypeSafe System One decision model as the inventory): an abuse category at 0.5 probability or higher holds it with the same `held_reason`. No key, mock mode, or a failed call changes nothing — the local outcome stands, and locally held text is never sent.
- **Automatic answers.** Common questions in each hub get a canned answer, and crisis wording in any hub gets the 24/7 line.
- **Staff posts.** A post sent with a valid `X-Coordinator-Key` is labeled `ComForce coordinator` and skips the hold.

Public routes (`/api/v1/forums`): `GET hubs`, `GET hubs/{hub_id}/threads` (`sort=hot|new|top`, `q`), `POST hubs/{hub_id}/threads`, `GET threads/{id}`, `POST threads/{id}/replies` (optional `parent_id`), and `POST threads/{id}/helpful` / `POST replies/{id}/helpful` (`{"on": false}` takes a mark back).

Coordinator routes (`/api/v1/forums/admin`, need `X-Coordinator-Key`): `GET held` lists held threads and replies with their reasons. `POST held/{id}/review` takes `action: publish` (contact details scrubbed, optionally with an edited `body`) or `action: remove`.

Data is held in memory and resets to the seed on restart.

## Community inventory

Pantries and community safe places can list what they **have**, what they **need**, and what is **offered**. People pick an item from the shared catalog or describe it in their own words; free text is mapped to a catalog item through an alias table.

Matching order, cheapest first: exact alias, known phrase inside the text, fuzzy match, then a **decision model** for wording nothing else could place, and finally a hold for a coordinator. The alias table stays human-curated:

- Only seeded and coordinator-approved wordings are stored. Fuzzy matches and model answers are recomputed each time and kept on the entry as guesses, flagged `verified: false`, so a misspelling never reaches the table.
- The decision model is [Jev](https://github.com/sebastianbennis/jev-system-one-reference) (set `TYPESAFE_API_KEY`; model pinned by `TYPESAFE_MODEL`, default `jev-1.13.0`), with Gemini or OpenAI as fallbacks and nothing at all in mock mode. It answers a `choice` question over the catalog plus a **"None fit"** option and returns a probability for each, so the top 3 candidates are kept on the entry. An answer is used (still flagged) when its best item is at least 0.6 likely and beats "None fit". Otherwise the entry is held with its candidates. Only scrubbed, 120-character wording is sent, and the Jev integration is tested against stubs, so run one real call with a key before relying on it.
- A coordinator settles a held or guessed entry with `resolve` (pick an item, and optionally type the **correct wording** to remember) or `promote` (make a new item, with a clean `name` and an optional `alias_text`). Needs and donations with the same wording are settled together. Rejected wordings are never guessed again.

Public routes (`/api/v1/inventory`): `catalog`, `locations`, `locations/{id}`, `locations/{id}/matches`, `locations/{id}/advice`, and `POST entries`.

Coordinator routes (`/api/v1/inventory/admin`, need `X-Coordinator-Key`): list, create, rename, remap, reject or restore aliases; review `guesses`; rename catalog items; list and resolve held entries; close entries.

**Passing things over.** A coordinator records a hand-off with `POST admin/entries/{id}/handoff` (`quantity`, and optionally `to_need_id`). The stock or offer shrinks and disappears at zero, so it drops out of `matches` and `demand`. If a need is named it shrinks too and closes once covered; handing over more than it asked for is fine. Needs cannot be handed over, a destination must be a different place asking for the same item, and an entry cannot give more than it has. `GET admin/handoffs` lists recent ones: where, what, and how many, never who. It is coordinator-only because entries are anonymous, and open hand-offs would let anyone empty a real listing.

**Privacy:** shelters are excluded from inventory entirely (see `inventory/locations.py`). They are left out of every list and answer 404 like an unknown place. Entries never store who made them, and typed text is scrubbed of contact details. Needs expire after 14 days, offers after 7, stock after 30. Data is held in memory and resets on restart.

**Unknown items work both ways.** A need or a donation of something not in the catalog (say, a crib) is held for a coordinator. Held needs and donations with the same wording are grouped (`same_wording` on `GET admin/unresolved`). One coordinator decision, `promote` (make it a new catalog item) or `resolve` (point it at an existing item), settles all of them, and `POST admin/items` adds an item up front. From then on the wording matches instantly for both sides. `GET locations/{id}/matches` shows who can fill a place's needs, and `GET locations/{id}/demand` shows which open needs elsewhere a place's stock or offers could fill.

**New item or another name?** The coordinator decides, and the system helps. Each held entry lists the closest existing items (`similar`, with the wording that looked closest and a score), so "crib" shows up next to "Baby crib". Creating or promoting an item that looks like an existing one is refused with a 409 that lists those items; the coordinator either resolves it to the existing item or repeats the request with `confirm_new: true`. A short wording fully inside a longer one counts as close ("crib" and "baby crib"), but sharing one generic word does not ("baby monitor" and "baby formula").
