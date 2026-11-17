# Contributing & Style Guide - 2026 MAIC Hacksgiving

Welcome to our team's unified collaboration, git workflow, and engineering style guide for **Hacksgiving 2026**!

Hackathons demand high velocity, but team coordination and consistent standards are what prevent last-minute merge conflicts, broken builds, and lost progress. Follow these guidelines to keep our codebase clean, reproducible, and demo-ready throughout the sprint.

---

## Table of Contents

- [The Four Golden Rules](#the-four-golden-rules)
- [Team Git & Collaboration Workflow](#team-git--collaboration-workflow)
  - [Branching Strategy](#branching-strategy)
  - [Commit Message Conventions](#commit-message-conventions)
  - [Pull Request (PR) Workflow](#pull-request-pr-workflow)
  - [Sprint Milestones & Code Freeze](#sprint-milestones--code-freeze)
- [Engineering & Code Standards](#engineering--code-standards)
  - [General Principles](#general-principles)
  - [Python Conventions](#python-conventions)
  - [Type Annotations & Schemas](#type-annotations--schemas)
  - [Import Organization](#import-organization)
- [AI & LLM Integration Guidelines](#ai--llm-integration-guidelines)
  - [Centralized Prompt Management](#centralized-prompt-management)
  - [Defensive Parsing & Fallbacks](#defensive-parsing--fallbacks)
  - [Rate Limiting & Timeouts](#rate-limiting--timeouts)
- [Jupyter Notebook Best Practices](#jupyter-notebook-best-practices)
- [Security, Privacy & Data Handling](#security-privacy--data-handling)

---

## The Four Golden Rules

1. **Protect `main`:** The `main` branch must always remain in a clean, runnable, and demo-ready state.
2. **Never Commit Secrets:** Double-check `.gitignore` before every commit. Never commit `.env` files, API keys, passwords, or personal credentials.
3. **Commit Early and Push Regularly:** Avoid sitting on large local changes. Small, modular commits make merges seamless and prevent duplicate effort.
4. **Communicate Before Branching:** Check in with teammates before initiating major structural refactors, database schema changes, or API contract modifications.

---

## Team Git & Collaboration Workflow

### Branching Strategy

We follow a feature-branch workflow. All work begins from an updated `main` branch:

```bash
git checkout main
git pull origin main
git checkout -b <type>/<short-description>
```

#### Branch Naming Conventions

| Prefix | Purpose | Example |
| :--- | :--- | :--- |
| `feat/` | New functionality or user-facing feature | `feat/gemini-rag-pipeline`, `feat/chat-interface` |
| `fix/` | Bug fixes and edge case resolutions | `fix/api-rate-limit-retry`, `fix/cors-headers` |
| `exp/` | Prototyping, notebooks, or exploratory ML models | `exp/clustering-experiments`, `exp/whisper-eval` |
| `docs/` | Documentation, pitch notes, or presentation assets | `docs/architecture-diagrams`, `docs/pitch-outline` |
| `chore/` | Dependency updates, tooling, or repository setup | `chore/add-pydantic-settings`, `chore/setup-ruff` |

---

### Commit Message Conventions

We adhere to clear, conventional commit messages:

```text
<type>(<scope>): <concise summary in imperative mood>

[optional body explaining context or rationale]
```

#### Commit Types
* `feat`: A new capability or feature.
* `fix`: A defect resolution.
* `refactor`: Code reorganization without functional changes.
* `docs`: Documentation, README, or markdown updates.
* `style`: Formatting, whitespace, or linting cleanup.
* `test`: Adding or updating test cases.
* `chore`: Build scripts, dependencies, or configuration tweaks.

#### Good Commit Examples
* `feat(services): implement vector retrieval with MMR reranking`
* `fix(api): handle missing partner token gracefully with 401 error`
* `docs(readme): update local setup guide and environment variable list`

---

### Pull Request (PR) Workflow

1. **Self-Review:**
   * Verify all tests and lint checks pass locally.
   * Run `git status` and `git diff` to confirm no unintended files (such as `.env`, `__pycache__`, or raw datasets) are staged.

2. **Open a PR:**
   * Fill out the provided PR template with a concise summary of changes.
   * Include a screenshot or terminal output showing working functionality.

3. **Peer Review:**
   * At least one teammate should review and approve the PR before merging.
   * In a hackathon setting, reviews should be rapid—focus on verifying that it runs cleanly, does not break `main`, and aligns with shared API contracts.

4. **Merge & Clean Up:**
   * Use **Squash and Merge** or **Rebase and Merge** to maintain a clean linear history on `main`.
   * Delete the feature branch on GitHub and locally after merging.

---

### Sprint Milestones & Code Freeze

* **Milestone 1: Kickoff & Scope Lock (Thursday Evening)**
  * Define core user stories and minimum viable product (MVP).
  * Assign component ownership (UI, API, Data/Model, Deck).
  * Establish base environment and verify all team members can clone and run `main`.

* **Milestone 2: Technical Spine (Friday Afternoon)**
  * Establish data schemas and mock API contracts so frontend and backend work in parallel.
  * Verify external model API connectivity.

* **Milestone 3: Integration & Polish (Saturday Afternoon)**
  * Connect frontend interface to real backend endpoints.
  * Implement error handling, fallback responses, and input sanitization.
  * Build out sample workflows and demo prompts.

* **Milestone 4: Code Freeze & Expo Prep (Sunday Morning, 2 Hours Before Pitch)**
  * **Hard Code Freeze:** Stop adding new features. Only critical bug fixes are permitted.
  * **Fresh Clone Test:** Have one teammate clone the repository into a clean temporary directory and follow `README.md` step-by-step.
  * **Offline Backup:** Record a crisp 2-minute screen recording of the complete user flow in case of venue Wi-Fi instability.
  * **Slide & Pitch Alignment:** Ensure the live demo aligns precisely with the slides in `docs/`.

---

## Engineering & Code Standards

### General Principles

* **Readability Over Cleverness:** Write code that any team member can read and understand in 30 seconds.
* **Fail Gracefully:** External AI APIs can experience rate limits, latency spikes, or connectivity drops. Always wrap network calls in defensive error handling.
* **Modular Architecture:** Keep components decoupled. UI components should consume API contracts; business logic should not depend directly on UI rendering.

---

### Python Conventions

#### Formatting & Linting
* We target **Python 3.10+**.
* Code formatting follows **PEP 8** standards with an 88-character maximum line length.
* Use [Ruff](https://github.com/astral-sh/ruff) or [Black](https://github.com/psf/black) for automated formatting:
  ```bash
  # Format code
  ruff format .
  # Check for errors and lint violations
  ruff check .
  ```

#### Naming Conventions
* **Modules and Packages:** `snake_case` (e.g., `vector_store.py`, `prompt_templates.py`)
* **Classes:** `PascalCase` (e.g., `DocumentRetriever`, `EmbeddingService`)
* **Functions and Methods:** `snake_case` (e.g., `query_model()`, `parse_pdf_payload()`)
* **Variables and Attributes:** `snake_case` (e.g., `user_query`, `chunk_size`)
* **Constants:** `UPPER_SNAKE_CASE` (e.g., `DEFAULT_TEMPERATURE`, `MAX_RETRIES`)

---

### Type Annotations & Schemas

Use Python type hints for all public functions, method signatures, and data contracts:

```python
from typing import Sequence
from pydantic import BaseModel, Field

class AnalysisRequest(BaseModel):
    query: str = Field(..., min_length=1, description="User search query")
    max_results: int = Field(default=5, ge=1, le=20)

class SearchResult(BaseModel):
    document_id: str
    content: str
    similarity_score: float

def execute_search(
    request: AnalysisRequest, 
    corpus_indices: Sequence[str]
) -> list[SearchResult]:
    """Execute similarity search against vector index."""
    ...
```

---

### Import Organization

Group imports in the following order, separated by a single blank line:
1. Standard library modules (`os`, `sys`, `pathlib`, `typing`)
2. Third-party packages (`fastapi`, `pydantic`, `google-genai`, `openai`)
3. Local application imports (`from src.core.config import settings`)

Avoid wildcard imports (e.g., `from module import *`).

---

## AI & LLM Integration Guidelines

### Centralized Prompt Management
* Never embed raw prompt strings directly inside API route handlers or UI files.
* Store prompt templates in a dedicated module (e.g., `src/services/prompts.py` or `src/prompts/`).
* Clearly delineate System Prompts, Few-Shot Examples, and Dynamic User Inputs.

```python
# Good: Dedicated template with parameter validation
SYSTEM_PROMPT = """You are an AI assistant designed to help nonprofit case managers.
Answer concisely, maintain a compassionate tone, and cite verified sources from context."""

def build_partner_prompt(context: str, query: str) -> str:
    return f"""Context Information:
{context}

User Question: {query}

Provide a direct answer based strictly on the context above."""
```

### Defensive Parsing & Fallbacks
* LLMs may produce conversational text even when structured output (JSON) is requested.
* Always enforce structured schemas (e.g., with Pydantic, Instructor, or native function calling) and implement fallback parsing to avoid runtime crashes.

```python
import json
import logging

logger = logging.getLogger(__name__)

def parse_model_json(raw_text: str) -> dict:
    cleaned = raw_text.strip()
    if cleaned.startswith("```json"):
        cleaned = cleaned[7:]
    if cleaned.startswith("```"):
        cleaned = cleaned[3:]
    if cleaned.endswith("```"):
        cleaned = cleaned[:-3]
    
    try:
        return json.loads(cleaned.strip())
    except json.JSONDecodeError as err:
        logger.error("Failed to parse JSON response: %s", err)
        return {"error": "Failed to parse model response", "raw": raw_text}
```

### Rate Limiting & Timeouts
* Set explicit HTTP client timeouts (e.g., `timeout=15.0`) on all external AI model calls.
* Implement basic exponential backoff retry loops for transient 429 (Rate Limit) or 503 (Overloaded) responses.

---

## Jupyter Notebook Best Practices

Notebooks in `notebooks/` are intended for rapid data exploration and proof-of-concept modeling:

* **Clear Outputs Before Committing:** Run `Kernel -> Restart & Clear Output` prior to committing `.ipynb` files to git to prevent multi-megabyte JSON diffs.
* **Top-to-Bottom Execution:** Notebooks must run predictably from top to bottom without relying on out-of-order cell execution.
* **Graduate Code to `src/`:** As soon as an algorithm, data loader, or prompt is validated, refactor it into a reusable Python module in `src/`.

---

## Security, Privacy & Data Handling

* **Zero Hardcoded Secrets:** All API keys, database credentials, and session tokens must be loaded through environment variables (using `python-dotenv` or `pydantic-settings`).
* **Nonprofit Data Privacy:** If our partner provides real or sensitive operational datasets:
  * Do not upload real identifying client/patient data to public repositories.
  * Use anonymized sample mock data in `data/samples/` for testing and demonstration.
