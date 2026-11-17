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

## Out-of-the-Box & Unique Concepts

### 9. CalmSignal: Real-Time Audio De-escalation Assistant

- **Category:** Audio Processing and Violence Interruption
- **The Problem:** ComforceMKE violence interruption teams step into heated neighborhood disputes and family arguments. In high-adrenaline situations, even trained workers can feel stressed, and saying the wrong phrase can make a tense argument worse.
- **Interface & User Experience:** A minimal mobile screen designed to be glanced at on a phone or smartwatch. It displays simple visual status rings (green, yellow, red) and short, three-word de-escalation tips ("Lower vocal pitch," "Ask open question," "Take one step back").
- **The AI Component:** An on-device audio model that analyzes volume, speech rate, and pitch changes from the microphone. It does not record or save conversations. When it detects rising tension in vocal cadence, an LLM suggests a practical calming phrase to help the responder keep the situation under control.
- **Security and Privacy:** Crucial privacy protections. Audio stays in device memory and is never uploaded to a cloud server or saved to disk. Responders and residents must be confident that the tool is an assistant, not an eavesdropping tool.
- **Hackathon Scope (MVP):** A browser app using the Web Audio API that analyzes microphone input volume and pitch, transitions a ring from green to red when loud shouting is detected, and displays a recommended calming prompt.

---

### 10. SilentWitness: Disguised Crisis Intake for Domestic Safety

- **Category:** Operational Security and Crisis Intake
- **The Problem:** People living with abusive partners or in dangerous home situations often cannot search for help safely. If an abusive person checks their phone or browser history, searching for crisis help can lead to immediate physical danger.
- **Interface & User Experience:** The web app looks completely ordinary, like a basic Milwaukee bus schedule or a utility calculator. Entering a secret input (such as typing a specific number formula into the calculator) unlocks a hidden, encrypted chat screen connected to ComforceMKE staff. A red "Quick Exit" button in the corner instantly swaps the screen back to a normal bus schedule and wipes all local session data.
- **The AI Component:** A crisis intake agent that chats with the user in plain language, helps them make a quick safety plan, and figures out how urgent their situation is without asking repetitive questions.
- **Security and Privacy:** Directly tied to cybersecurity and operational security (OpSec). Zero browser cookies, zero local storage, zero search history, and end-to-end encryption for all messages.
- **Hackathon Scope (MVP):** A functional calculator page that unlocks an encrypted chat window after entering a secret passcode, with an instant-exit button that clears the screen back to the calculator.

---

### 11. BeaconMesh: Offline Browser-to-Browser Crisis Network

- **Category:** Offline Mesh and Disaster Recovery
- **The Problem:** Severe Milwaukee winter storms or power grid failures can knock out home internet and overload local cell towers. During bad emergencies, people who need emergency heat, a portable generator, or medical help cannot connect to traditional websites.
- **Interface & User Experience:** A peer-to-peer web bulletin board that works without internet. Neighbors connect their phones or laptops to a local Wi-Fi hotspot or use browser-to-browser WebRTC connections. Users see a local board with categories like "Need Warm Clothes," "Have Generator Power," and "Elderly Check-in Needed."
- **The AI Component:** An offline, browser-based small language model running locally on the laptop or phone (using WebGPU). Because it runs completely on the local device without sending requests to cloud APIs, it can organize local aid requests and answer basic winter safety questions even when the internet is completely down.
- **Security and Privacy:** Cryptographic message signing so neighbors can verify that an update about a warming shelter comes from a known ComforceMKE coordinator, even without internet access.
- **Hackathon Scope (MVP):** A local peer-to-peer web page that synchronizes emergency posts between two browser tabs over WebRTC, paired with an offline triage script running locally on a laptop.

---

### 12. FoodSwap AI: Computer Vision Expiration Matcher for Local Pantries

- **Category:** Computer Vision and Food Relief
- **The Problem:** ComforceMKE connects families with emergency food, but Milwaukee food pantries face constant supply mismatches. One pantry might receive a bulk donation of 400 cartons of milk that will spoil in three days, while another pantry three miles away has empty dairy shelves. Pantry workers are too busy to call around and negotiate trades manually.
- **Interface & User Experience:** A mobile camera app where a pantry worker snaps a photo of incoming boxes. The app displays recognized food items, estimated shelf life, and a list of nearby pantries that need those specific items.
- **The AI Component:** A multimodal vision model (such as Gemini 1.5 Flash Vision). It examines the photo, reads box labels and expiration dates, categorizes the food types (produce, dairy, canned goods), and checks a local database to find nearby pantries that need those exact goods.
- **Security and Privacy:** Only registered pantry coordinators can view inventory data. Location data is restricted to verified organization addresses, not individual homes.
- **Hackathon Scope (MVP):** A photo upload box where you upload a picture of grocery boxes, an AI vision call that identifies the food items, and a matching card that shows which mock Milwaukee pantry could take the surplus.

---

### 13. MemoryKeeper: Oral History and Grief Tribute Archive

- **Category:** Audio Processing and Grief Support
- **The Problem:** When violence claims a life in Milwaukee, ComforceMKE steps in to support the grieving family. Families often want to preserve stories and memories of their loved one, but they are overwhelmed by funeral planning and legal paperwork. On top of that, public social media posts often get hit by internet trolls or spam.
- **Interface & User Experience:** A gentle, dignified web page where family members and friends can record short voice memos or write memories. It turns those memories into a private digital memorial booklet and audio reel that the family can keep.
- **The AI Component:** A voice transcription and moderation model. It transcribes audio recordings, cleans up filler words, organizes the memories by life themes (childhood, sports, family moments), and strictly filters out any abusive, trolling, or spam content before the family sees it.
- **Security and Privacy:** High emotional safety. Memorial collections are private by default and protected by family access keys. No public comments can be posted without human or automated moderation approval.
- **Hackathon Scope (MVP):** An audio recording widget that transcribes a spoken story, filters out inappropriate language, and formats the memory into a clean memorial card.

---

## Next Steps for the Team

1. Look through the 3D options, the web/mobile/SMS options, and the unique out-of-the-box concepts.
2. Consider what each team member wants to build:
   - If our frontend developers want to build a 3D scene, **ComForce Pulse** or **SearchTrack 3D** are great picks.
   - If we want to focus on high accessibility and mobile reach, **ComForce SMS Relay** or **RapidDispatch** are strong alternatives.
   - If we want to emphasize cybersecurity, OpSec, and trust, **SilentWitness**, **SafeAlert MKE**, or **TrustFund MKE** stand out.
   - If we want unique AI and audio engineering, **CalmSignal**, **BeaconMesh**, or **FoodSwap AI** will catch the judges' attention.
3. Align on our direction during our team check-in before Thursday evening kickoff.
