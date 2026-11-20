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
