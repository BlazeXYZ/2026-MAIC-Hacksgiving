# Project Design & Ideas: ComForce MKE Community Hub

This document outlines the core concept, architecture, and feature ideas from our team discussion for the 2026 MAIC Hacksgiving hackathon at MSOE.

Our partner is **ComforceMKE** (Community Task Force MKE). The goal of our project is to create an interactive, combined web and mobile application that connects Milwaukee residents directly to ComforceMKE initiatives. Rather than directing people to fill out a static web form, our app is structured around active community hubs that present the organization's programs in a usable, accessible format.

---

## Template for Proposing New Community Modules

If you have an idea for a new community hub or feature, copy this template and add it to the bottom of this file:

```markdown
### [Community or Feature Name]: [One-Sentence Summary]

- **Initiative Category:** (e.g. Domestic Abuse Support, Food Pantries, Disaster Relief, Youth Advocacy, Transportation, Podcasts)
- **The Problem:** What specific challenge does this community solve for Milwaukee residents or ComforceMKE staff?
- **User Interface & OpenStreetMap Integration:** What does the user see on the screen? How are events, locations, or safe places displayed on the map?
- **AI Layer & Model Needs:** Does this use an LLM, a classifier, or a transformer model? What are the inputs and outputs?
- **Data Availability:** What public or partner datasets support this feature?
- **Hackathon MVP Scope:** What is the simplest working version we can finish by Sunday?
```

---

## App Concept & Core Design

1. **Modular Community Hubs:**
   The application is organized into dedicated "Communities" for each ComforceMKE initiative and service. Every community shares a consistent baseline (discussion threads, maps, and volunteer support tickets), but each community can include custom tools tailored to its mission.

2. **Personalized Home Page:**
   The home page surfaces relevant communities and quick actions. An AI personalization layer recommends communities based on user activity and location, while still allowing the user to customize their dashboard layout.

3. **Priority Emergency Override:**
   When a missing person alert is triggered near the user's location, the alert takes immediate priority over other community screens. An urgent banner and notification direct nearby volunteers straight into the search party grid.

4. **Expandable Platform:**
   We will pitch the app to ComforceMKE as a modular platform. The platform is designed to start with one complete community and expand to cover all of ComforceMKE's services over time.

---

## Development Scope & Strategy

* **Start Narrow with One Data Type:**
  Our team will pick one initial dataset from ComforceMKE (such as domestic abuse support or emergency food distribution) and build that community feature end-to-end.
* **Demonstrate the Architecture:**
  By finishing one complete community, we can show judges a working prototype while proving that the underlying codebase easily supports new communities.
* **Pitch to ComforceMKE:**
  We will present the app as an expandable operating system for their community programs, replacing disconnected spreadsheets and web forms with a unified tool.

---

## Community Modules Discussed

### 1. Domestic Abuse Support (Candidate Initial Focus)
* **Safe Walk & Safe Haven Routing:** Automatically routes users along lit paths. If you are on the MSOE campus, it guides you to MSOE Public Safety at 1025 N Broadway. In the city, it directs you to Sojourner Family Peace Center.
* **Quick Exit (Safe Mode):** Tapping the red button instantly swaps the screen to a normal Milwaukee bus schedule and wipes local session data.
* **Confidential Tickets:** Lets residents request discrete volunteer support without sharing personal contact information publicly.

### 2. Missing Persons Search Network
* **Priority Alert Banner:** Overrides normal community views when an active search is nearby.
* **Search Grid on OpenStreetMap:** Displays expanding search rings and lets volunteers mark grid sectors as "searching," "cleared," or "lead found."
* **Search Party Coordination:** Volunteers join specific search groups and share verified updates in real time.

### 3. Food Pantry & Mutual Aid
* **OpenStreetMap Pantry Finder:** Shows operating hours and locations of neighborhood pantries and mobile food markets.
* **Community Supply Threads:** Allows residents and local stores to post surplus groceries that people can access.
* **Pantry Owner AI Advisor:** An LLM reviews neighborhood shortage patterns and recommends what high-demand items pantry coordinators should buy and stock.

### 4. Event Map & Safe Places (OpenStreetMap)
* **Interactive Event Map:** An OpenStreetMap layer showing nearby community meetings, youth rallies, and ComforceMKE outreach events.
* **Safe Threads:** Discussion threads where residents can share safe locations, well-lit meeting places, and open community centers.

### 5. Additional Expansion Communities
* **Disaster Relief:** Coordinating warm clothing, portable heaters, and warming centers during severe winter storms.
* **Youth Advocacy:** Mentorship check-ins, after-school safe hubs, and positive community activities.
* **Parent Podcasts & Media:** Streaming audio discussions, family guidance, and grief support recordings.
* **Transportation Assistance:** Volunteer rides to medical clinics, court dates, and pantry pickups.

---

## AI Layer & Models Needed

The FastAPI backend routes requests to an AI agent layer using three distinct model types:

1. **Transformer Model (Geospatial Heatmap Generation):**
   * Processes location coordinates, Google Places data, and incoming help requests.
   * Generates a heatmap showing areas with high need or high activity across Milwaukee districts.

2. **Small / Single-Token Classifier (Exact Model TBD):**
   * Evaluates user posts and ticket descriptions in real time.
   * Classifies incoming messages for content moderation, question detection, and initial urgency scoring.

3. **LLM Agent Layer (Recommendations & Personalization):**
   * **Home Screen Personalization:** Highlights relevant communities based on user interactions.
   * **Pantry Purchasing Recommendations:** Analyzes community shortages and suggests what items pantry owners should purchase.
   * **Plain-Language Resource Finding:** Answers questions about eligibility and connects residents to the right ComforceMKE service.

4. **Smart Volunteer Dispatch:**
   * Instead of blasting generic push notifications to hundreds of people, the AI evaluates volunteer proximity and activity history.
   * It identifies which volunteers are actually available to help with a specific ticket.

---

## Tech Stack & Monorepo Structure

* **Client:**
  * React, TypeScript, and Vite
  * Capacitor for compiling the web app to iOS and Android
  * OpenStreetMap (Leaflet or React-Leaflet) for event and grid mapping
  * Tailwind CSS for responsive styling
* **Server:**
  * Python 3.10+ with FastAPI
  * Dependency management using `uv`
  * Pydantic schemas for data validation
  * Modular packages inside `src/server`
* **Repository Layout:**
  * One parent GitHub repository
  * `src/client/` for the web and mobile frontend
  * `src/server/` for the Python API and AI layer

---

## Next Steps

1. **Review ComForceMKE data offerings and pick our initial dataset.**
2. Decide whether Domestic Abuse Support or Food Pantry Relief is our first full community feature.
3. Test OpenStreetMap component loading in `src/client`.
4. Connect our FastAPI routes in `src/server` to our selected model endpoints.
