from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, HttpUrl
from app.analyzer.github import analyze_public_repository

router = APIRouter(prefix="/repositories", tags=["repositories"])

class AnalyzeRequest(BaseModel):
    url: HttpUrl

@router.post("/analyze")
def analyze(request: AnalyzeRequest):
    try:
        return analyze_public_repository(str(request.url))
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except RuntimeError as exc:
        raise HTTPException(status_code=502, detail=str(exc))
