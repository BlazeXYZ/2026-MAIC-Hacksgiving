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

* `GET /`: Process health check.
* `GET /api/health`: Readiness. `database` is `up`, `down`, or `disabled`.
* `GET /api/services`: Rows from PostgreSQL. Empty when no database is configured.
* `GET /api/communities`: Returns active ComforceMKE initiatives, member counts, and open tickets.
* `GET /api/alerts/priority`: Returns active emergency alerts (such as nearby missing persons searches).
* `GET /api/districts/stats`: Returns request volume and volunteer coverage across Milwaukee districts.
* `POST /api/routes/safe-path`: Calculates verified routes to MSOE Public Safety or city safe havens.
* `POST /api/v1/intake/survey`: Accepts the help survey, stores a pending ticket, and returns an anonymous `cf-` token plus a service match.
* `GET /api/v1/intake/tickets/{token}`: Resident status and timeline. No phone numbers, street addresses, or volunteer ids. Lookups are rate-limited.
* `GET /api/v1/resources/safe-places`: Verified safe places with `latitude` and `longitude`. Filters: `district`, `staffed_only`.
* `GET /api/v1/resources/pantries`: Food sites. Filters: `open_now`, `no_id_required`, `district`. Hours are America/Chicago.
* `GET /api/v1/routes/safe-walk`: GeoJSON `LineString` to `msoe_safety`, `sojourner`, or `womens_center`. Origin must be inside Milwaukee. Near MSOE, `msoe_safety` follows the Diercks Hall corridor.
* `GET /api/v1/coordinator/queue`: Tickets ordered by urgency, then submission time. Headers: `X-Total-Count`, `X-Urgent-Count`, `X-Pending-Count`.
* `PATCH /api/v1/coordinator/tickets/{ticket_id}/assign`: Moves a ticket one step (`pending` → `assigned` → `in_progress` → `resolved`).

Tickets are kept in the API process until a database store replaces them. CORS allows the Vite dev origin and the Capacitor web view.
