from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, HttpUrl
from typing import Any
from pydantic import BaseModel, HttpUrl

from backend.app.analyzer.github import analyze_public_repository


app = FastAPI(
    title="CodeAtlas AI API",
    version="0.1.0",
)


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

@app.post(
    "/api/repositories/analyze",
    response_model=RepositoryAnalysisResponse,
)
def analyze_repository(request: RepositoryRequest):
    try:
        result = analyze_public_repository(str(request.url))
        return result
    except Exception as error:
        raise HTTPException(
            status_code=500,
            detail=str(error),
        )