# Contribution Guide - 2026 MAIC Hacksgiving

Welcome to our team's collaboration guide for **Hacksgiving 2026**! 

Hackathons move rapidly, and effective team coordination is what separates winning projects from stressful last-minute merge disasters. Follow these lightweight standards to keep everyone productive, aligned, and code-freeze ready.

---

## The Four Golden Rules

1. **Protect `main`:** The `main` branch must always remain in a clean, runnable, and demo-ready state.
2. **Never Commit Secrets:** Double-check `.gitignore` before every commit. Never commit `.env` files, API keys, passwords, or personal credentials.
3. **Commit Early and Push Regularly:** Avoid sitting on large local changes. Small, modular commits make merges seamless and prevent duplicate effort.
4. **Communicate Before Branching:** Check in with teammates before initiating major structural refactors or schema migrations.

---

## Branching Strategy

We use a feature-branch workflow. All work begins from an updated `main` branch:

```bash
git checkout main
git pull origin main
git checkout -b <type>/<short-description>
```

### Branch Naming Conventions

| Prefix | Purpose | Example |
| :--- | :--- | :--- |
| `feat/` | New functionality or user-facing feature | `feat/gemini-rag-pipeline`, `feat/chat-interface` |
| `fix/` | Bug fixes and edge case resolutions | `fix/api-rate-limit-retry`, `fix/cors-headers` |
| `exp/` | Prototyping, notebooks, or exploratory ML models | `exp/clustering-experiments`, `exp/whisper-eval` |
| `docs/` | Documentation, pitch notes, or presentation assets | `docs/architecture-diagrams`, `docs/pitch-outline` |
| `chore/` | Dependency updates, tooling, or repository setup | `chore/add-pydantic-settings`, `chore/setup-ruff` |

---

## Commit Message Conventions

We adhere to clear, conventional commit messages:

```text
<type>(<scope>): <concise summary in imperative mood>

[optional body explaining context or rationale]
```

### Commit Types
* `feat`: A new capability or feature.
* `fix`: A defect resolution.
* `refactor`: Code reorganization without functional changes.
* `docs`: Documentation, README, or markdown updates.
* `style`: Formatting, whitespace, or linting cleanup.
* `test`: Adding or updating test cases.
* `chore`: Build scripts, dependencies, or configuration tweaks.

### Good Commit Examples
* `feat(services): implement vector retrieval with MMR reranking`
* `fix(api): handle missing partner token gracefully with 401 error`
* `docs(readme): update local setup guide and environment variable list`

---

## Pull Request (PR) Workflow

1. **Self-Review:**
   * Verify all tests and lint checks pass locally.
   * Run a `git status` and `git diff` to confirm no unintended files (such as `.env`, `__pycache__`, or raw datasets) are staged.

2. **Open a PR:**
   * Provide a concise description of what was built or changed.
   * Include a screenshot or terminal output showing working functionality.

3. **Peer Review:**
   * At least one teammate should review and approve the PR before merging.
   * In a hackathon setting, reviews should be rapid—focus on verifying that it runs cleanly, does not break `main`, and follows architectural patterns.

4. **Merge & Clean Up:**
   * Use **Squash and Merge** or **Rebase and Merge** to maintain a clean linear history on `main`.
   * Delete the feature branch on GitHub and locally after merging.

---

## Hackathon Sprint Milestones & Code Freeze

### Milestone 1: Kickoff & Scope Lock (Thursday Evening)
* Define core user stories and minimum viable product (MVP).
* Assign component ownership (UI, API, Data/Model, Deck).
* Establish base environment and verify all team members can clone and run `main`.

### Milestone 2: Technical Spine (Friday Afternoon)
* Establish data schemas and mock API contracts so frontend and backend work in parallel.
* Verify external model API connectivity.

### Milestone 3: Integration & Polish (Saturday Afternoon)
* Connect frontend interface to real backend endpoints.
* Implement error handling, fallback responses, and input sanitization.
* Build out sample workflows and demo prompts.

### Milestone 4: Code Freeze & Expo Prep (Sunday Morning, 2 Hours Before Pitch)
* **Hard Code Freeze:** Stop adding new features. Only critical bug fixes are permitted.
* **Fresh Clone Test:** Have one teammate clone the repository into a clean temporary directory and follow `README.md` step-by-step.
* **Offline Backup:** Record a crisp 2-minute screen recording of the complete user flow in case of venue Wi-Fi instability.
* **Slide & Pitch Alignment:** Ensure the live demo aligns precisely with the slides in `docs/`.
