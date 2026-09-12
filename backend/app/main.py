from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, HttpUrl
from typing import Any
from pydantic import BaseModel, HttpUrl
from fastapi.middleware.cors import CORSMiddleware
from backend.app.api.repositories import router as repositories_router

from backend.app.analyzer.github import analyze_public_repository


app = FastAPI(
    title="CodeAtlas AI API",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(repositories_router)

class RepositoryRequest(BaseModel):
    url: HttpUrl

class RepositoryAnalysisResponse(BaseModel):
    repository: str
    url: str
    analysis: dict[str, Any]
    status: str

@app.get("/")
def root():
    return {
        "message": "CodeAtlas AI API is running",
        "status": "healthy",
    }

@app.get("/api/health")
def health_check():
    return {
        "service": "CodeAtlas AI",
        "analyzer": "available",
        "status": "healthy",
    }

