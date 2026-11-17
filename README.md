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
- [Planned Tech Stack](#planned-tech-stack)
- [System Architecture](#system-architecture)
- [Repository Structure](#repository-structure)
- [Getting Started](#getting-started)
- [Hackathon Schedule](#hackathon-schedule)
- [Submission Checklist](#submission-checklist)
- [Team Members](#team-members)
- [Acknowledgments](#acknowledgments)

---

## Project Overview

- **Project Title:** *[Selected Project Name from IDEAS.md]*
- **Summary:** *[A one-sentence summary of what the app does and how it helps]*
- **Live Demo:** *[Link to deployed app]*
- **Slide Deck:** *[Link to presentation slides]*
- **Demo Video:** *[Link to backup video recording]*

### Project Summary
> *Describe what our application does, the specific problem it solves for ComforceMKE or Milwaukee residents, and how AI helps people.*

---

## The Partner & Community Mission

- **Community Partner:** ComforceMKE (Community Task Force MKE)
- **Their Focus:** 24/7 grassroots crisis response, missing persons search coordination, violence interruption, family grief support, and emergency food and housing connections in Milwaukee.
- **Our Goal:** Build an accessible, real-time application that helps ComforceMKE coordinators and residents handle emergencies without confusion.

See [IDEAS.md](IDEAS.md) for our list of active project concepts and the template to submit a new one.

---

## Planned Tech Stack

Our team is building an interactive 3D web application paired with an AI backend:

| Layer | Tools |
| :--- | :--- |
| **Frontend** | TypeScript, React, Vite, Tailwind CSS |
| **3D Graphics** | Three.js, React Three Fiber (R3F), `@react-three/drei` |
| **Backend & API** | Python 3.10+, FastAPI, Uvicorn |
| **AI & Models** | Google Gemini API, OpenAI API, Anthropic Claude API |
| **Data & Storage** | ChromaDB or SQLite for local caching and vector search |
| **Code Quality** | Git, Ruff for Python formatting, ESLint and Prettier for TypeScript |

---

## System Architecture

```
[React + Three.js Client]
  ├── Interactive 3D Scene (City grid, emergency markers, search zones)
  ├── UI Overlay (Incident filters, status cards, plain-language chat)
  └── Local State (Active selection, user preferences)
            │
            ▼ HTTP / JSON
[FastAPI Python Backend]
  ├── Input Sanitization & Privacy Guard (Strips personal names & private numbers)
  ├── AI Service Layer (Parses incident reports, classifies needs, summarizes tips)
  └── Database / Vector Store (Stores community resources and verified updates)
```

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
├── src/                      # Backend application source code
│   ├── core/                 # Config, settings, and security helpers
│   └── main.py               # Main FastAPI server entry point
├── tests/                    # Backend unit tests
├── .env.example              # Template for API keys and environment variables
├── .gitignore                # Git ignore rules for virtualenvs, keys, and data
├── CONTRIBUTING.md           # Branch rules, commit styles, and code conventions
├── IDEAS.md                  # Project brainstorms and idea submission template
├── requirements.txt          # Python dependencies
└── README.md                 # Main project guide
```

---

## Getting Started

### Prerequisites
* Python 3.10 or newer
* Node.js 18 or newer (with npm)
* Git installed and configured
* An API key for your chosen AI provider (such as Gemini or OpenAI)

### Local Setup

1. **Clone the repository:**
   ```bash
   git clone https://github.com/blazexyz/2026-MAIC-Hacksgiving.git
   cd 2026-MAIC-Hacksgiving
   ```

2. **Set up the Python backend:**
   ```bash
   # Windows (PowerShell)
   python -m venv .venv
   .\.venv\Scripts\Activate.ps1

   # macOS / Linux
   python3 -m venv .venv
   source .venv/bin/activate

   # Install Python packages
   pip install -r requirements.txt
   ```

3. **Set up your environment variables:**
   ```bash
   cp .env.example .env
   ```
   Open `.env` in your editor and add your personal API keys. Never commit your `.env` file to git.

4. **Run the backend server:**
   ```bash
   python -m src.main
   ```
   Open your browser to `http://localhost:8000` to verify the health check endpoint returns `{"status":"healthy"}`.

---

## Hackathon Schedule

All times are in Central Time at Diercks Hall:

| Date & Time | Event | Focus |
| :--- | :--- | :--- |
| **Thursday, Nov 19 (6:30 PM - 7:30 PM)** | **Kick-off** | Partner problem details, team check-in, scope lock |
| **Friday, Nov 20 (3:00 PM - 7:00 PM)** | **Hacking Day 1** | Base 3D scene, API contracts, mock data |
| **Saturday, Nov 21 (10:00 AM - 2:00 PM)** | **Hacking Day 2** | Connect AI to 3D scene, UI buildout, testing |
| **Sunday, Nov 22 (10:00 AM - 4:00 PM)** | **Finals & Expo** | Code freeze, rehearse pitch, live judge demos |

---

## Submission Checklist

Before the Sunday deadline:

- [ ] The app runs on a clean laptop following the steps in this README.
- [ ] We have a recorded 2-minute backup demo video in case the hall Wi-Fi has issues.
- [ ] Presentation slides are exported to PDF and saved in `docs/`.
- [ ] No API keys, passwords, or private resident data are in the git history.
- [ ] The live demo shows both our 3D interface and our AI backend working together.

---

## Team Members

| Name | Role | Responsibilities | Contact |
| :--- | :--- | :--- | :--- |
| **Avery B** | Frontend / UI | 3D visual components and React views | `@Akiisqt` |
| **Chris B** | Backend / Security | API endpoints, security, and AI pipeline | `@BlazeXYZ` |
| **Hayden F** | Full Stack Dev | Data handling and service integration | `@github_handle` |
| **Paxson G** | 3D Graphics / R3F | Three.js scene setup and animations | `@TNTwise` |
| **Sam F** | Pitch & Product | Presentation deck, user testing, and demo | `@samfreund` |

---

## Acknowledgments

* **MSOE Artificial Intelligence Club (MAIC)** for hosting Hacksgiving.
* **Milwaukee School of Engineering (MSOE)** for providing Diercks Hall and Rosie compute access.
* **ComforceMKE** for partnering with MSOE students to build tools for the Milwaukee community.
