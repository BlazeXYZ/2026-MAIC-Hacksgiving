# Full-stack architecture

A neighbor opens ComForce in a browser or in the Capacitor app. The React client is one origin. Pages come from the web server. `/api` goes to FastAPI. Postgres holds service places. The hubs board lives in the API process and in the browser.

Where those processes run (Compose, a local kind cluster, or EKS) is [Cloud architecture](CloudArchitecture.md).

```mermaid
flowchart TB
  person[Neighbor or coordinator]
  person --> client[React client]
  client --> serve{Who serves the page}
  serve -->|npm run dev| vite[Vite on port 3000]
  serve -->|Compose or Kubernetes| nginx[nginx web container]
  vite -->|proxy /api| api[FastAPI]
  nginx -->|files other than /api| client
  nginx -->|/api| api

  client -->|board copy| browserStore[(localStorage)]
  client -->|API unreachable| baked[hubs.json compiled into the client]

  api --> health[/api/health and /api/services]
  api --> hubs[/api/hubs]
  api --> pages[/api/communities, alerts, districts, safe-path]

  health --> postgres[(PostgreSQL services)]
  hubs --> memory[API process memory]
  memory --> seed[data/processed/hubs.json]
  pages --> written[Responses written in the API]
```

## Client

The client is React, TypeScript, and Vite, in `src/client`. Capacitor wraps the same `dist` build for a phone (`com.comforcemke.hub`). Routes are hash routes: Home, Map, Hubs, Requests, a hub, and a thread. Quick Exit swaps the screen for a transit disguise in the browser and wipes the session view. Escape, the red button, or a hard shake can open it. Three taps bring the hub screens back.

On startup the client calls `GET /api/hubs/board`. If that fails, it uses the last board in `localStorage`, then the copy of `hubs.json` compiled into the bundle. Later writes go to the API and, if the API is down, stay in the browser until a newer server board exists. The client does not calculate trust scores. Staff type a score and a note. The API stores that number as entered.

`npm run dev` serves the client at `http://localhost:3000` and proxies `/api` to `http://localhost:8000` (or `API_PROXY`). Compose and Kubernetes do not use that proxy. Nginx does the same split inside the web container.

## Web container

`deploy/docker/Dockerfile.web` builds the client with the repository layout intact, so the import of `data/processed/hubs.json` resolves, then copies `dist` into nginx. Nginx listens on port 80:

- `/api/` is proxied to `http://api:8000`.
- Every other path is a file under the built site, or `index.html` so a refresh on a client route still loads the app.

Compose publishes that port as `3000`. Kubernetes publishes it as Service `web` port 80, then a port-forward (8080 for dev, 8081 for qa, 8082 for prod).

## API

`src/server/main.py` is the FastAPI app, started with uvicorn on port 8000.

| Route | What it uses |
| :--- | :--- |
| `GET /` and `GET /api/health` | Process health. Readiness includes whether Postgres is up. |
| `GET /api/services` | Rows in Postgres. Empty when no database is configured. |
| `GET /api/hubs/board` and the other `/api/hubs/*` writes | The in-memory board. |
| `GET /api/communities`, `GET /api/alerts/priority`, `GET /api/districts/stats` | Fixed responses in the API. |
| `POST /api/routes/safe-path` | Campus flag chooses MSOE Public Safety or Sojourner Family Peace Center. |

`APP_ENV` comes from the environment. Compose sets `production`. Kubernetes sets `development` in dev, `qa` in qa, and `production` in prod. With `APP_ENV=production`, the process exits if Postgres is down at startup. Otherwise it stays up and `/api/health` reports the database as down.

Hub replies that need a short answer are chosen in `src/server/hubs.py` by matching words in the post to a written reply. Trust scores are stored only when staff submit them. The board is seeded from `data/processed/hubs.json` and is discarded when the API process stops. `GEMINI_API_KEY`, `OPENAI_API_KEY`, and `GOOGLE_PLACES_API_KEY` are read in settings and are not called by the running routes.

## Database

PostgreSQL 16. The API uses SQLAlchemy. The only table today is `services`: a slug, name, category, summary, address, and phone. On an empty database the API inserts Sojourner Family Peace Center, MSOE Public Safety, and IMPACT 211.

`DATABASE_URL` unset means the API starts with the database disabled. That is the path for unit tests and for `uv run` without Postgres. Compose and Kubernetes always set the URL. Inside either of those, the host name is `db` and the port is `5432`.

Compose keeps the data in a Docker volume. Kubernetes keeps it on a persistent volume claim owned by StatefulSet `db`. The password is `comforce-dev` in the Compose file, which is for the laptop only. Each Terraform environment sets its own password in that directory's `terraform.tfvars`.

## How a request moves

A hub page load in Kubernetes:

1. The browser asks the web Service for `/`.
2. Nginx returns `index.html` and the JavaScript bundle.
3. The bundle calls `/api/hubs/board` on the same origin.
4. Nginx proxies that call to the API Service on port 8000.
5. FastAPI returns the in-memory board, which was loaded from `hubs.json` at process start.
6. The client stores that board in `localStorage`.

A services call follows the same proxy and then reads Postgres. A thread post follows the same proxy and updates the in-memory board. It does not write a row.
