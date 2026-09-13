from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, HttpUrl
from sqlalchemy import select

from app.analyzer.github import analyze_public_repository
from app.db.database import SessionLocal
from app.db.models import Repository
from app.db.neo4j_db import create_file_nodes, create_repository_node

router = APIRouter(prefix="/repositories", tags=["repositories"])


class AnalyzeRequest(BaseModel):
    url: HttpUrl


@router.post("/analyze")
def analyze(request: AnalyzeRequest):
    db = SessionLocal()

    try:
        result = analyze_public_repository(str(request.url))

        repository_data = result.get("repository", {})
        analysis_data = result.get("analysis", {})

        repository_url = repository_data.get(
            "url",
            str(request.url),
        )

        repository = db.execute(
            select(Repository).where(
                Repository.url == repository_url
            )
        ).scalar_one_or_none()

        if repository is None:
            repository = Repository(
                owner=repository_data.get("owner", ""),
                name=repository_data.get("name", ""),
                url=repository_url,
            )
            db.add(repository)

        repository.owner = repository_data.get("owner", "")
        repository.name = repository_data.get("name", "")
        repository.file_count = analysis_data.get("file_count", 0)
        repository.loc = analysis_data.get("loc", 0)
        repository.status = result.get("status", "completed")

        db.commit()
        db.refresh(repository)

        result["repository"]["id"] = repository.id

        create_repository_node(
            owner=repository.owner,
            name=repository.name,
            url=repository.url,
        )

        create_file_nodes(
            repository_url=repository.url,
            files=analysis_data.get("files", []),
        )

        return result

    except ValueError as exc:
        db.rollback()
        raise HTTPException(
            status_code=400,
            detail=str(exc),
        )

    except RuntimeError as exc:
        db.rollback()
        raise HTTPException(
            status_code=502,
            detail=str(exc),
        )

    finally:
        db.close()