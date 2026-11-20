"""Core settings and configuration for ComforceMKE backend."""

import os
from pathlib import Path

from dotenv import load_dotenv

# Locate repository root and server root, and load .env from either location
REPO_ROOT = Path(__file__).resolve().parent.parent.parent.parent
load_dotenv(REPO_ROOT / ".env")
load_dotenv(Path(__file__).resolve().parent.parent / ".env")

class Settings:
    APP_NAME: str = "ComForce Community API"
    APP_ENV: str = os.getenv("APP_ENV", "development")
    DEBUG: bool = os.getenv("DEBUG", "True").lower() in ("true", "1")
    PORT: int = int(os.getenv("PORT", "8000"))
    HOST: str = os.getenv("HOST", "0.0.0.0")

    # API Keys
    GEMINI_API_KEY: str | None = os.getenv("GEMINI_API_KEY")
    OPENAI_API_KEY: str | None = os.getenv("OPENAI_API_KEY")
    GOOGLE_PLACES_API_KEY: str | None = os.getenv("GOOGLE_PLACES_API_KEY")

    # AI / LLM triage
    AI_MODEL: str = os.getenv("AI_MODEL", "gemini-2.0-flash")
    AI_TIMEOUT_SECONDS: float = float(os.getenv("AI_TIMEOUT_SECONDS", "4.0"))
    AI_MOCK_MODE: bool = os.getenv("AI_MOCK_MODE", "false").lower() in ("true", "1")

settings = Settings()
