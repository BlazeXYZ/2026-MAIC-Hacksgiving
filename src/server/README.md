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
