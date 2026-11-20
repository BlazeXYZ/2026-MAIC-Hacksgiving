# Pull Request Review Rules & Verification Standards

This guide defines the exact, authoritative criteria for reviewing all Pull Requests in the **2026-MAIC-Hacksgiving (ComForce MKE Community Hub)** repository.

---

## 1. Process & Workflow Checklist

Every incoming Pull Request must satisfy these process rules before code approval:

### 1.1 One PR Per Issue (Strict Isolation)
- **Rule:** Every completed task or feature must be developed on its own dedicated feature branch and opened as its own separate Pull Request.
- **Prohibition:** Never bundle multiple issues into a single monolithic PR.
- **Branch Naming Standard:**
  - `feat/issue-<number>-<short-description>`
  - `fix/issue-<number>-<short-description>`
  - `docs/issue-<number>-<short-description>`
- **Action on Violation:** Request changes and instruct the author to split the work into separate branch PRs (e.g. as done when splitting multi-issue frontend mockups).

### 1.2 Mandatory Issue Linkage
- **Rule:** The PR description must explicitly include:
  ```markdown
  Closes #<issue_number>
  ```
- **Action on Violation:** Leave a review requesting the author to link the relevant issue(s) using the GitHub closing keyword.

### 1.3 Mandatory Reviewers
- **Rule:** Every PR must request `@Akiisqt` or `@BlazeXYZ` (or both) as reviewers:
  ```bash
  gh pr create --reviewer Akiisqt,BlazeXYZ
  ```
- **Prohibition:** No self-merging or bypassing review without explicit human approval.

### 1.4 Incomplete / Draft PR Filter
- **Rule:** If a PR is incomplete (e.g., placeholder template, empty draft, unconfigured scaffold without working logic), **do not review it yet**.
- **Action:** Leave it in draft or wait until substantive code is submitted.

### 1.5 Review Status Emojis in PR Titles
- **`⚠️ ` (Changes Requested):**
  - If any test fails, linter fails, rules are violated, or code fixes are required, prepend `⚠️ ` to the PR title:
    ```bash
    gh pr edit <pr_number> --title "⚠️ <original_title>"
    ```
  - Leave a review comment detailing each required fix and explicitly instruct the contributor:
    > *"Please remove the `⚠️ ` from the PR title once you have addressed all requested changes."*
  - On subsequent review passes, inspect whether new commits or changes were pushed to address the feedback.
- **`✅ ` (Approved / Good to Merge):**
  - Once all criteria pass, tests pass, and linter passes, prepend `✅ ` to the PR title:
    ```bash
    gh pr edit <pr_number> --title "✅ <original_title>"
    ```
  - Submit an approving review (`gh pr review <pr_number> --approve`).

---

## 2. Technical & Quality Verification Standards

Reviewers must execute automated verification against each PR's branch:

### 2.1 Automated Test Execution (`pytest`)
- Run all project tests:
  ```bash
  .venv/bin/pytest
  ```
- All test suites must pass with **0 failures and 0 errors**.
- Any regression or contract drift must be resolved before merge.

### 2.2 Linter & Style Standards (`ruff`)
- Run Ruff linting and formatting check:
  ```bash
  .venv/bin/ruff check .
  ```
- Must have **0 lint violations**. Fixable violations should be addressed with `ruff check --fix .` or `ruff format .`.

### 2.3 Clean Git Tree
- Staged and committed files must be free of:
  - Cache files (`__pycache__`, `.pytest_cache`, `.mypy_cache`)
  - Secrets and environment configs (`.env`, `.env.local`, credentials)
  - OS clutter (`.DS_Store`, `Thumbs.db`)

---

## 3. Security, Privacy, and Code Hygiene

### 3.1 Data Privacy (Zero Exceptions)
- **Privacy by Default:** Incoming resident descriptions, phone numbers, and addresses must be sanitized before logging or transmitting to external LLMs.
  - Required utility: `src/server/privacy.py:scrub()`
- **Synthetic Test Data Only:**
  - Never hardcode real partner numbers or addresses in test fixtures.
  - Use `555` exchange numbers (e.g., `414-555-0199`) and synthetic street addresses.

### 3.2 Robust LLM Integration
- All outbound LLM calls must enforce a hard timeout (maximum 4–10 seconds) with offline mock fallbacks.
- LLM response JSON parsing must be wrapped with fallback handlers (e.g., `safe_parse_json` or fallback triage schema) so malformed LLM outputs never crash the server.

### 3.3 Strict Typing
- **Python:** All function signatures must include type annotations for both arguments and return values.
- **TypeScript:** Strict interfaces or type definitions for props, state, and API models under `src/client/`.

### 3.4 Non-Blocking Async Backend
- All FastAPI I/O endpoints must be non-blocking. Do not use synchronous blocking `httpx.post` or `requests.get` inside async route handlers.

### 3.5 Permissions & Security Headers
- Do not disable necessary browser permissions in `Permissions-Policy` headers (e.g. `geolocation` is needed for interactive map centering).
