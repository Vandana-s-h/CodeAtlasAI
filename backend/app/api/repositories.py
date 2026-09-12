from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, HttpUrl

from backend.app.analyzer.github import analyze_public_repository


router = APIRouter(
    prefix="/api/repositories",
    tags=["Repositories"],
)


class RepositoryRequest(BaseModel):
    url: HttpUrl


@router.post("/analyze")
def analyze_repository(request: RepositoryRequest):
    try:
        return analyze_public_repository(str(request.url))
    except Exception as error:
        raise HTTPException(
            status_code=500,
            detail=str(error),
        )
