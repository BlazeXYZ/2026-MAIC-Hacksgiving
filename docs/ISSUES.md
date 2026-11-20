# Project Issues Backlog & Task Directory

This directory maps all 47 bite-sized development issues created on GitHub for the **ComForce MKE Community Hub** project.

Each task is scoped to ~1–2 hours, labeled by domain, and decoupled with mock contracts so frontend, backend, AI/ML, and infrastructure work can proceed in parallel.

---

## 🎨 Frontend Track (`frontend`)

| Issue | Title | Scope / Description | Assignees | GitHub Link |
| :--- | :--- | :--- | :--- | :--- |
| **#2** | **Survey Step 1: 'Why You Are Here' Option Cards** | Initial survey entry grid with preset cards (Food, Ride, Safe Place, Warm Lobby, Talk, Other). | `@BlazeXYZ`, `@Fonsh19` | [#2](https://github.com/BlazeXYZ/2026-MAIC-Hacksgiving/issues/2) |
| **#3** | **Survey Step 2: Language Selector Component** | Prominent language picker (English, Español, Hmoob) preceding survey intake. | `@BlazeXYZ`, `@Fonsh19` | [#3](https://github.com/BlazeXYZ/2026-MAIC-Hacksgiving/issues/3) |
| **#4** | **Survey Step 3: Milwaukee District & Campus Area Picker** | Neighborhood selector (Juneautown, Third Ward, Near West Side, MSOE Campus). | `@BlazeXYZ`, `@Fonsh19` | [#4](https://github.com/BlazeXYZ/2026-MAIC-Hacksgiving/issues/4) |
| **#5** | **Survey 'Other' Free-Text Input with Real-Time Char Count** | Accessible textarea expanding when 'Other' is chosen, with live character count. | `@BlazeXYZ`, `@Fonsh19` | [#5](https://github.com/BlazeXYZ/2026-MAIC-Hacksgiving/issues/5) |
| **#6** | **Survey AI Triage Review Card** | Interactive card displaying what AI understood with 1-tap confirmation or edit. | `@BlazeXYZ`, `@Fonsh19` | [#6](https://github.com/BlazeXYZ/2026-MAIC-Hacksgiving/issues/6) |
| **#7** | **Emergency Sticky Banner with One-Touch Dialing** | Persistent header banner with direct click-to-call links for 911 and Comforce hotline (`414-395-0552`). | `@BlazeXYZ`, `@Fonsh19` | [#7](https://github.com/BlazeXYZ/2026-MAIC-Hacksgiving/issues/7) |
| **#8** | **Quick Exit Trigger Button & Esc Keyboard Shortcut** | Top-right red Quick Exit button and global desktop `Escape` key trigger. | `@BlazeXYZ`, `@Fonsh19` | [#8](https://github.com/BlazeXYZ/2026-MAIC-Hacksgiving/issues/8) |
| **#9** | **Quick Exit Disguise Screen (MCTS Bus Schedule)** | Realistic Milwaukee County Transit System schedule disguise view. | `@BlazeXYZ`, `@Fonsh19` | [#9](https://github.com/BlazeXYZ/2026-MAIC-Hacksgiving/issues/9) |
| **#10** | **Quick Exit Return Sequence & Local State Flush** | Purges `localStorage`/`sessionStorage` on exit and implements 3-tap header unlock return gesture. | `@BlazeXYZ`, `@Fonsh19` | [#10](https://github.com/BlazeXYZ/2026-MAIC-Hacksgiving/issues/10) |
| **#11** | **OpenStreetMap / Leaflet React Wrapper Component** | Foundational interactive map container centered on Milwaukee (`43.0389, -87.9065`). | `@BlazeXYZ`, `@Fonsh19` | [#11](https://github.com/BlazeXYZ/2026-MAIC-Hacksgiving/issues/11) |
| **#12** | **Map Marker Layer: Verified Safe Places & Shelters** | Custom map pins for Sojourner, MSOE Public Safety, and Milwaukee Women's Center. | `@BlazeXYZ`, `@Fonsh19` | [#12](https://github.com/BlazeXYZ/2026-MAIC-Hacksgiving/issues/12) |
| **#13** | **Map Marker Layer: Emergency Food Pantries with Open-Now Filter** | Pantry markers with toggleable 'Open Now' and 'No ID Required' filters. | `@BlazeXYZ`, `@Fonsh19` | [#13](https://github.com/BlazeXYZ/2026-MAIC-Hacksgiving/issues/13) |
| **#14** | **Map Polyline Route Layer: Safe Lit Campus Corridor** | High-visibility route overlay highlighting lit campus paths to 1025 N Broadway. | `@BlazeXYZ`, `@Fonsh19` | [#14](https://github.com/BlazeXYZ/2026-MAIC-Hacksgiving/issues/14) |
| **#15** | **Resident Request Status View & Anonymous Timeline Tracker** | Anonymous ticket lookup view showing status stages without account login. | `@BlazeXYZ`, `@Fonsh19` | [#15](https://github.com/BlazeXYZ/2026-MAIC-Hacksgiving/issues/15) |
| **#16** | **Anonymous Relay Privacy Notice & Phone Masking Modal** | Informational dialog reassuring residents that phone numbers remain hidden behind Comforce dispatch. | `@BlazeXYZ`, `@Fonsh19` | [#16](https://github.com/BlazeXYZ/2026-MAIC-Hacksgiving/issues/16) |
| **#17** | **Volunteer Board: Filterable Ticket Feed** | Feed of open neighbor requests filterable by urgency, distance, and category. | `@BlazeXYZ`, `@Fonsh19` | [#17](https://github.com/BlazeXYZ/2026-MAIC-Hacksgiving/issues/17) |
| **#18** | **Volunteer Board: Ticket Detail Card & Claim Action** | Detail view with one-click 'Claim Request' action and optimistic UI state update. | `@BlazeXYZ`, `@Fonsh19` | [#18](https://github.com/BlazeXYZ/2026-MAIC-Hacksgiving/issues/18) |
| **#19** | **Coordinator Dashboard: Urgency & District Queue Table** | Desktop table for staff sorting incoming requests by urgency tier and neighborhood. | `@BlazeXYZ`, `@Fonsh19` | [#19](https://github.com/BlazeXYZ/2026-MAIC-Hacksgiving/issues/19) |
| **#20** | **Coordinator Dashboard: Hotspot Density Overlay Toggle** | Coordinator-only toggle displaying police report and aid request density. | `@BlazeXYZ`, `@Fonsh19` | [#20](https://github.com/BlazeXYZ/2026-MAIC-Hacksgiving/issues/20) |

---

## ⚙️ Backend Track (`backend`)

| Issue | Title | Scope / Description | Assignee | GitHub Link |
| :--- | :--- | :--- | :--- | :--- |
| **#21** | **Pydantic Schemas for Intake Survey & Triage Models** | Request/response data models for survey options, free text, and urgency ratings. | `@TNTwise` | [#21](https://github.com/BlazeXYZ/2026-MAIC-Hacksgiving/issues/21) |
| **#22** | **API Endpoint: POST /api/v1/intake/survey** | Intake endpoint generating anonymous tracking token and returning matched services. | `@TNTwise` | [#22](https://github.com/BlazeXYZ/2026-MAIC-Hacksgiving/issues/22) |
| **#23** | **API Endpoint: GET /api/v1/intake/tickets/{token}** | Anonymous ticket status retrieval endpoint with strict PII sanitization. | `@TNTwise` | [#23](https://github.com/BlazeXYZ/2026-MAIC-Hacksgiving/issues/23) |
| **#24** | **Pydantic Schemas & Data Models for Community Resources** | Schemas for verified safe havens, emergency pantries, and public aid centers. | `@TNTwise` | [#24](https://github.com/BlazeXYZ/2026-MAIC-Hacksgiving/issues/24) |
| **#25** | **API Endpoint: GET /api/v1/resources/safe-places** | REST endpoint returning verified crisis centers with district filtering. | `@TNTwise` | [#25](https://github.com/BlazeXYZ/2026-MAIC-Hacksgiving/issues/25) |
| **#26** | **API Endpoint: GET /api/v1/resources/pantries** | REST endpoint returning Milwaukee pantries with `open_now` evaluation. | `@TNTwise` | [#26](https://github.com/BlazeXYZ/2026-MAIC-Hacksgiving/issues/26) |
| **#27** | **API Endpoint: GET /api/v1/routes/safe-walk** | GeoJSON waypoint generator returning lit corridors to MSOE Public Safety. | `@TNTwise` | [#27](https://github.com/BlazeXYZ/2026-MAIC-Hacksgiving/issues/27) |
| **#28** | **Coordinator API: GET /api/v1/coordinator/queue** | Decision queue endpoint with urgency sorting and status breakdown metrics. | `@TNTwise` | [#28](https://github.com/BlazeXYZ/2026-MAIC-Hacksgiving/issues/28) |
| **#29** | **Coordinator API: PATCH /api/v1/coordinator/tickets/{ticket_id}/assign** | Ticket assignment and lifecycle state transition endpoint. | `@TNTwise` | [#29](https://github.com/BlazeXYZ/2026-MAIC-Hacksgiving/issues/29) |
| **#30** | **Local Database Setup with SQLite / Async SQLAlchemy** | Lightweight ORM persistence setup with auto-table generation on startup. | *(Unassigned)* | [#30](https://github.com/BlazeXYZ/2026-MAIC-Hacksgiving/issues/30) |
| **#31** | **Database Seed Script for Milwaukee Datasets** | Script to populate local database with Milwaukee pantries, shelters, and sample tickets. | *(Unassigned)* | [#31](https://github.com/BlazeXYZ/2026-MAIC-Hacksgiving/issues/31) |
| **#32** | **FastAPI CORS & Security Header Configuration** | Hardened CORS middleware supporting local Vite dev and Capacitor mobile origins. | `@TNTwise` | [#32](https://github.com/BlazeXYZ/2026-MAIC-Hacksgiving/issues/32) |

---

## 🧠 AI & Machine Learning Track (`ai-ml`)

| Issue | Title | Scope / Description | Assignees | GitHub Link |
| :--- | :--- | :--- | :--- | :--- |
| **#33** | **Prompt Engineering: Free-Text Intake Triage & Extraction** | System prompt and few-shot examples for classifying 'Other' text into urgency and category. | `@Akiisqt`, `@samfreund` | [#33](https://github.com/BlazeXYZ/2026-MAIC-Hacksgiving/issues/33) |
| **#34** | **Structured JSON Output Parser for Triage Responses** | Parser extracting validated Pydantic models from LLM completions with fallback trapping. | `@Akiisqt`, `@samfreund` | [#34](https://github.com/BlazeXYZ/2026-MAIC-Hacksgiving/issues/34) |
| **#35** | **AI Service Mock Stub Engine** | Deterministic mock engine returning realistic triage data for offline/test dev without API keys. | `@Akiisqt`, `@samfreund` | [#35](https://github.com/BlazeXYZ/2026-MAIC-Hacksgiving/issues/35) |
| **#36** | **LLM Client Integration with Fallback & Timeout** | Async Gemini/OpenAI API wrapper with 4s hard timeout and automatic mock fallback. | `@Akiisqt`, `@samfreund` | [#36](https://github.com/BlazeXYZ/2026-MAIC-Hacksgiving/issues/36) |
| **#37** | **Natural Language Confirmation Generator** | Compassionate, stigma-free confirmation summary generator for resident review. | `@Akiisqt`, `@samfreund` | [#37](https://github.com/BlazeXYZ/2026-MAIC-Hacksgiving/issues/37) |
| **#38** | **Content Moderation & Abuse Classifier** | Fast check (< 20ms) detecting harassment or spam before public ticket posting. | `@Akiisqt`, `@samfreund` | [#38](https://github.com/BlazeXYZ/2026-MAIC-Hacksgiving/issues/38) |
| **#39** | **PII Detection & Scrubber Engine** | Automated regex/heuristic filter masking phone numbers, SSNs, and street addresses. | `@Akiisqt`, `@samfreund` | [#39](https://github.com/BlazeXYZ/2026-MAIC-Hacksgiving/issues/39) |
| **#40** | **Lit Corridor Route Optimization Heuristic** | Graph-weighting algorithm favoring verified lit ways and pedestrian streets over dark alleys. | `@Akiisqt`, `@samfreund` | [#40](https://github.com/BlazeXYZ/2026-MAIC-Hacksgiving/issues/40) |
| **#41** | **Geospatial Density & Hotspot Clustering Service** | Spatial binning service calculating incident/request density for coordinator map. | `@Akiisqt`, `@samfreund` | [#41](https://github.com/BlazeXYZ/2026-MAIC-Hacksgiving/issues/41) |
| **#42** | **Evaluation & Test Suite for LLM Triage Accuracy** | Pytest evaluation suite with 15 synthetic resident prompts measuring triage precision. | `@Akiisqt`, `@samfreund` | [#42](https://github.com/BlazeXYZ/2026-MAIC-Hacksgiving/issues/42) |

---

## 🛠️ Infrastructure & DevOps Track (`infra-devops`)

| Issue | Title | Scope / Description | GitHub Link |
| :--- | :--- | :--- | :--- |
| **#43** | **Docker Compose Dev Environment (Web, API, DB)** | One-command local startup bringing up React client, FastAPI server, and Postgres. | [#43](https://github.com/BlazeXYZ/2026-MAIC-Hacksgiving/issues/43) |
| **#44** | **Capacitor Mobile Build & Device Sync Verification** | Mobile export testing (`npx cap sync`), safe-area insets, and touch responsiveness. | [#44](https://github.com/BlazeXYZ/2026-MAIC-Hacksgiving/issues/44) |

---

## 🚀 Stretch & Post-Hackathon Backlog (`stretch-backlog`)

| Issue | Title | Scope / Description | Assignees | GitHub Link |
| :--- | :--- | :--- | :--- | :--- |
| **#45** | **Missing Person Urgent Priority Alert Banner Component** | Global override banner broadcasting active missing person alerts across app views. | `@BlazeXYZ`, `@Fonsh19` | [#45](https://github.com/BlazeXYZ/2026-MAIC-Hacksgiving/issues/45) |
| **#46** | **Missing Person Search Grid Sector Overlay** | Interactive map grid dividing search areas into status sectors ('searching', 'cleared'). | `@BlazeXYZ`, `@Fonsh19` | [#46](https://github.com/BlazeXYZ/2026-MAIC-Hacksgiving/issues/46) |
| **#47** | **Pantry Stocking Advisor LLM Prompt** | Supply advisor analyzing district need deficits to recommend high-demand items. | `@Akiisqt`, `@samfreund` | [#47](https://github.com/BlazeXYZ/2026-MAIC-Hacksgiving/issues/47) |
| **#48** | **Smart Volunteer Dispatch Notification Filter** | Distance and quiet-hours matching algorithm to eliminate volunteer notification spam. | `@Akiisqt`, `@samfreund` | [#48](https://github.com/BlazeXYZ/2026-MAIC-Hacksgiving/issues/48) |
