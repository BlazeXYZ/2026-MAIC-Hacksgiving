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

    # Empty means the API starts without a database. Compose and Kubernetes set a Postgres URL.
    DATABASE_URL: str | None = os.getenv("DATABASE_URL") or None

    # API Keys
    GEMINI_API_KEY: str | None = os.getenv("GEMINI_API_KEY")
    OPENAI_API_KEY: str | None = os.getenv("OPENAI_API_KEY")
    GOOGLE_PLACES_API_KEY: str | None = os.getenv("GOOGLE_PLACES_API_KEY")

    # Vite dev server, loopback, and the Capacitor web view.
    CORS_ORIGINS: tuple[str, ...] = (
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "capacitor://localhost",
        "http://localhost",
    )
    CORS_METHODS: tuple[str, ...] = ("GET", "POST", "PATCH", "OPTIONS")
    CORS_HEADERS: tuple[str, ...] = ("Accept", "Content-Type", "Authorization")
    CORS_EXPOSE_HEADERS: tuple[str, ...] = (
        "X-Total-Count",
        "X-Urgent-Count",
        "X-Pending-Count",
    )


settings = Settings()
