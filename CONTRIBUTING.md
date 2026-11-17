# Contributing & Style Guide - 2026 MAIC Hacksgiving

This guide covers how our team works together on GitHub for Hacksgiving 2026. 

Hackathons move fast. When five people are writing code at the same time, bad habits lead to broken code and merge conflicts right before the final presentation. Following these simple rules keeps our project running smoothly and saves us from headaches on Sunday.

---

## Table of Contents

- [The Four Golden Rules](#the-four-golden-rules)
- [Git Workflow](#git-workflow)
  - [Branching Strategy](#branching-strategy)
  - [Commit Messages](#commit-messages)
  - [Pull Requests](#pull-requests)
  - [Sprint Milestones & Code Freeze](#sprint-milestones--code-freeze)
- [Coding Standards](#coding-standards)
  - [Python Rules](#python-rules)
  - [TypeScript and React Rules](#typescript-and-react-rules)
  - [AI & Prompt Engineering Rules](#ai--prompt-engineering-rules)
  - [Jupyter Notebooks](#jupyter-notebooks)
- [Security and Data Privacy](#security-and-data-privacy)

---

## The Four Golden Rules

1. **Keep `main` working at all times.** Anyone should be able to clone `main` right now and run it without errors. Never push broken experiments directly to `main`.
2. **Never commit secrets or personal data.** Always check `.gitignore` before you run `git add`. Never commit `.env` files, API keys, passwords, or personal phone numbers.
3. **Commit often and push early.** Do not sit on two days of code on your laptop. Making small, clear commits makes merging easier and prevents lost work.
4. **Talk to the team before making big changes.** If you plan to change an API route name, rewrite a database schema, or swap out a core library, tell everyone in our group chat first.

---

## Git Workflow

### Branching Strategy

We use short-lived feature branches. Always start by pulling the latest changes from `main`:

```bash
git checkout main
git pull origin main
git checkout -b <type>/<short-description>
```

#### Branch Name Prefixes

| Prefix | What it is for | Example |
| :--- | :--- | :--- |
| `feat/` | A new feature or screen | `feat/r3f-city-map`, `feat/gemini-parser` |
| `fix/` | Fixing a bug or broken route | `fix/api-cors-error`, `fix/marker-click-crash` |
| `exp/` | Quick experiments or testing ideas | `exp/three-lighting`, `exp/whisper-test` |
| `docs/` | Slides, diagrams, or markdown updates | `docs/slide-deck-outline`, `docs/setup-steps` |
| `chore/` | Updating packages or build tools | `chore/add-lucide-icons`, `chore/ruff-lint` |

---

### Commit Messages

Use simple, conventional commit prefixes so everyone knows what changed from the git log:

```text
<type>: <short summary in plain language>
```

#### Common Types
* `feat`: A new feature or capability.
* `fix`: A bug fix.
* `docs`: Documentation, README, or slide deck updates.
* `refactor`: Cleaning up code without changing what it does.
* `style`: Fixing formatting, indentation, or lint warnings.
* `test`: Adding or updating test cases.
* `chore`: Updating dependencies, packages, or config files.

#### Examples of Good Commits
* `feat: add 3D emergency marker component with pulse animation`
* `fix: handle missing API key with a helpful console warning`
* `docs: add ComforceMKE partner notes to README`
* `refactor: move prompt templates into src/core/prompts.py`

---

### Pull Requests

1. **Check your work locally:**
   * Run the app and make sure your new code works without breaking other pages.
   * Run `git status` and `git diff` before opening a pull request to make sure no junk files (like `.env`, `__pycache__`, or local test files) got staged.
2. **Open the PR:**
   * Write two or three sentences explaining what you added or fixed.
   * If you made a visual change in React or Three.js, paste a screenshot or quick screen recording in the description.
3. **Quick Peer Review:**
   * At least one other teammate needs to review the PR before merging.
   * In a hackathon, reviews should be fast. Make sure it runs, doesn't break the build, and looks clean.
4. **Merge:**
   * Use **Squash and Merge** so our commit history on `main` stays clean and easy to read.
   * Delete your branch after merging it.

---

### Sprint Milestones & Code Freeze

* **Thursday Night (Kickoff & Setup):**
  * Pick our primary idea from `IDEAS.md`.
  * Make sure everyone has cloned the repo, created their `.env` file, and verified they can run both the frontend and backend locally.
* **Friday Afternoon (Core Skeleton):**
  * Build the initial user interface (whether a 3D canvas, a mobile view, or an SMS simulator).
  * Define the JSON API endpoints in FastAPI so the frontend and backend can be built at the same time using mock responses.
* **Saturday Afternoon (Full Integration):**
  * Connect the real AI backend to the client interface.
  * Handle edge cases, like when the AI returns bad JSON or when an API request times out.
* **Sunday Morning (Hard Code Freeze, 2 Hours Before Presentations):**
  * **No new features.** Stop writing new code. Focus only on critical bug fixes and demo polish.
  * **Fresh clone test:** One person clones the repo into a brand new folder and follows the setup steps in `README.md` from scratch. If it doesn't work out of the box, we fix the instructions immediately.
  * **Backup demo recording:** Record a 2-minute video showing the app working on a laptop. If the venue Wi-Fi in Diercks Hall slows down during judging, we play the video instead of stressing over network timeouts.
  * **Rehearse the pitch:** Make sure the live demo matches our presentation slides.

---

## Coding Standards

### Python Rules

* We use **Python 3.10 or newer**.
* Follow standard **PEP 8** formatting. We use **Ruff** for fast linting and formatting:
  ```bash
  # Check for errors and formatting issues
  ruff check .
  # Automatically format code
  ruff format .
  ```
* Use `snake_case` for function and file names (`parse_incident_report.py`, `get_coordinates()`).
* Use `PascalCase` for classes (`CrisisReport`, `IncidentService`).
* Use `UPPER_SNAKE_CASE` for constants (`DEFAULT_TIMEOUT_SECONDS`, `MAX_RETRIES`).
* Write type hints on function arguments and return values so everyone knows what types are expected:
  ```python
  def parse_report(raw_text: str, max_items: int = 5) -> dict[str, str]:
      """Parse user message and extract basic fields."""
      ...
  ```

---

### TypeScript and React Rules

* Use TypeScript types or interfaces for all props, API responses, and state objects.
* Keep components small and focused. Organize standard views by feature under `src/components/ui/`.
* If our chosen idea uses Three.js, put each 3D object (such as a map marker, terrain mesh, or camera rig) in its own file under `src/components/3d/`. Keep 2D overlays (like header bars and drawers) in standard HTML/React layers over the canvas.

---

### AI & Prompt Engineering Rules

* **Do not scatter prompt strings everywhere.** Keep all system prompts and templates in a single file or folder (like `src/core/prompts.py`).
* **Handle bad JSON safely.** LLMs sometimes add chatty text or forget a closing bracket. Always use a try-except block when parsing JSON from a model response so the server doesn't crash:
  ```python
  import json
  import logging

  logger = logging.getLogger(__name__)

  def safe_parse_json(text: str) -> dict:
      """Safely extract JSON from model output."""
      cleaned = text.strip()
      if cleaned.startswith("```json"):
          cleaned = cleaned[7:]
      if cleaned.startswith("```"):
          cleaned = cleaned[3:]
      if cleaned.endswith("```"):
          cleaned = cleaned[:-3]
      try:
          return json.loads(cleaned.strip())
      except json.JSONDecodeError:
          logger.warning("Model returned invalid JSON. Falling back to default.")
          return {"status": "error", "raw": text}
  ```
* **Always set a timeout.** External model APIs can hang when network connections are slow. Set a clear timeout (like 10 or 15 seconds) on every outbound request.

---

### Jupyter Notebooks

* Notebooks in `notebooks/` are for quick tests, prompt experiments, and looking at data.
* **Clear all outputs before committing.** Click `Kernel -> Restart & Clear Output` before you commit any `.ipynb` file. This stops massive JSON diffs from cluttering git.
* Once a piece of code works well in a notebook, copy it into a Python module in `src/` so the rest of the team can use it.

---

## Security and Data Privacy

* **Zero hardcoded API keys.** All keys must come from the `.env` file using `os.getenv()`.
* **Protect partner and resident data.** ComforceMKE helps real people in tough situations. Do not put real phone numbers, real names, or private street addresses in public test files. Use fake sample data in `data/` for our demos.
* **Input validation:** Validate and clean all incoming text before passing it to AI models or database queries.
