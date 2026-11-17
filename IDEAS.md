# Project Ideas: 2026 MAIC Hacksgiving

This document collects project ideas for our team at the 2026 MAIC Hacksgiving hackathon at MSOE. 

The hackathon partner was just announced: **"With our partner, ComforceMKE, we will be helping the Milwaukee Community in times of trouble!"** 

ComforceMKE (Community Task Force MKE) is a grassroots group founded in 2014. They work around the clock in Milwaukee on crisis response, violence interruption, missing persons searches, emergency food and shelter, and family grief support. 

Before this announcement, our team wanted to build a TypeScript React application using Three.js and React Three Fiber (R3F), backed by AI. Most teams build basic 2D forms or standard chatbots. Putting a clean 3D scene on the screen gives people a practical, visual way to see what is happening across the city. It also looks great during a live demo in Diercks Hall.

---

## Idea Submission Template

If you have another idea, copy and paste this template at the bottom of the document and fill it out:

```markdown
### [Idea Name]: [Short Summary]

- **The Problem:** What specific issue does ComforceMKE or Milwaukee residents face?
- **The 3D Interface (Three.js / R3F):** What does the user see in 3D, and how do they interact with it?
- **The AI Component:** What does the AI model actually do? What inputs does it take, and what does it output?
- **Security and Privacy:** How do we protect user data, prevent fake reports, and keep private info safe?
- **Hackathon Scope (MVP):** What can we realistically finish and test by Sunday afternoon?
```

---

## Brainstormed Project Ideas

### 1. ComForce Pulse: 3D Community Crisis and Relief Map

- **The Problem:** When an emergency happens in Milwaukee, ComforceMKE staff need to see where people need food, shelter, or immediate backup. Reading through long spreadsheets or chat logs during a crisis takes too long.
- **The 3D Interface (Three.js / R3F):** An interactive 3D map of Milwaukee neighborhoods. Color-coded 3D markers show active help requests (red), open food pantries (green), and emergency shelters (blue). Users can orbit the camera, zoom into specific blocks, and click a marker to read details in a clean side panel.
- **The AI Component:** An intake parser powered by an LLM (such as Gemini 1.5 Flash). It reads raw, messy text messages or emails from residents, extracts the street address or intersection, figures out what resources are needed, and generates a clean JSON object to place the 3D pin.
- **Security and Privacy:** We cannot put private names or exact apartment numbers on a public map. The backend strips personal identifiers and only stores approximate block locations.
- **Hackathon Scope (MVP):** A working 3D map with five sample Milwaukee locations, a text input box where you can paste a mock help request, and an AI endpoint that parses it and drops a new 3D marker on the screen in real time.

---

### 2. SearchTrack 3D: Missing Persons Search Grid Coordinator

- **The Problem:** ComforceMKE coordinates community search parties when someone goes missing. Time is the most important factor in these searches. Right now, coordinating volunteers across large areas often relies on group chats and paper notes, which leads to checked areas being searched twice while other areas are missed.
- **The 3D Interface (Three.js / R3F):** A 3D terrain and street grid centered on the last known location of the missing person. The map displays expanding 3D rings that represent estimated travel distances for one hour, three hours, and six hours. Volunteers can click grid blocks to mark them as "searching," "cleared," or "lead found."
- **The AI Component:** A model that takes the time elapsed, weather conditions, and transport options to suggest which search sectors should get top priority. It also summarizes incoming tip descriptions to spot duplicate reports.
- **Security and Privacy:** Community tips often contain sensitive information. The system must verify volunteer logins so random internet users cannot post fake tips or view private search notes.
- **Hackathon Scope (MVP):** A 3D grid with the expanding rings, a working toggle to mark sectors as cleared, and an AI button that takes a mock timeline and suggests the next two search sectors.

---

### 3. SafeAlert MKE: Verified Emergency Alerts and Scam Defense

- **The Problem:** In times of neighborhood trouble or sudden crises, rumors and fake stories spread fast on social media. People also post fake donation links that take advantage of people who want to help. ComforceMKE needs a reliable way to publish verified updates that residents can trust.
- **The 3D Interface (Three.js / R3F):** A 3D visual hub showing recent community events on an interactive timeline. Verified updates from ComforceMKE coordinators glow with a green badge. Unverified rumors appear grayed out or flagged until confirmed by staff.
- **The AI Component:** An AI analysis tool that scans incoming social posts and reports. It checks them against known official updates and flags common signs of phishing, fake donation links, or copied scam text.
- **Security and Privacy:** This connects directly to online safety and verification. Only signed-in staff can publish verified alerts. The system uses basic cryptographic signatures or token checks to make sure nobody can spoof an alert from ComforceMKE.
- **Hackathon Scope (MVP):** A 3D timeline interface, an alert feed that displays verified notices, and an AI checker where you can paste a suspicious message or donation link to see if it looks fake.

---

### 4. SafeWalk MKE: 3D Well-Lit Corridor and Safe Haven Finder

- **The Problem:** Students, workers, and youth walking through Milwaukee at night need to know which streets are well-lit, active, and close to trusted community safe havens. Standard map apps only calculate the fastest route, not the safest or best-lit route.
- **The 3D Interface (Three.js / R3F):** An isometric 3D street view that uses 3D light sources to show well-lit paths, open businesses, and partner safe havens. Walking routes are shown as glowing lines through the neighborhood.
- **The AI Component:** A route assistant that evaluates candidate walking paths based on lighting scores, open community hours, and recent activity. It gives the user a two-sentence summary explaining why the suggested path was chosen.
- **Security and Privacy:** The app should never track or save the user's live location on a database. All route math can be calculated locally or through temporary session data that gets deleted immediately.
- **Hackathon Scope (MVP):** A small 3D neighborhood block model with toggles for streetlights and safe havens, plus a basic route selector that displays the recommended path.

---

### 5. ComForce 3D Hub: Accessible Virtual Relief Center

- **The Problem:** Many people who need emergency food, shelter, or burial support feel overwhelmed when visiting standard government websites. The pages are often crowded with confusing links, legal terms, and long forms.
- **The 3D Interface (Three.js / R3F):** A warm, interactive 3D virtual community room. Users can click different physical stations (Food Pantry, Emergency Housing, Family Support, Youth Mentoring) instead of scrolling through long menus.
- **The AI Component:** A conversational assistant stationed at the virtual front desk. Users can ask questions in plain English or Spanish, and the AI explains program rules simply without using confusing government jargon.
- **Security and Privacy:** No user login is required to explore resources. People in crisis should be able to get information without handing over personal data or email addresses.
- **Hackathon Scope (MVP):** A 3D room with four clickable stations, smooth camera focus transitions when a station is clicked, and a working AI chat dialog for one of the stations.

---

## Next Steps for the Team

1. Review these five ideas during our next team check-in.
2. Pick our primary concept before the Thursday evening kickoff (ComForce Pulse is currently the frontrunner).
3. Confirm our tech stack: React with TypeScript and Vite on the frontend, Three.js with React Three Fiber for the 3D canvas, and Python with FastAPI for the AI backend.
