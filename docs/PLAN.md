# Hackathon Plan

Notes from the Thursday kickoff, organized against the [ComForce MKE Hub prototype](https://claude.ai/artifact/7pBon1cSqzcyME3mSVxozk).

The prototype is the main idea: one Milwaukee app where a neighbor can ask for help, offer help, find a safe place, and join ComforceMKE program hubs. Phone and desktop share the same actions. Asking for help does not require an account. One verified missing-person alert can sit at the top of the page. Coordinators work from a separate queue.

These notes refine that idea. The last one is a later product, outside the three hackathon days.

---

## This weekend

Build the path a person walks the first time they need something tonight:

1. A short survey with set prompts and multiple-choice answers.
2. Service recommendations from those answers.
3. An LLM only when they choose **Other**, to judge free text and match a service.
4. A map of nearby help, safe places, and (for coordinators) hotspots.
5. A Quick Exit that opens an app the person chose ahead of time.

Park the neighborhood stations. Say they are the next step, and show the dashboard and printed directions as a sketch if we have time.

---

## 1. Help starts as a survey

The chatbot opens with a **set prompt** and **multiple-choice answers**. It does not open on a blank box.

- The prompt is written by us. The model does not invent the first question.
- Choices map to real services: food, a ride, a safe place, somewhere warm, someone to talk to.
- **Other** is the free-text path. Choosing it is what calls the LLM.
- The LLM judges that text: what they need, how soon, which service fits, and whether a person at Comforce should see it now.
- It shows what it understood in plain language. The person can correct it in one tap.
- Urgent cases still go to a real person, with 911 and the Comforce 24/7 line (414-395-0552) on the screen.

The same survey drives recommendations. Answers from "What brings you here?" and "What's going on?" suggest hubs and the closest open service (a pantry, a ride, Sojourner, a warm lobby). Recommendations name a place and a next step.

**Why this shape:** most people can answer by tapping. The model only has to read the cases that do not fit a button.

---

## 2. Make asking feel safe

People hesitate because they expect to be judged. The product should feel like a neighbor pointing them somewhere, with a person available when it is urgent.

- Multiple choice first, so they do not have to narrate their situation to an empty chat.
- The LLM explains and matches. It does not score, lecture, or diagnose.
- Privacy is on by default: name and address stay hidden until a trained volunteer takes the request. Calls go through Comforce, so phone numbers stay hidden.
- No account is required to ask.
- Language comes first (English, Español, Hmoob in the prototype), before any other reading.
- After they ask, a timeline shows who is coming, about when, and what that person can see.
- Training-only tasks stay visible and say how to unlock them.

Copy stays plain: "Urgent, Today, This week." The AI's own explanations use the serif italic voice from the prototype, so a reader can tell a person's words from the model's.

---

## 3. Map hotspots

Look at three public signals for where need and risk cluster:

| Signal | Use |
| :--- | :--- |
| Population density | Where a station, pantry, or volunteer cluster would reach the most people |
| Police reports | Where to pair volunteers and prefer lit main streets |
| Higher-crime areas | Where safe routes and, later, public stations matter most |

The prototype already treats police-report squares as **coordinator-only**, from public MPD counts. Residents never see that layer. Reports show where police were called. Coordinators use them to pair volunteers and plan routes. They do not rank neighborhoods, and they do not appear on the neighbor map.

The neighbor map keeps showing help: open pantries, safe places, events, and a lit route to somewhere staffed (Sojourner, or MSOE Public Safety at 1025 N Broadway when the person is on campus).

**This weekend:** one coordinator hotspot layer if a public file loads cleanly. Population density and crime layers can be a second pass. Resident screens ship with safe places and routing either way.

---

## 4. Quick Exit opens an app you choose

Quick Exit stays on every screen (top right, and Esc on a computer).

- The person picks the app ahead of time. The bus schedule in the prototype is the default disguise.
- Tapping Exit leaves the help screens immediately and opens that chosen app.
- Coming back stays deliberate (the prototype uses three taps on the blue bar).
- Shake-to-exit and a disguised home-screen icon ("Bus Times") stay in settings for people whose phone itself might be checked.

In a web demo, "open an app" can be an in-app disguise (transit, weather, notes). A Capacitor build can hand off to a real installed app when one is available.

---

## 5. Neighborhood stations (later)

**Not in the three days.**

Put stations in lower-income, higher-crime parts of the city so anyone can use the dashboard without a smartphone.

A station would:

- Open the same dashboard a coordinator or neighbor sees
- Show nearby help, safe places, and hours
- Print directions to those places

The weekend build is the software those stations would run. We can name the idea in the pitch and point at the hotspot map as how we would choose corners. We will not build hardware, printing, or a kiosk mode by Sunday.

---

## What the prototype already covers

Use this as the feature checklist. The refinements above change the help flow, the exit target, and which map layers we chase.

| Area | In the prototype |
| :--- | :--- |
| First visit | Three steps: why you're here, area and hubs, Quick Exit practice |
| Home | One urgent alert, "What do you need?", requests, hub news |
| Ask for help | Free text today; we are changing the start to multiple choice |
| After you ask | Private timeline, contact through Comforce |
| Food | Open-now filters, no-ID pantries, neighbor posts, a ride in one tap |
| Safe route | Lit main streets to a staffed place |
| Safe places | Neighbors post lit, open, staffed spots; three confirms or Comforce verifies |
| Volunteer requests | One list, sorted by urgency, distance, and past help |
| Search party | Real blocks, status per sector |
| Hubs | Same tabs everywhere, plus each program's own tools |
| Coordinator | One decision queue, volunteer pings, police-report layer |
| Everyday | Alerts, events, privacy, quiet hours, disguised icon |

Hubs named in the prototype: Missing Persons, Food & Mutual Aid, Domestic Safety (private), Rides & Transportation, Youth Advocacy, Disaster Relief, MKE Parents Club, Activist & Advocacy Podcast.

---

## Three-day cut

| Day | Focus |
| :--- | :--- |
| Friday | Survey screens, multiple-choice help flow, sample services, Quick Exit disguise |
| Saturday | LLM judge on **Other**, one recommendation path, map with safe places and a coordinator hotspot if data is in |
| Sunday | One demo path from "I need help" to a matched place, plus the coordinator view. Pitch the stations as what comes next |

Demo path to rehearse: open the app, answer the survey, get a nearby service, show privacy and the timeline, hit Exit into the chosen app, then flip to the coordinator map.

---

## Open questions

- Which disguise apps we can honestly demo on the web versus in Capacitor.
- Which public Milwaukee files we can load for population, police reports, and crime before Sunday.
- Which single hub we finish end to end if time gets tight. Food and Domestic Safety are the two strongest demos in the prototype.
