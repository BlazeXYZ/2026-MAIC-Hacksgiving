# Project Ideas: 2026 MAIC Hacksgiving

This document collects project ideas for our team at the 2026 MAIC Hacksgiving hackathon at MSOE. 

The hackathon partner was just announced: **"With our partner, ComforceMKE, we will be helping the Milwaukee Community in times of trouble!"** 

ComforceMKE (Community Task Force MKE) is a grassroots group founded in 2014. They work around the clock in Milwaukee on crisis response, violence interruption, missing persons searches, emergency food and shelter, and family grief support. 

Our team wants variety and options. While we talked about using React Three Fiber (R3F) for an interactive 3D interface, we are not locked into that path. A 3D map can look great on a projector in Diercks Hall, but a fast mobile web app or an SMS bot might be more useful to someone standing outside in the cold with spotty cell service. This document includes a healthy mix of both styles so we can compare them and make an informed decision before kickoff.

---

## Idea Submission Template

If you have an idea to add, copy and paste this template at the bottom of the file:

```markdown
### [Idea Name]: [Short Summary]

- **Category:** (3D Visualization / Mobile Web App / SMS and Low-Bandwidth / Security and Verification)
- **The Problem:** What specific issue does ComforceMKE or Milwaukee residents face?
- **Interface & User Experience:** What does the user see and interact with (a 3D canvas, a mobile web dashboard, an SMS thread, or a voice prompt)?
- **The AI Component:** What does the AI model actually do? What inputs does it take, and what does it output?
- **Security and Privacy:** How do we protect user identity, prevent fake data, and keep private records safe?
- **Hackathon Scope (MVP):** What can we realistically build and test by Sunday afternoon?
```

---

## 3D & Spatial Concepts (React Three Fiber + AI)

### 1. ComForce Pulse: 3D Community Crisis and Relief Map

- **Category:** 3D Visualization
- **The Problem:** When an emergency happens in Milwaukee, ComforceMKE staff need to see where people need food, shelter, or immediate backup. Reading through long spreadsheets or chat logs during a crisis takes too long.
- **Interface & User Experience:** An interactive 3D map of Milwaukee neighborhoods built in React Three Fiber. Color-coded 3D markers show active help requests (red), open food pantries (green), and emergency shelters (blue). Users can orbit the camera, zoom into specific blocks, and click a marker to read details in a clean side panel.
- **The AI Component:** An intake parser powered by an LLM (such as Gemini 1.5 Flash). It reads raw, messy text messages or emails from residents, extracts the street address or intersection, figures out what resources are needed, and generates a clean JSON object to place the 3D pin.
- **Security and Privacy:** We cannot put private names or exact apartment numbers on a public map. The backend strips personal identifiers and only stores approximate block locations.
- **Hackathon Scope (MVP):** A working 3D map with five sample Milwaukee locations, a text input box where you can paste a mock help request, and an AI endpoint that parses it and drops a new 3D marker on the screen in real time.

---

### 2. SearchTrack 3D: Missing Persons Search Grid Coordinator

- **Category:** 3D Visualization
- **The Problem:** ComforceMKE coordinates community search parties when someone goes missing. Time is the most important factor in these searches. Right now, coordinating volunteers across large areas often relies on group chats and paper notes, which leads to checked areas being searched twice while other areas are missed.
- **Interface & User Experience:** A 3D terrain and street grid centered on the last known location of the missing person. The map displays expanding 3D rings that represent estimated travel distances for one hour, three hours, and six hours. Volunteers can click grid blocks to mark them as "searching," "cleared," or "lead found."
- **The AI Component:** A model that takes the time elapsed, weather conditions, and transport options to suggest which search sectors should get top priority. It also summarizes incoming tip descriptions to spot duplicate reports.
- **Security and Privacy:** Community tips often contain sensitive information. The system must verify volunteer logins so random internet users cannot post fake tips or view private search notes.
- **Hackathon Scope (MVP):** A 3D grid with expanding rings, a working toggle to mark sectors as cleared, and an AI button that takes a mock timeline and suggests the next two search sectors.

---

### 3. SafeWalk MKE: 3D Well-Lit Corridor Finder

- **Category:** 3D Visualization
- **The Problem:** Students, workers, and youth walking through Milwaukee at night need to know which streets are well-lit, active, and close to trusted community safe havens. Standard map apps only calculate the fastest route, not the safest or best-lit route.
- **Interface & User Experience:** An isometric 3D street view that uses 3D light sources to show well-lit paths, open businesses, and partner safe havens. Walking routes are shown as glowing lines through the neighborhood.
- **The AI Component:** A route assistant that evaluates candidate walking paths based on lighting scores, open community hours, and recent activity. It gives the user a two-sentence summary explaining why the suggested path was chosen.
- **Security and Privacy:** The app should never track or save the user's live location on a database. All route math can be calculated locally or through temporary session data that gets deleted immediately.
- **Hackathon Scope (MVP):** A small 3D neighborhood block model with toggles for streetlights and safe havens, plus a basic route selector that displays the recommended path.

---

## Fast Web, Mobile & SMS Tools (Practical & High Accessibility)

### 4. ComForce SMS Relay: Low-Bandwidth Crisis Bot

- **Category:** SMS and Low-Bandwidth
- **The Problem:** In bad weather, power outages, or sudden crises, many residents in Milwaukee do not have reliable high-speed data or modern smartphones. Heavy web apps with big 3D bundles will not load on a budget phone with a weak cell signal.
- **Interface & User Experience:** A two-way SMS interface powered by a phone number (via Twilio or a mock SMS web simulator). A resident texts a simple message like "Need hot food near 24th and Burleigh" or "Looking for safe bed tonight."
- **The AI Component:** An AI parsing agent that reads the incoming text, identifies the immediate need and location, checks a live database of open shelters and meal programs, and texts back the two closest locations with addresses, phone numbers, and hours.
- **Security and Privacy:** Phone numbers are hashed so volunteers and administrators cannot see personal phone numbers directly. No tracking cookies or web logins are required.
- **Hackathon Scope (MVP):** A web simulator that looks like a phone text screen, connected to a FastAPI backend with an AI parser and a database of five Milwaukee food and shelter sites.

---

### 5. RapidDispatch: Real-Time Volunteer and Street Team Board

- **Category:** Mobile Web App
- **The Problem:** ComforceMKE sends volunteers out for street patrols, violence de-escalation, and emergency food delivery. Coordinators need a fast, mobile-friendly board to assign tasks without calling ten people individually.
- **Interface & User Experience:** A clean, mobile-first web app designed like a streamlined task board. Volunteers see a feed of open requests ("Deliver meal box on Center St," "Check on resident on 35th St"). They tap "Claim," see the details, and tap "Complete" when done.
- **The AI Component:** An AI dispatcher that groups nearby requests together to save volunteer drive time, estimates urgency, and writes quick one-paragraph briefings so volunteers know the context before arriving.
- **Security and Privacy:** Role-based access control. Only verified volunteers can view exact drop-off addresses, protecting resident privacy.
- **Hackathon Scope (MVP):** A responsive React web app with an open task list, a claim button, and an AI button that groups three mock requests into an efficient route.

---

### 6. Community Echo: Multilingual Crisis Voice Assistant

- **Category:** Mobile Web App
- **The Problem:** Milwaukee has diverse neighborhoods with Spanish, Hmong, and Arabic-speaking families. During sudden emergencies, language barriers prevent people from asking for help or understanding instructions from responders.
- **Interface & User Experience:** A clean web interface with two large buttons: one for the resident and one for the responder. Either person holds the button and speaks in their native language.
- **The AI Component:** A speech-to-text and translation pipeline using Gemini multimodal audio or Whisper. It translates speech in real time, generates an English summary for the ComforceMKE worker, and reads aloud the translated response to the resident.
- **Security and Privacy:** Audio is processed in memory and discarded immediately after translation. No audio files are saved to disk.
- **Hackathon Scope (MVP):** A browser-based audio recorder that accepts spoken Spanish or English, translates it into the other language, and displays the text and audio playback.

---

## Security, Verification & Anti-Scam Tools

### 7. SafeAlert MKE: Verified Emergency Alerts and Scam Defense

- **Category:** Security and Verification
- **The Problem:** In times of neighborhood trouble or sudden crises, rumors and fake stories spread fast on social media. People also post fake donation links that take advantage of people who want to help. ComforceMKE needs a reliable way to publish verified updates that residents can trust.
- **Interface & User Experience:** A web dashboard showing recent community events on an interactive timeline. Verified updates from ComforceMKE coordinators display with a green verification check. Unverified rumors appear grayed out or flagged until confirmed by staff.
- **The AI Component:** An AI analysis tool that scans incoming social posts and reports. It checks them against known official updates and flags common signs of phishing, fake donation links, or copied scam text.
- **Security and Privacy:** This connects directly to online safety and verification. Only signed-in staff can publish verified alerts. The system uses basic cryptographic signatures or token checks to make sure nobody can spoof an alert from ComforceMKE.
- **Hackathon Scope (MVP):** An alert feed that displays verified notices, and an AI checker where you can paste a suspicious message or donation link to see if it looks fake.

---

### 8. TrustFund MKE: Community Relief and Burial Fund Validator

- **Category:** Security and Verification
- **The Problem:** ComforceMKE often assists families who have lost loved ones to violence by helping them raise money for funeral and burial costs. Scammers regularly create fake GoFundMe pages copying the photos and names of victims, stealing money from generous community members.
- **Interface & User Experience:** A public verification lookup page. Donors can paste a link to a fundraiser or scan a QR code from a flyer to verify if the campaign is officially recognized and endorsed by ComforceMKE.
- **The AI Component:** An image and text similarity model. When a new fundraiser is submitted, the model compares the campaign title, photo, and organizer name against known approved funds to flag duplicate or altered campaigns immediately.
- **Security and Privacy:** Protects family dignity and donor money from phishing. Approved campaign records are locked and only editable by authorized ComforceMKE staff.
- **Hackathon Scope (MVP):** A simple search box where you paste a sample campaign URL, and a verification card showing whether it matches an authentic ComforceMKE family fund.

---

## Next Steps for the Team

1. Look through both the 3D options and the web/mobile/SMS options.
2. Consider what each team member wants to build:
   - If our frontend developers want to build a 3D scene, **ComForce Pulse** or **SearchTrack 3D** are great picks.
   - If we want to focus on high accessibility and mobile reach, **ComForce SMS Relay** or **RapidDispatch** are strong alternatives.
   - If we want to emphasize cybersecurity and trust, **SafeAlert MKE** or **TrustFund MKE** stand out.
3. Align on our direction during our team check-in before Thursday evening kickoff.
