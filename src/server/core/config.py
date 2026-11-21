"""Core settings and configuration for ComforceMKE backend."""

import os
from pathlib import Path

from dotenv import load_dotenv

# Locate repository root and server root, and load .env from either location
REPO_ROOT = Path(__file__).resolve().parent.parent.parent.parent
load_dotenv()
load_dotenv(REPO_ROOT / ".env")
load_dotenv(Path(__file__).resolve().parent.parent / ".env")


class Settings:
    APP_NAME: str = "ComForce Community API"
    APP_ENV: str = os.getenv("APP_ENV", "development")
    DEBUG: bool = os.getenv("DEBUG", "True").lower() in ("true", "1")
    PORT: int = int(os.getenv("PORT", "8000"))
    HOST: str = os.getenv("HOST", "0.0.0.0")

    # Database
    DATABASE_URL: str = os.getenv("DATABASE_URL", "sqlite:///dev.db")

    # API Keys
    GEMINI_API_KEY: str | None = os.getenv("GEMINI_API_KEY")
    OPENAI_API_KEY: str | None = os.getenv("OPENAI_API_KEY")
    GOOGLE_PLACES_API_KEY: str | None = os.getenv("GOOGLE_PLACES_API_KEY")

    # Jev (TypeSafe System One): a decision model used to match inventory wordings to catalog items.
    TYPESAFE_API_KEY: str | None = os.getenv("TYPESAFE_API_KEY")
    TYPESAFE_MODEL: str = os.getenv("TYPESAFE_MODEL", "jev-1.13.0")  # pin a version; "latest" moves
    TYPESAFE_URL: str = os.getenv("TYPESAFE_URL", "https://api.typesafe.ai/v1/systemone")

    # AI / LLM triage
    AI_MODEL: str = os.getenv("AI_MODEL", "gemini-2.0-flash")
    AI_TIMEOUT_SECONDS: float = float(os.getenv("AI_TIMEOUT_SECONDS", "4.0"))
    AI_MOCK_MODE: bool = os.getenv("AI_MOCK_MODE", "false").lower() in ("true", "1")

    # Vite dev server, loopback, and the Capacitor web view.
    CORS_ORIGINS: tuple[str, ...] = (
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "capacitor://localhost",
        "http://localhost",
    )
    CORS_METHODS: tuple[str, ...] = (
        "GET",
        "POST",
        "PUT",
        "PATCH",
        "DELETE",
        "OPTIONS",
    )
    CORS_HEADERS: tuple[str, ...] = ("Accept", "Content-Type", "Authorization")
    CORS_EXPOSE_HEADERS: tuple[str, ...] = (
        "X-Total-Count",
        "X-Urgent-Count",
        "X-Pending-Count",
    )


settings = Settings()
