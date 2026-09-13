from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, HttpUrl

from backend.app.analyzer.github import analyze_public_repository
from backend.app.graph.graph_writer import write_analysis_to_graph


router = APIRouter(
    prefix="/api/repositories",
    tags=["Repositories"],
)


class RepositoryRequest(BaseModel):
    url: HttpUrl
    branch: str | None = None


@router.post("/analyze")
def analyze_repository(request: RepositoryRequest):
    try:
        return analyze_public_repository(
            str(request.url),
            branch=request.branch,
        )
    except Exception as error:
        raise HTTPException(
            status_code=500,
            detail=str(error),
        )


@router.post("/analyze-and-index")
def analyze_and_index_repository(request: RepositoryRequest):
    try:
        analysis = analyze_public_repository(
            str(request.url),
            branch=request.branch,
        )

        write_analysis_to_graph(analysis)

        return {
            "repository": analysis["repository"],
            "status": "analyzed_and_indexed",
            "analysis": analysis,
        }

    except Exception as error:
        raise HTTPException(
            status_code=500,
            detail=str(error),
        )