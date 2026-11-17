# 2026 MAIC Hacksgiving: AI for Good

This repository holds our team project for the **4th Annual MAIC Hacksgiving Hackathon**, hosted by the **MSOE Artificial Intelligence Club (MAIC)** at the **Milwaukee School of Engineering (MSOE)** in Dwight and Dian Diercks Hall.

Our partner for this year is **ComforceMKE** (Community Task Force MKE). As the announcement stated, "With our partner, ComforceMKE, we will be helping the Milwaukee Community in times of trouble!"

---

## Quick Links

- [Project Ideas & Brainstorming](IDEAS.md)
- [Contributing & Style Guide](CONTRIBUTING.md)
- [Project Documentation](docs/README.md)
- [Jupyter Notebooks](notebooks/README.md)

---

## Table of Contents

- [Project Overview](#project-overview)
- [The Partner & Community Mission](#the-partner--community-mission)
- [Platform Architecture](#platform-architecture)
- [Core Features & Modular Communities](#core-features--modular-communities)
- [Milwaukee Data Sources](#milwaukee-data-sources)
- [Repository Structure](#repository-structure)
- [Getting Started](#getting-started)
- [Hackathon Schedule](#hackathon-schedule)
- [Submission Checklist](#submission-checklist)
- [Team Members](#team-members)
- [Acknowledgments](#acknowledgments)

---

## Project Overview

- **Project Title:** ComForce MKE Community Hub
- **Summary:** A combined web and mobile application (exported through Capacitor) that makes connecting with ComforceMKE initiatives interactive and responsive instead of just filling out static web forms.
- **Client Stack:** React, TypeScript, Vite, Capacitor (iOS and Android export), OpenStreetMap, Tailwind CSS
- **Server Stack:** Python 3.10+, FastAPI, `uv` package manager, Uvicorn
- **AI Models:** Transformer-based need heatmaps, small classifier for content moderation and triage, and LLM recommendations

---

## The Partner & Community Mission

ComforceMKE is a resident-led group founded in 2014 that works 24/7 on crisis response, violence interruption, missing persons searches, family grief support, and emergency food and housing across Milwaukee.

Right now, many organizations rely on static web forms that feel slow and impersonal during an emergency. Our platform brings ComforceMKE's services into an interactive, community-driven interface accessible on both desktop web browsers and mobile phones.

---

## Platform Architecture

The project lives in a single GitHub repository with separate `client` and `server` folders under `src/`:

```
[Web Browser & Capacitor Mobile Client] (src/client)
  ├── Modular Community Selector (Domestic Safety, Missing Persons, Pantries)
  ├── Urgent Priority Alert Banner (Overrides screens during critical searches)
  ├── Safe Route Planner (Routes to MSOE Public Safety or Sojourner Peace Center)
  ├── Volunteer Support Ticket Board (Claim tickets, review priority tasks)
  └── District Statistics Dashboard (Third Ward, Juneautown, Near West Side)
            │
            ▼ HTTP / REST / JSON
[FastAPI Python Backend] (src/server, managed with uv)
  ├── AI Moderation & Question Finding (Cleans messages, links to verified aid)
  ├── Smart Volunteer Dispatch (Identifies who can help without blasting spam)
  ├── Safe Path Generator (Calculates verified routes to public services)
  ├── Heatmap & Google API Ingestion (Processes location & need density)
  └── Pantry Stocking Advisor (LLM recommendations for high-need supplies)
```

---

## Core Features & Modular Communities

The platform is designed around **Modular Communities**. Every community shares core tools (threads, maps, verified posts, and volunteer tickets), but each community can enable custom tools:

### 1. Domestic Abuse Support (Initial Flagship Community)
* **Safe Walk & Routing:** If you are on the MSOE campus, it automatically plans a route along lit paths to MSOE Public Safety at 1025 N Broadway. In the city, it directs to Sojourner Family Peace Center.
* **Quick Exit (Safe Mode):** Tapping the red Quick Exit button immediately swaps the screen to an ordinary Milwaukee bus schedule and wipes all local session data.
* **Confidential Support Tickets:** Residents can request discrete check-ins without sharing their full contact details publicly.

### 2. Missing Persons Search Network
* **Priority Alert Override:** When an active search begins, an urgent banner appears across the app, alerting nearby volunteers regardless of which community tab they are viewing.
* **Search Grid Coordinator:** Volunteers can join search parties and mark map sectors as "searching," "cleared," or "lead found" in real time.

### 3. Food Pantry & Mutual Aid
* **Interactive Pantry Finder:** Displays open emergency pantries, mobile markets, and hours pulled from local open data.
* **Pantry Owner AI Advisor:** An LLM reviews district need patterns and recommends what high-demand items pantry coordinators should stock (such as infant formula or warm winter clothing).

### 4. Smart Volunteer Dispatch & District Dashboard
* **Targeted Notification AI:** Instead of sending annoying push notifications to hundreds of inactive volunteers, an AI filter identifies which volunteers are active and close enough to help.
* **Coordinator Dashboard:** Visualizes open aid requests by Milwaukee district (such as Juneautown versus the Third Ward) so coordinators can see where resources are needed most.

---

## Milwaukee Data Sources

Our team is reviewing real Milwaukee open data to ground the app in actual local resources:

1. **IMPACT 2-1-1 & Milwaukee Food Environment GIS:** Public ArcGIS datasets covering every emergency food pantry, meal site, and grocery access point in Milwaukee County.
2. **Hunger Task Force Site Data:** Verified locations and operating hours of emergency food sites and mobile food markets.
3. **Domestic Violence Crisis Services:** Verified coordinates and 24/7 hotline numbers for Sojourner Family Peace Center and the Milwaukee Women's Center.
4. **City of Milwaukee Open Data Portal:** Civic neighborhood boundaries (Juneautown, Historic Third Ward, Near West Side) and community centers.
5. **Google Places API:** Community points of interest, public libraries, and verified public service facilities.
6. **MSOE Campus Geography:** Campus walkways, Diercks Hall (1025 N Milwaukee St), and MSOE Public Safety (1025 N Broadway).

---

## Repository Structure

```text
2026-MAIC-Hacksgiving/
├── .github/                  # Pull request and issue templates
├── data/                     # Sample data and schemas
│   ├── raw/                  # Raw sample files (git-ignored)
│   └── processed/            # Cleaned mock data for testing
├── docs/                     # Pitch notes, slides, and diagrams
├── notebooks/                # Jupyter notebooks for data tests and prompt trials
├── src/
│   ├── client/               # React + TypeScript + Vite + Capacitor app
│   │   ├── src/              # React UI components and views
│   │   ├── capacitor.config.ts  # Capacitor mobile build settings
│   │   ├── package.json      # Client dependencies
│   │   └── vite.config.ts    # Vite bundler config with API proxy
│   └── server/               # FastAPI Python backend managed with uv
│       ├── core/             # Settings and configuration
│       ├── pyproject.toml    # Modern Python dependencies for uv
│       └── main.py           # FastAPI entry point and routes
├── tests/                    # Backend unit tests
├── .env.example              # Template for API keys and environment variables
├── .gitignore                # Git ignore rules for virtualenvs, keys, and data
├── CONTRIBUTING.md           # Branch rules, commit styles, and code conventions
├── IDEAS.md                  # Project brainstorms and idea submission template
├── requirements.txt          # Python dependencies (pip fallback)
└── README.md                 # Main project guide
```

---

## Getting Started

### Prerequisites
* Python 3.10 or newer (with [`uv`](https://github.com/astral-sh/uv) or pip)
* Node.js 18 or newer (with npm)
* Git installed and configured

---

### 1. Setting Up the Server (FastAPI + `uv`)

Change to the server directory:

```bash
cd src/server
```

Using `uv` (recommended):
```bash
# Create and sync virtual environment
uv venv
uv sync

# Run backend development server
uv run python -m src.server.main
```

Using standard `pip`:
```bash
# Windows (PowerShell)
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r ../../requirements.txt
python -m src.server.main
```

The API will be available at `http://localhost:8000`.

---

### 2. Setting Up the Client (React + Capacitor)

In a separate terminal, switch to the client directory:

```bash
cd src/client

# Install frontend dependencies
npm install

# Run the web development server
npm run dev
```

Open your browser to `http://localhost:3000`.

To build and sync for mobile with Capacitor:
```bash
npm run build
npx cap sync
```

---

## Hackathon Schedule

All times are in Central Time at Diercks Hall:

| Date & Time | Event | Focus |
| :--- | :--- | :--- |
| **Thursday, Nov 19 (6:30 PM - 7:30 PM)** | **Kick-off** | Partner problem details, team check-in, scope lock |
| **Friday, Nov 20 (3:00 PM - 7:00 PM)** | **Hacking Day 1** | Wireframe client, implement API endpoints, load sample data |
| **Saturday, Nov 21 (10:00 AM - 2:00 PM)** | **Hacking Day 2** | AI model integration, mobile build test, ticket flow |
| **Sunday, Nov 22 (10:00 AM - 4:00 PM)** | **Finals & Expo** | Code freeze, rehearse pitch, live judge demos |

---

## Submission Checklist

Before the Sunday deadline:

- [ ] Both `src/client` and `src/server` run cleanly following these instructions.
- [ ] A 2-minute backup video demo is recorded showing the web and mobile views.
- [ ] Presentation slides are exported to PDF and saved in `docs/`.
- [ ] No API keys, passwords, or private resident data are in the git history.
- [ ] The live demo shows both community ticket claiming and safe route planning.

---

## Team Members

| Name | Role | Responsibilities | Contact |
| :--- | :--- | :--- | :--- |
| **Avery B** | ... | ... | `@Akiisqt` |
| **Chris B** | ... | ... | `@BlazeXYZ` |
| **Hayden F** | ... | ... | `@Fonsh19` |
| **Paxson G** | ... | ... | `@TNTwise` |
| **Sam F** | ... | ... | `@samfreund` |

---

## Acknowledgments

* **MSOE Artificial Intelligence Club (MAIC)** for hosting Hacksgiving.
* **Milwaukee School of Engineering (MSOE)** for providing Diercks Hall and Rosie compute access.
* **ComforceMKE** for partnering with MSOE students to build tools for the Milwaukee community.
