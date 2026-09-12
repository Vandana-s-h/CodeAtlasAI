from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, HttpUrl

from backend.app.analyzer.github import analyze_public_repository


app = FastAPI(
    title="CodeAtlas AI API",
    version="0.1.0",
)


class RepositoryRequest(BaseModel):
    url: HttpUrl


@app.get("/")
def root():
    return {
        "message": "CodeAtlas AI API is running",
        "status": "healthy",
    }


@app.post("/api/repositories/analyze")
def analyze_repository(request: RepositoryRequest):
    try:
        result = analyze_public_repository(str(request.url))
        return result
    except Exception as error:
        raise HTTPException(
            status_code=500,
            detail=str(error),
        )