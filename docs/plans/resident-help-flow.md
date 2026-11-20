# Work plan: `feat/resident-help-flow`

One branch and one PR for the resident side of the v9 mockup: the app shell with Quick Exit, plus the
"Ask for help" path from the first tap to "Help is on the way". It closes 8 of the 18 frontend issues
assigned to `@BlazeXYZ` (shared with `@Fonsh19`).

> **Scope change (2026-11-20):** we are **not** doing #2, #8, #9, #11 or #17 on this branch.
> That leaves **#3, #4, #5, #6, #7, #10, #15, #16**. Three of the kept issues touch the dropped ones, so they
> are built as seams the other work plugs into, not as replacements:
>
> - **#10 without #8/#9:** `useQuickExit()` exposes `exit()` / `restore()` and does the storage + survey flush.
>   `useTripleTap()` is the return gesture. #8's button and Esc key call `exit()`; #9's disguise header
>   spreads `useTripleTap(restore)`. The old inline placeholder in `App.tsx` stays as the stand-in until then.
> - **#5 without #2:** `OtherTextInput` is a standalone component driven by `need === 'other'` in the survey
>   context. A plain, unstyled need list (marked as the #2 slot) sets `need` so the flow can be demoed.
> - **#11 and #17** were already outside this bundle; nothing here depends on them.

Sources: the issue bodies, `README.md`, `IDEAS.md`, `CONTRIBUTING.md` and `docs/design/hub-mockup-v9.html`
(source in `docs/design/src/v9/template.html`, decoy screen in `docs/design/src/common/decoy.html`).

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

## Draft PR description

```markdown
Adds the resident "Ask for help" path from the v9 mockup: a shell with Quick Exit and the emergency call bar,
the intake survey, the AI review card, the privacy notice and the anonymous status timeline. Talks to the
`/api/v1/intake` endpoints from #50 and falls back to sample data when the server isn't running.

Closes #3, closes #4, closes #5, closes #6, closes #7, closes #10, closes #15, closes #16

Not included: #2, #8, #9 (the Quick Exit button and disguise plug into `useQuickExit()` from #10).
```
