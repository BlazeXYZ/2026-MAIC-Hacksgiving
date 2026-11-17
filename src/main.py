"""Main application entry point for 2026 MAIC Hacksgiving."""

import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from src.core.config import settings

app = FastAPI(
    title=settings.APP_NAME,
    description="Backend API prototype developed for the 2026 MAIC Hacksgiving Hackathon at MSOE.",
    version="0.1.0",
)

# Enable CORS for local frontend development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class HealthResponse(BaseModel):
    status: str
    app_name: str
    environment: str

class QueryRequest(BaseModel):
    prompt: str

class QueryResponse(BaseModel):
    prompt: str
    response: str
    status: str

@app.get("/", response_model=HealthResponse)
def root():
    """Root health check endpoint."""
    return HealthResponse(
        status="healthy",
        app_name=settings.APP_NAME,
        environment=settings.APP_ENV,
    )

@app.post("/api/query", response_model=QueryResponse)
def handle_query(payload: QueryRequest):
    """Placeholder query endpoint for AI/ML inference or RAG."""
    # TODO: Connect with chosen AI model provider in src/services/
    return QueryResponse(
        prompt=payload.prompt,
        response=f"Received query: '{payload.prompt}'. Connect your AI provider in src/services/ to generate responses.",
        status="mock_response",
    )

if __name__ == "__main__":
    uvicorn.run(
        "src.main:app",
        host=settings.HOST,
        port=settings.PORT,
        reload=settings.DEBUG,
    )
