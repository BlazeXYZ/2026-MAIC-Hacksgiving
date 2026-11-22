# ComForce MKE Community Hub

**AI for Good hackathon project | 2026 MAIC Hacksgiving**

ComForce MKE is a cross-platform community response hub built with React, FastAPI,
and AI-assisted coordination. It helps Milwaukee residents find aid, connect with
volunteers, report needs, and get through unsafe or urgent situations while giving
coordinators tools to organize the response.

Built for the **4th Annual MAIC Hacksgiving Hackathon** at the Milwaukee School of
Engineering, in partnership with **ComforceMKE** (Community Task Force MKE).

**Platform:** Web + Android/iOS
**Backend:** Python + FastAPI + PostgreSQL/SQLite
**Frontend:** React + TypeScript + Vite + Capacitor
**Presentation length:** Designed for a 4-minute pitch

---

## Four-Minute Presentation Map

This README follows the recommended presentation sequence:

| Time | Section | Presentation point |
| --- | --- | --- |
| 0:00-0:35 | [The problem](#the-problem) | Disconnected forms and spreadsheets slow down help |
| 0:35-1:10 | [Our solution](#our-solution) | One accessible hub for residents and coordinators |
| 1:10-2:20 | [What is built](#what-is-built) | Three community hubs and coordinated aid tools |
| 2:20-2:50 | [How the system works](#how-the-system-works) | React client, FastAPI, data, and AI layers |
| 2:50-3:35 | [Demo flow](#demo-flow) | Show a real resident and coordinator journey |
| 3:35-4:00 | [Impact and next steps](#impact-and-next-steps) | Why the platform matters and what comes next |

---

## The Problem

During a crisis, people may need to navigate several disconnected websites, phone
lines, forms, and spreadsheets. That fragmentation creates avoidable delays:

- Residents struggle to find the right service or safe route quickly.
- Community conversations, volunteer activity, inventory, and aid requests live
  in separate places.
- Urgent missing-person alerts can be hidden in generic community feeds.
- Coordinators need a clear view of active requests and available resources.
- Sensitive personal details should not be exposed more widely than necessary.

Static forms are especially difficult during emotional or time-sensitive situations.
ComForce MKE turns several of those disconnected interactions into an organized,
guided experience.

---

## Our Solution

ComForce MKE is a modular community response platform for both **web and mobile**.

It gives each resident:

- A choice of relevant community hubs
- A clear view of urgent alerts
- Access to maps, help surveys, safe routes, and volunteer requests
- An anonymous way to post needs or surplus supplies
- A moderated forum for community information

It gives coordinators:

- Ticket and volunteer assignment workflows
- Forum moderation tools
- Community inventory review
- Handoff tracking
- A view of active needs and resource coverage

The system is designed to be expandable: every hub can share common tools while
adding mission-specific capabilities.

---

## What Is Built

### 1. Domestic Safety Support

The Domestic Safety hub provides confidential safety planning and a safe-route tool.

- Select an origin and optional destination
- Get a route toward a verified public service
- Use MSOE public safety on campus
- Use Sojourner Family Peace Center for citywide support
- Ask for help through a guided triage survey

Emergency contact and safety information are shown where users need them.

### 2. Missing Persons Search Network

The Missing Persons hub centers on urgent coordination.

- Priority alerts can override the normal view across the app
- Search-grid mapping divides an area into sectors
- Volunteers can mark sectors as searching or cleared
- Coordinators can publish and review urgent information
- Forum posts can connect the community around a search

The alert is deliberately prominent: nearby help should not be buried below ordinary
community content.

### 3. Food Pantry and Mutual Aid

The Food Pantry hub connects available supplies with active needs.

- Browse pantry, place, and inventory data
- Post needs, donations, or stock
- Match entries against a shared item catalog
- Find nearby locations that can fill a need
- Find open needs that local stock or offers could fill
- Review unknown items or uncertain matches as a coordinator

The inventory system matches exact aliases, known phrases, fuzzy matches, and a
decision model before holding uncertain entries for review.

### 4. Community Forums

Each hub has a moderated discussion feed.

- Pseudonymous handles keep sessions separate from accounts
- Posts and replies can be sorted or searched
- Held posts are kept out of public listings
- Phone numbers, addresses, email addresses, and other PII are scrubbed
- Coordinators can publish edited content or remove it
- Helpful marks show which answers the community found useful

### 5. Coordinator Tools

The staff workspace brings operational information together.

- Sign in with a coordinator key
- Review tickets and assign volunteers
- Moderate held forum posts
- Review inventory guesses and unresolved items
- Approve aliases and catalog changes
- Record handoffs and track their effects on stock and needs

Coordinator routes use a key and do not expose anonymous handoff data publicly.

---

## How the System Works

```text
Resident or coordinator
          |
          v
React + TypeScript web client
Capacitor wrapper for Android and iOS
          |
          | HTTP / REST / JSON
          v
FastAPI Python backend
          |
          +-- Triage and routing
          +-- PII and content moderation
          +-- Volunteer ticket assignment
          +-- Inventory matching and handoffs
          +-- Forum moderation
          +-- Pantry recommendations
          |
          v
SQLite for local development
PostgreSQL for Docker and production
```

### Core technology

| Layer | Technology | Role |
| --- | --- | --- |
| Mobile and web client | React, TypeScript, Vite, Capacitor | Responsive UI and native app shells |
| Maps | Leaflet and OpenStreetMap | Community locations, search grids, and routes |
| API | Python, FastAPI, Pydantic | REST APIs and structured request/response schemas |
| Data | SQLite or PostgreSQL | Local and deployed persistence |
| AI-assisted features | Configurable Gemini, OpenAI, and Jev matching | Triage, moderation, advice, and catalog matching |
| Deployment | Docker, Nginx, Kubernetes, Terraform | Local, containerized, and cloud-style delivery |

### Privacy and safety

- Shelter locations are excluded from public inventory listings.
- Inventory entries do not store who made them.
- Forum and inventory text is screened for contact details.
- Held posts remain private until a coordinator reviews them.
- API keys, passwords, and sensitive values stay outside the repository.
- Development data and fixtures use synthetic information.

---

## Demo Flow

Use this sequence for a concise live presentation:

1. **Start as a resident.** Show the community hub selector and the urgent-alert
   banner.
2. **Open Domestic Safety.** Complete the help survey or choose a safe-route
   destination.
3. **Open Missing Persons.** Explain the priority search view and search-grid
   coordination.
4. **Open Food Pantry.** Post or review a need, donation, or stock entry.
5. **Switch to the coordinator view.** Review a ticket or held item and complete
   the coordinator action.
6. **Return to the resident view.** Show how the status or available resource
   changed.

For a backup demo, prepare a 2-minute screen recording of the web and mobile views.

---

## Repository Guide

```text
2026-MAIC-Hacksgiving/
├── src/client/               # React, TypeScript, and Capacitor application
│   ├── src/components/       # Hubs, maps, inventory, forums, and coordinator UI
│   ├── src/screens/          # Coordinator and status screens
│   ├── src/api/              # Frontend API clients
│   └── tests/                # Frontend unit tests
├── src/server/               # FastAPI application
│   ├── ai/                   # Triage, moderation, matching, and recommendations
│   ├── api/                  # Mounted feature routes
│   ├── coordinator/          # Staff queue and assignment logic
│   ├── forums/               # Thread, reply, and moderation logic
│   ├── inventory/            # Catalog, matching, stock, and handoffs
│   ├── intake/               # Survey, ticket, and triage logic
│   └── resources/            # Pantries, safe places, and routes
├── deploy/                   # Docker, Kubernetes, and Terraform
├── tests/                    # Backend pytest suite
├── docs/                     # Presentation decks and project assets
├── notebooks/                # Prompt and data experiments
├── docker-compose.yml        # Local full-stack environment
└── CONTRIBUTING.md           # Git, review, and coding workflow
```

### Related documentation

- [Client setup and mobile builds](src/client/README.md)
- [Backend setup and API overview](src/server/README.md)
- [Local Kubernetes and deployment](deploy/KUBERNETES.md)
- [Pitch and design notes](IDEAS.md)
- [Documentation assets](docs/README.md)
- [Contributing workflow](CONTRIBUTING.md)

---

## Run Locally

### Prerequisites

- Python 3.10+
- Node.js 18+
- npm
- Docker or Podman for the full-stack option
- `uv` for the recommended Python setup

### Option A: Docker Compose

From the repository root:

```bash
docker compose up
docker compose exec api python -m src.server.seed
```

Open:

- Web: `http://localhost:3000`
- API: `http://localhost:8000`
- API documentation: `http://localhost:8000/docs`

Stop the local stack:

```bash
docker compose down
```

### Option B: Run the services directly

Backend:

```bash
cd src/server
uv venv
uv sync
uv run python main.py
```

The API defaults to an embedded SQLite database and is available at
`http://localhost:8000`.

Frontend:

```bash
cd src/client
npm install
npm run dev
```

Open `http://localhost:3000`. Vite proxies `/api` requests to the backend.

Copy `.env.example` to `.env` before configuring external AI providers. The application
can also run in mock/development modes, so API keys are not required for every local
flow.

### Mobile builds

Build and sync the web bundle:

```bash
cd src/client
npm run build
npx cap sync
```

Open the native projects:

```bash
npm run cap:android
npm run cap:ios
```

The repository also includes scripts for Android and iOS demo builds:

```bash
bash scripts/mobile/build-android.sh
bash scripts/mobile/build-ios.sh
```

---

## Validation

Run the backend tests and frontend tests from the repository root:

```bash
pytest
ruff check .
```

Frontend tests:

```bash
cd src/client
npm test
npm run build
```

---

## Impact and Next Steps

The immediate impact is an easier path from an urgent need to a visible response:

1. **Residents** receive organized, accessible next steps.
2. **Volunteers** can find and claim focused work.
3. **Coordinators** can moderate information and inventory.
4. **Partner organizations** can connect their services through modular hubs.

The project is an MVP rather than a finished municipal platform. The strongest
next-step story is to add real partner data and operational authentication, then
run controlled pilots for one community use case.

Near-term priorities:

- Integrate verified ComforceMKE and public-Milwaukee data
- Add persistent, secured coordinator accounts
- Improve real-time alerts and volunteer status
- Pilot the missing-person and mutual-aid workflows
- Expand from demonstration data to role-based access and audited operations

The architecture is intentionally designed to scale beyond one partner or one
community. A successful first hub proves the shared model: add a map, add
moderated discussion, add a mission-specific tool, and connect the result to a
coordinator workflow.

---

## Team

| Team member | GitHub |
| --- | --- |
| Avery B | [@Akiisqt](https://github.com/Akiisqt) |
| Chris B | [@BlazeXYZ](https://github.com/BlazeXYZ) |
| Hayden F | [@Fonsh19](https://github.com/Fonsh19) |
| Paxson G | [@TNTwise](https://github.com/TNTwise) |
| Sam F | [@samfreund](https://github.com/samfreund) |

## Acknowledgments

- **MSOE Artificial Intelligence Club (MAIC)** for hosting Hacksgiving
- **Milwaukee School of Engineering (MSOE)** for Diercks Hall and Rosie compute access
- **ComforceMKE** for partnering with students on real Milwaukee community needs
