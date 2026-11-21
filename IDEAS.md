# Project Design & Ideas: ComForce MKE Community Hub

This document captures the complete platform design, feature list, and development strategy from our team discussions for the 2026 MAIC Hacksgiving hackathon at MSOE.

Our partner is **ComforceMKE** (Community Task Force MKE). Our goal is to make connecting with the organization's programs and initiatives interactive and accessible, instead of just directing residents to fill out a static form on their website. 

The application functions in part as a map app with joinable communities that present the services and initiatives ComforceMKE offers. Every community shares the same basic tools, but each community can add custom technology specific to its mission.

---

## Template for Proposing New Community Modules

If you want to suggest a new community hub or feature, copy this template and add it to the bottom of this file:

```markdown
### [Community or Feature Name]: [One-Sentence Summary]

- **Initiative Category:** (e.g. Domestic Abuse Support, Food Pantries, Disaster Relief, Youth Advocacy, Transportation, Podcasts)
- **The Problem:** What specific challenge does this community solve for Milwaukee residents or ComforceMKE staff?
- **User Interface & OpenStreetMap Integration:** What does the user see on the screen? How are events, locations, or safe places displayed on the map?
- **AI Layer & Model Needs:** Does this use an LLM, a small classifier, or a transformer model? What are the inputs and outputs?
- **Data Availability:** What public or partner datasets support this feature?
- **Hackathon MVP Scope:** What is the simplest working version we can finish by Sunday?
```

---

## 1. App Concept & Core Architecture

* **Modular Community Hubs:**
  The platform centers on dedicated community hubs for each ComforceMKE initiative and service. Each community shares common basics (discussion threads, map markers, and volunteer support tickets), but can add custom technology, such as missing person search grids or discreet safety tools.
* **Personalized and Customizable Home Page:**
  The home page surfaces relevant communities and quick actions based on which communities someone uses, with AI-driven personalization based on user activity. Users can also manually customize their home page layout.
* **Nearby Missing-Person Priority Override:**
  If a missing person alert is triggered near the user's location, that alert takes priority over all other communities on the home screen. A high-priority banner directs nearby users straight into the search effort.
* **Website vs. Mobile App Display:**
  The desktop website includes everything, including the full coordinator dashboard and district analytics. The mobile app (converted through Capacitor) features a configurable display optimized for on-the-go volunteers and residents.
* **Expandable Platform Pitch:**
  We will pitch the platform to ComforceMKE as an easily expandable system. Finishing one community proves the concept, while the architecture is ready to add new initiatives over time.

---

## 2. Map, Threads & Community Content Features

* **Interactive Event Map on OpenStreetMap:**
  An OpenStreetMap layer showing nearby community events, neighborhood rallies, and ComforceMKE service locations.
* **Safe Threads:**
  Dedicated community threads where residents can post and discover places that are safe, well-lit gathering spots, and trusted open buildings.
* **Community Food Pantry Posting:**
  Residents, local stores, and organizations can post if they have an active food pantry or surplus food that people can access.
* **Community Broadcasts:**
  Tools for communities to reach out directly to residents and broadcast meeting places, emergency relief drops, or volunteer rallying points.
* **Covering the Full Range of Services:**
  The modular design is built to cover all ComforceMKE initiatives, including disaster relief, youth advocacy, parent podcasts, transportation aid, domestic abuse support, and food pantries.

---

## 3. Safety, Emergency & Volunteer Features

* **AI Path Planner to Find a Way Out:**
  An AI path planning tool that helps users in unsafe situations find a safe way out of a tense area, guiding them along lit streets toward trusted open buildings.
* **AI Automated Routing to Services:**
  Automates directions to verified service locations. For example, if a user is on the MSOE campus, it automatically routes along lit campus paths to MSOE Public Safety (Public Services) at 1025 N Broadway. In the wider city, it routes to facilities like Sojourner Family Peace Center.
* **~~Quick Exit (Safe Mode):~~** *(retired in #125, removed in #126)*
  A discreet safety toggle for people in domestic abuse situations. Tapping the button immediately swaps the screen to an ordinary Milwaukee transit schedule and wipes local session history.
* **Missing Persons Search Parties:**
  If a person is lost, coordinators can create search parties, broadcast verified information to everyone, and let volunteers mark off map grid areas as searched in real time.
* **Volunteer Support Tickets:**
  A ticketing system where residents can request assistance, and volunteers can claim specific people who need help.
* **AI Priority Triage for Volunteers:**
  An AI triage layer evaluates incoming support tickets so volunteers can immediately find and help the people who need assistance the most.
* **Smart Inactive Volunteer Activation:**
  Instead of sending annoying mass push notifications to every registered user, an AI filter determines which inactive volunteers might actually be available and able to help based on their location and schedule.

---

## 4. Website Management Dashboard & District Statistics

* **District-Level Need Statistics:**
  The desktop website features a management dashboard for ComforceMKE staff to see statistics on how many people in the area need help by district.
* **Neighborhood Comparison:**
  Coordinators can compare aid requests and volunteer coverage across Milwaukee neighborhoods (such as the Historic Third Ward versus Juneautown versus the Near West Side) to allocate resources where they are needed most.

---

## 5. AI Models & Architecture

The FastAPI backend routes incoming requests to an AI agent layer using three specific model categories:

1. **Transformer Model (Geospatial Heatmap Generation):**
   * Creates visual heatmaps of people, crowd density, and areas of highest need by combining incoming community request data with Google API location and busyness data.
2. **Small / Single-Token Classifier (Model TBD):**
   * Runs fast evaluations on user posts and incoming tickets.
   * Handles real-time content moderation, question detection, and initial urgency scoring.
3. **LLM Agent Layer (Recommendations & Question Finding):**
   * **Question Finding & Resource Matching:** Scans discussion threads and help requests to identify what the user is asking and automatically connects them to the right ComforceMKE resource.
   * **Pantry Owner Buying Recommendations:** Analyzes neighborhood shortages and recommends to pantry owners what specific food products or essential supplies they should purchase and stock based on area needs.
   * **Home Screen Personalization:** Tailors the home page based on which community hubs a user accesses most often.

---

## 6. Development Scope & Strategy

* **Check Data Availability First:**
  We want to check what data is available from ComforceMKE and public Milwaukee sources before choosing the app's first focus.
* **Build One Community First:**
  If the data supports it, our team will build one community first (such as domestic abuse support), finish it end-to-end for the hackathon MVP, and present the app as expandable to other initiatives.
* **Pitching to ComforceMKE:**
  We will pitch the platform as an interactive home for all their services, replacing disconnected forms and spreadsheets with an accessible mobile and web tool.

---

## 7. Tech Stack & Repository Structure

* **Client:**
  * React, TypeScript, and Vite
  * Capacitor for compiling the web app to iOS and Android mobile packages
  * OpenStreetMap for interactive event mapping and search grids
  * Tailwind CSS for responsive layouts
* **Server:**
  * Python 3.10+ with FastAPI
  * Dependency management handled with `uv`
  * Modular service packages under `src/server`
* **Repository Layout:**
  * One parent GitHub repository
  * Separate `src/client/` and `src/server/` subdirectories under `src/`

---

## 8. Next Steps

1. **Review ComforceMKE data offerings and pick our initial dataset.**
2. Confirm our first community focus based on the available data.
3. Verify OpenStreetMap component rendering in `src/client`.
4. Connect our FastAPI backend routes in `src/server` to our selected model endpoints.
