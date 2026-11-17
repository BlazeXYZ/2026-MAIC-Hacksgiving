# Code & Engineering Style Guide - 2026 MAIC Hacksgiving

This guide defines the engineering conventions and quality standards for our hackathon project. While hackathons demand high velocity, maintaining consistent conventions saves countless hours debugging syntax errors, type mismatches, and merge conflicts.

---

## 1. General Principles

* **Readability Over Cleverness:** Write code that any team member can read and understand in 30 seconds.
* **Fail Gracefully:** External AI APIs can experience rate limits, latency spikes, or connectivity drops. Always wrap network calls in defensive error handling.
* **Modular Architecture:** Keep components decoupled. UI components should consume API contracts; business logic should not depend directly on UI rendering.

---

## 2. Python Conventions

### Formatting & Linting
* We target **Python 3.10+**.
* Code formatting follows **PEP 8** standards with an 88-character maximum line length.
* Use [Ruff](https://github.com/astral-sh/ruff) or [Black](https://github.com/psf/black) for automated formatting:
  ```bash
  # Format code
  ruff format .
  # Check for errors and lint violations
  ruff check .
  ```

### Naming Conventions
* **Modules and Packages:** `snake_case` (e.g., `vector_store.py`, `prompt_templates.py`)
* **Classes:** `PascalCase` (e.g., `DocumentRetriever`, `EmbeddingService`)
* **Functions and Methods:** `snake_case` (e.g., `query_model()`, `parse_pdf_payload()`)
* **Variables and Attributes:** `snake_case` (e.g., `user_query`, `chunk_size`)
* **Constants:** `UPPER_SNAKE_CASE` (e.g., `DEFAULT_TEMPERATURE`, `MAX_RETRIES`)

### Type Annotations
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

### Import Organization
Group imports in the following order, separated by a single blank line:
1. Standard library modules (`os`, `sys`, `pathlib`, `typing`)
2. Third-party packages (`fastapi`, `pydantic`, `google-genai`, `openai`)
3. Local application imports (`from src.core.config import settings`)

Avoid wildcard imports (e.g., `from module import *`).

---

## 3. AI & LLM Integration Guidelines

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

### Defensive Response Parsing
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

## 4. Jupyter Notebook Best Practices

Notebooks in `notebooks/` are intended for rapid data exploration and proof-of-concept modeling:

* **Clear Outputs Before Committing:** Run `Kernel -> Restart & Clear Output` prior to committing `.ipynb` files to git to prevent multi-megabyte JSON diffs.
* **Top-to-Bottom Execution:** Notebooks must run predictably from top to bottom without relying on out-of-order cell execution.
* **Graduate Code to `src/`:** As soon as an algorithm, data loader, or prompt is validated, refactor it into a reusable Python module in `src/`.

---

## 5. Security & Sensitive Data Handling

* **Zero Hardcoded Secrets:** All API keys, database credentials, and session tokens must be loaded through environment variables (using `python-dotenv` or `pydantic-settings`).
* **Nonprofit Data Privacy:** If our partner provides real or sensitive operational datasets:
  * Do not upload real identifying client/patient data to public repositories.
  * Use anonymized sample mock data in `data/samples/` for testing and demonstration.
