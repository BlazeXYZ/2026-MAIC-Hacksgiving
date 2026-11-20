# Work plan: `feat/resident-help-flow`

One branch and one PR for the resident side of the v9 mockup: the app shell with Quick Exit, plus the
"Ask for help" path from the first tap to "Help is on the way". It closes 8 of the 18 frontend issues
assigned to `@BlazeXYZ` (shared with `@Fonsh19`).

> **Scope (2026-11-20):** this branch builds **#3, #4, #5, #6, #7, #10, #15, #16**. #2, #8, #9, #11 and #17 came
> from `Hayden/Issues-finished`, which is merged in; see "Merged with `Hayden/Issues-finished`" below for where
> each issue lives now.
>
> **Quick Exit decision:** exiting does **not** wipe saved data or typed text. The app stays mounted, hidden,
> behind the delivery-menu cover, and comes back as it was via "Return to Portal" or three taps on the cover's
> header bar. Exiting does close any open sheet, since an open modal would otherwise freeze the cover.
> Esc always exits, even with a sheet open; it's the panic key.

Sources: the issue bodies, `README.md`, `IDEAS.md`, `CONTRIBUTING.md` and the "ComForce MKE Hub - PROD" mockup
artifact (the repo's `docs/design/hub-mockup-v9.html` is out of date; see below).

> `docs/PLAN.md` is cited by most issues but is not on `main` or any remote branch. Where an issue quotes
> it, the quote is used as written. Otherwise the v9 mockup is treated as the spec.

---

## The bundle

| Issue | Title | Mockup screen |
| :--- | :--- | :--- |
| #7 | Emergency sticky banner with one-touch dialing | `p-ask` danger line, home "In danger? Call 911" |
| #8 | Quick Exit trigger button and Esc shortcut | red `Exit` top right on every phone screen, `esc Quick exit` on desktop |
| #9 | Quick Exit disguise screen (MCTS bus schedule) | `decoy.html` (Route 30, Broadway & State) |
| #10 | Quick Exit return sequence and local state flush | "tap the blue bar three times" (`p-exitlesson`) |
| #3 | Language selector (English, Español, Hmoob) | segmented control at top of `p-welcome` |
| #2 | "Why you are here" option cards | home "What do you need?" tiles and `p-ask` categories |
| #5 | "Other" free-text input with character count | `p-ask` text box |
| #4 | District and campus area picker | `p-setup` "Where are you, roughly?" |
| #6 | AI triage review card | `p-ask` "Here's what I understood. Tap to fix." |
| #16 | Privacy notice and phone-masking modal | `p-ask` "Keep this private" switch, `p-status` masking line |
| #15 | Request status view and anonymous timeline | `p-status` "Help is on the way" |

### Why these 11 go together

- **One user journey.** They are mockup section 3 ("Getting help") end to end: shell, survey, review,
  submit, status. Splitting them gives PRs that can't be demoed on their own.
- **Shared state.** #2, #3, #4, #5 and #6 all read and write one survey context, and #10 has to wipe that same
  context. Building them apart means three PRs editing the same provider.
- **Shared shell.** #7 and #8 live in the header every other screen renders in. Landing them first,
  in the same PR, avoids every later PR touching `App.tsx` layout.
- **No new dependencies.** Nothing here needs Leaflet, so the PR stays small to review and safe to merge.
- **Matches the backend.** PR #50 (`feat/intake-resources-api`) already defines `SurveyRequest`,
  `TriageResult`, `SurveyAccepted`, `PublicTicket` and `TimelineEvent` in `src/client/src/contracts.ts`
  for `POST /api/v1/intake/survey` and `GET /api/v1/intake/tickets/{token}`. This bundle is exactly
  the client half of those two endpoints.

### Left for later bundles

| Bundle | Issues | Why it waits |
| :--- | :--- | :--- |
| `feat/osm-map-layers` | #11, #12, #13, #14 | Needs `leaflet` + `react-leaflet` added and the `MapView` wrapper (#11) before any layer. Uses `/resources/safe-places`, `/resources/pantries`, `/routes/safe-walk` from PR #50. |
| `feat/volunteer-coordinator` | #17, #18, #19, #20 | Different user (volunteer/staff) and different screens (`p-board`, `p-task`, `j-coord`). #20 also needs the map wrapper from the bundle above. |
| Stretch | #45, #46 | Missing-person banner and search grid. #46 needs the map. #45 is small and could ride along with the volunteer bundle. |

---

## Before starting

1. **`main` does not build.** `npm run build` fails on `src/App.tsx(1,8): 'React' is declared but its value is never read`
   (`noUnusedLocals` is on and the project uses the `react-jsx` transform). Fix it as the first commit
   (`fix: drop unused React import so the client builds`).
2. **Contracts.** PR #50 is still open. Either wait for it to merge and rebase, or copy
   `src/client/src/contracts.ts` from it unchanged so the field names stay aligned. Don't redefine the types.
3. **Design tokens.** Tailwind is in `package.json` but there is no `tailwind.config` or `postcss.config`, so it
   is not wired up. The simplest path is one `src/styles/tokens.css` with the v9 `:root` variables
   (`--green #0F6B3A`, `--red #D8322B`, `--paper #F4F5F0`, `--ink #16201B`, `--r 12px`, and the rest from `template.html`)
   and Google Fonts Bricolage Grotesque + Newsreader. Check with the team before turning Tailwind on.
4. **`package-lock.json`** is not committed. Ask the team whether to commit it with this PR.

---

## Where the issues and the mockup disagree

Decide these with `@Fonsh19` before coding. The default in each row follows the mockup.

| Topic | Issue says | v9 mockup says | Default |
| :--- | :--- | :--- | :--- |
| Survey order (#2, #3) | Step 1 options, step 2 language | Language is the very first control, "before any reading is needed" | Language first, then options. Issue #3 itself quotes this rule. |
| Option list (#2) | Food, Ride, Safe Place, Warm Lobby, Talk to Someone, Other | Home tiles: Ask for help, Get somewhere safe, Get warm, Share a tip | Use the issue's six. Map to `ServiceCategory`: food, ride, shelter, warmth, support, other. |
| Districts (#4) | MSOE Campus, Juneautown, Historic Third Ward, Near West Side, General Milwaukee | Westown, Near West Side, Haymarket, Juneautown, More… | Union of both, with "General Milwaukee" as the fallback. Copy: "Neighbors only ever see your block, never your address." |
| Free text (#5) | Shown only when "Other" is picked, 500 max | `p-ask` free text is the main input for every request | Show it for "Other" as the issue says, and also as an optional "Anything else?" box for the other options. |
| Emergency banner (#7) | Sticky banner on every intake screen | A quiet line at the bottom of `p-ask`, one red block per page | Sticky but slim, under the header, high contrast, not red-filled so it doesn't compete with a missing-person alert. |
| Header colour (#10) | "three taps on the blue header bar" | The decoy's own header is the "blue bar" | Three taps on the decoy header return to the app, as in `hub.js`. |
| Timeline stages (#15) | Submitted, Triage, Assigned, Volunteer dispatched, Resolved | Request sent, Volunteer took it, On the way, Dropped off | Drive from `TicketStatus` (`pending`, `assigned`, `in_progress`, `resolved`) with plain-language labels from the mockup. |

---

## Planned file layout (`src/client/src/`)

```text
App.tsx                         # shell only: providers, header, screen switch
contracts.ts                    # from PR #50, unchanged
styles/tokens.css               # v9 :root tokens and fonts
state/SurveyContext.tsx         # language, need, freeText, district; reset() used by Quick Exit
state/useQuickExit.ts           # exit(), restore(), Esc listener, storage flush
api/intake.ts                   # postSurvey(), getTicket(token) with a mock fallback when /api is down
i18n/strings.ts                 # en / es / hmn string tables (English filled, others stubbed)
components/shell/Header.tsx                 # logo + QuickExitButton            (#8)
components/shell/EmergencyBar.tsx           # tel:911, tel:4143950552            (#7)
components/shell/DisguiseScreen.tsx         # MCTS Route 30 schedule, triple-tap return (#9, #10)
components/survey/LanguageSelector.tsx      # (#3)
components/survey/NeedCards.tsx             # (#2)
components/survey/OtherTextInput.tsx        # (#5)
components/survey/DistrictPicker.tsx        # (#4)
components/survey/TriageReviewCard.tsx      # (#6)
components/privacy/PrivacyBadge.tsx         # (#16)
components/privacy/PrivacyModal.tsx         # (#16)
components/status/StatusTimeline.tsx        # (#15)
screens/AskScreen.tsx                       # steps 1–4 + review
screens/StatusScreen.tsx                    # lookup by token + timeline
```

`CONTRIBUTING.md` asks for components grouped by feature under `src/client/src/components/` and typed props
everywhere, which this follows.

---

## Order of work (one commit each)

1. `fix:` unused React import (build green).
2. `chore:` add `contracts.ts`, `tokens.css`, fonts.
3. `feat:` shell: Header, Quick Exit button, Esc, disguise screen, triple-tap return, storage flush. **#8 #9 #10**
4. `feat:` emergency bar. **#7**
5. `feat:` survey context + language selector + need cards + Other text input. **#3 #2 #5**
6. `feat:` district picker with "Use my location" and permission fallback. **#4**
7. `feat:` triage review card with skeleton, Looks right / Edit. **#6**
8. `feat:` privacy badge + modal. **#16**
9. `feat:` status screen, timeline, copy-token. **#15**
10. Remove the placeholder community demo from the old `App.tsx` (or move it behind a route) once the shell replaces it.

Commits 3–4 are the riskiest for safety and should be reviewed first. If time runs short, cut the PR after
step 7: that still closes #2–#10.

---

## Acceptance checks

**Quick Exit (#8, #9, #10)**
- [ ] `Exit` is in the same top-right spot on every screen; desktop shows `esc Quick exit`.
- [ ] Click or `Esc` swaps to the bus schedule in the same frame (no transition, no spinner).
- [ ] `document.title` changes to something like "MCTS Route 30 Schedule".
- [ ] `history.replaceState` so Back doesn't reopen the survey.
- [ ] `localStorage`, `sessionStorage` and the survey context are cleared on exit.
- [ ] Three taps on the decoy header within ~900 ms restore home; one or two taps, or scrolling, do nothing.

**Emergency bar (#7)**
- [ ] `tel:911` and `tel:4143950552`, at least 44 px tap targets.
- [ ] Sticky, but doesn't cover inputs at 375 px width.

**Survey (#2, #3, #4, #5)**
- [ ] English / Español / Hmoob segmented control stored as `language` (`en`, `es`, `hmn`).
- [ ] Six need cards, `aria-pressed`, Next disabled until one is picked.
- [ ] "Other" expands a textarea with live `n / 500`, aria-label, and submit disabled when empty or over.
- [ ] District picker with "Use my location" and a clear fallback when permission is denied.
- [ ] Choices survive moving back and forward between steps.
- [ ] Payload matches `SurveyRequest` (`selected_options`, `free_text`, `district`, `language`).

**Triage review (#6)**
- [ ] Skeleton while waiting.
- [ ] Summary in Newsreader italic (the mockup's "the AI is explaining itself" style).
- [ ] Urgency shown as Urgent / Today / This week, plus the category.
- [ ] "Looks right" submits; "Edit" goes back with the text kept.

**Privacy (#16)**
- [ ] Shield badge on the request form and on the status screen.
- [ ] Modal: name and number stay hidden, contact goes through ComForce, volunteers are ID-checked.
- [ ] "Keep this private" is on by default.

**Status (#15)**
- [ ] Look up by token, no login.
- [ ] Timeline highlights the current stage from `PublicTicket.timeline`.
- [ ] Shows an estimated time and the volunteer alias only, never a phone number.
- [ ] Copy-token button.

**PR**
- [ ] `npm run build` passes.
- [ ] Phone (375 px) and desktop screenshots in the PR description.
- [ ] Squash and merge, per `CONTRIBUTING.md`.

---

## Open items found while building

- **Triage preview endpoint (backend).** #6 shows the AI's reading *before* the ticket is sent, but PR #50 only
  triages inside `POST /intake/survey`, which also creates the ticket. The client calls
  `POST /api/v1/intake/triage` (same body, returns `TriageResult`, creates nothing) and falls back to a
  local keyword guess when that 404s. Ask `@TNTwise` to add it.
- **"Keep this private" isn't sent.** `SurveyRequest` has no field for it. Today every request is treated as
  private. If it should be a choice, add `keep_private: bool` to the contract.
- **Hmong review.** `i18n/hmn.ts` covers every string but should be checked by a Hmong-speaking volunteer.

## Merged with `Hayden/Issues-finished`

This branch now contains `origin/Hayden/Issues-finished` (merged, not yet committed). Together the two branches cover:

| Issue | From | Where it lives now |
| :--- | :--- | :--- |
| #2 option cards | Hayden | `components/HelpSurvey.tsx`, redrawn as the mockup's "What do you need?" tiles; on Home and inside the Ask chat |
| #3 language | us | Welcome hero (`components/survey/LanguageSelector.tsx`) |
| #4 area | us | `screens/AreaScreen.tsx` |
| #5 free text | us | Ask chat input bar (`components/survey/ChatInput.tsx`) |
| #6 review | us | "Tap to fix" bubble (`components/survey/TriageReviewCard.tsx`) |
| #7 emergency line | us | Pinned in every footer (`components/shell/EmergencyBar.tsx`) |
| #8 Quick Exit + Esc | Hayden | Esc listener moved into `state/quickExit.tsx`; Exit buttons in `components/shell/Frame.tsx` |
| #9 cover screen | Hayden | `components/DeliveryCover.tsx` (food delivery catalog replaces the bus schedule) |
| #10 return | us | `state/quickExit.tsx`; the cover's "Return to Portal" button, or three taps on its header bar (`state/useTripleTap.ts`). **Team decision:** Quick Exit does not wipe saved data or typed text; the app stays mounted behind the cover and comes back as it was. Update #10's "purge" acceptance criterion to match |
| #11 map | Hayden | Map tab (`screens/HubScreens.tsx` → `components/CommunityMap.tsx`, `LeafletMap.tsx`) |
| #15 status | us | Me tab (`screens/StatusScreen.tsx`) |
| #16 privacy | us | `components/privacy/PrivacyNotice.tsx` |
| #17 ticket feed (+ claim undo) | Hayden | Requests tab (`components/VolunteerTickets.tsx`, `/api/tickets` in `src/server/main.py`) |

Flow: Welcome → Area → (Ask, Requests or Home depending on "What brings you here") → tabs Home · Map · + Ask · Requests · Me.
After Quick Exit the app comes back exactly where it was, with nothing lost.

Unifying notes: his CSS variable names (`--surface`, `--muted`, `--line-strong`, …) are mapped onto the v9 tokens in
`styles/tokens.css`, so `CommunityMap.css`, `VolunteerTickets.css` keep working. `App.css` and `HelpSurvey.css` were
folded into `tokens.css`. His self-hosted fonts replace the Google Fonts link (Newsreader has no italic file yet, so the
AI's italic is synthesized).

Languages: every screen, including his map, map controls and ticket board, is translated into Spanish and Hmong
(`i18n/strings.ts`, `i18n/hmn.ts`). The Hmong table is a first pass for the demo and needs review by a Hmong speaker.
Ticket text from the server is translated client-side for the three sample tickets only; new tickets show the server's
wording. The delivery cover stays English on purpose.

## UI follows the PROD mockup

**Source of truth:** the "ComForce MKE Hub - PROD" artifact. `docs/design/hub-mockup-v9.html` in the repo is out of date.
PROD keeps v9's screens and adds: a greener palette (`--paper #E6ECE3`, `--card #FDFDF9`), the chain-link fence as one
"X" tile in three strengths (on paper, a top-fading wash, and white on dark surfaces), lined up across surfaces so the
lines run unbroken (`state/useFenceAlignment.ts`), solid offset card shadows, highlighter section headings, halftone
corners on the alert and search cards, the Milwaukee skyline in the welcome hero, a green fenced desktop footer,
a listening state on the mic (real speech input where the browser supports it), and small copy changes ("the 414",
a fish-fry news card, "Made in Milwaukee").

PROD's later "consistency pass" is also in: phone headers share one row height with Exit pinned to the top, every
section heading carries the green panel marker, primary and red buttons get a pressable drop shadow, setting rows and
the Quick Exit demo get the card lift, and the green footer closes every wide desktop page (Home, Map, Requests).
The Map tab's pins follow PROD's map pins (coloured marker with a white icon and a label; yellow ring when selected)
over muted tiles, and Requests shows "N open near you" in the header with the locked card in urgency order.
PROD's category chips on Requests (All, Food, Rides, Safety, Parents) were not copied: #17 asks for urgency and
district filters, which is what the board has.

Mobile was checked against PROD's phone frames by comparing computed styles element by element (fonts, padding,
radii, borders, colours, shadows) on every screen at 390px, plus an overflow check at 320px in Hmong. The only
remaining differences are deliberate: the mockup's frames draw a fake status bar and home-indicator gap, which the
app gets from the phone's safe areas instead; the six need cards (#2) and the emergency line (#7); and the privacy
chip in the "Keep this private" row (#16).


Each screen maps to a mockup frame and uses the mockup's own class names (`styles/tokens.css`), icons and
portrait art (`components/Icon.tsx`):

| Screen | Mockup frame | Notes |
| :--- | :--- | :--- |
| `WelcomeScreen` | 1 Welcome | Language toggle in the fenced green hero (#3) |
| `AreaScreen` | 2 Area and hubs | Neighborhood (#4) plus the "Pick your hubs" checklist, pre-checked from step 1 |
| `LessonScreen` | 3 Quick Exit lesson | Demo shows the delivery cover instead of the bus schedule; shake-to-exit switch works on phones |
| `HomeScreen` | 4 Home / 2 Home desktop | Greeting, missing-person alert card (portrait, sector progress, Join / Share), need cards (#2) with the emergency line, one-ticket preview, news strip, then the community hubs and district overview from the demo branch |
| `AskScreen` | 5 Ask for help | Chat, "Tap to fix" review (#6), "Closest options" bubble, privacy switch (#16) |
| `StatusScreen` | 6 Help is on the way | Plus the request-code card (#15) and "I don't need this anymore" (sample tickets only until the API has a cancel endpoint) |
| `MapScreen` | 7 Food tonight | Filter chips, map card with floating controls, place cards with Directions |
| `RequestsScreen` | 10 Requests | Ticket with "Take it" stub and #id, "Hand it back", chips for urgency and district (#17), the locked training card |

Background and fence: phones show the screen edge to edge on paper. From 600px up the app sits on the mockup's stage,
ComForce green `#0C3A24` with the faint diagonal chain-link fence, and the screen is a paper card lifted off it. The
fence also appears where the mockup uses it: the welcome hero, the status card, the hub header band, the red
search-party header, the "taken" ticket stub, and the tight chain-link fill for cleared search sectors.

The emergency line (#7) sits in the footer of the intake screens (setup, Ask, status) and inside "What do you need?"
on Home, where the mockup's desktop home puts it. Things the mockup shows that have no screen yet (notifications bell,
"Get trained") are drawn but marked not built.

## Draft PR description

```markdown
Adds the resident "Ask for help" path from the v9 mockup: a shell with Quick Exit and the emergency call bar,
the intake survey, the AI review card, the privacy notice and the anonymous status timeline. Talks to the
`/api/v1/intake` endpoints from #50 and falls back to sample data when the server isn't running.

Closes #3, closes #4, closes #5, closes #6, closes #7, closes #10, closes #15, closes #16

Not included: #2, #8, #9 (the Quick Exit button and disguise plug into `useQuickExit()` from #10).
```
