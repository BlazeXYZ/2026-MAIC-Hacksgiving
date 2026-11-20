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

## Tests

Run the backend tests from `src/server`:

```bash
uv run python -m pytest ../../tests
```

## API Endpoints

* `GET /`: Health check.
* `GET /api/communities`: Returns active ComforceMKE initiatives, member counts, and open tickets.
* `GET /api/tickets`: Lists sample pantry tasks with their current claim status.
* `POST /api/tickets/{ticket_id}/claim`: Claims a sample task and returns the updated ticket. Returns `404` for an unknown ticket and `409` for an already claimed ticket.
* `GET /api/alerts/priority`: Returns a fixed sample alert for the demo.
* `GET /api/districts/stats`: Returns request volume and volunteer coverage across Milwaukee districts.
* `POST /api/routes/safe-path`: Returns a fixed example route summary based on the campus flag.

Ticket claims are shared within the running server process and reset when it restarts. The ticket board uses fictional pantry tasks.
