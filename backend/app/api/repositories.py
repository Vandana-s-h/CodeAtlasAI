from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, HttpUrl
from sqlalchemy.exc import IntegrityError

from app.analyzer.github import analyze_public_repository
from app.db.database import SessionLocal
from app.db.models import Repository

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

        repository = Repository(
            owner=repository_data.get("owner", ""),
            name=repository_data.get("name", ""),
            url=repository_data.get("url", str(request.url)),
            file_count=analysis_data.get("file_count", 0),
            loc=analysis_data.get("loc", 0),
            status=result.get("status", "completed"),
        )

        db.add(repository)
        db.commit()
        db.refresh(repository)

        result["repository"]["id"] = repository.id

        return result

    except ValueError as exc:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(exc))

    except RuntimeError as exc:
        db.rollback()
        raise HTTPException(status_code=502, detail=str(exc))

    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=409,
            detail="This repository has already been analyzed.",
        )

    finally:
        db.close()