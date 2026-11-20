# Agent Guidelines & Workflow Rules

This guide defines the execution and contribution standards for all AI agents working in this repository.

---

## 1. Core Workflow Rules

1. **One PR Per Issue (Strict Isolation):**
   - Every completed task or issue must be developed on its own dedicated branch and opened as its own separate Pull Request.
   - **Never bundle multiple issues into a single pull request.**
   - Branch naming format:
     - `feat/issue-<number>-<short-description>`
     - `fix/issue-<number>-<short-description>`
     - `docs/issue-<number>-<short-description>`

2. **Mandatory Reviewers:**
   - Every Pull Request **must** request either `@Akiisqt` or `@BlazeXYZ` (or both) as the reviewer.
   - When creating PRs via GitHub CLI:
     ```bash
     gh pr create --title "feat: <summary>" --body "Closes #<number>" --reviewer Akiisqt,BlazeXYZ
     ```
   - Do not self-merge or bypass review without explicit human approval.

3. **Issue Linkage:**
   - Every Pull Request body must include `Closes #<issue_number>` to automatically close the associated issue when merged.

---

## 2. Verification Before Submitting PRs

Before pushing and opening a PR, the agent must run:
1. **Tests:** Ensure all test cases pass:
   ```bash
   pytest
   ```
2. **Linter & Formatting:** Run Ruff to verify style standards:
   ```bash
   ruff check .
   ```
3. **Clean Git Tree:** Ensure no temporary, cached, or secret files (`.env`, `__pycache__`, `.pytest_cache`) are staged.

---

## 3. Data Privacy & Standards

- **Privacy by Default:** Always scrub phone numbers, addresses, and private contact information from user input before sending to external LLMs or logs. Use `src/server/privacy.py:scrub()`.
- **Synthetic Test Data Only:** Never hardcode real phone numbers or addresses in test fixtures. Use `555` exchange numbers and synthetic street addresses.
- **Strict Typing:** All Python functions must include type annotations on arguments and return values.
