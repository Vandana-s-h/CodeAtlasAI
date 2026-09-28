from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, HttpUrl
from sqlalchemy import select

from app.analyzer.github import analyze_public_repository
from app.db.database import SessionLocal
from app.db.models import Repository
from app.db.neo4j_db import create_file_nodes, create_repository_node
from app.graph.graph_writer import write_analysis_to_graph


router = APIRouter(
    prefix="/api/repositories",
    tags=["Repositories"],
)


class RepositoryRequest(BaseModel):
    url: HttpUrl
    branch: str | None = None


def parse_repository_name(repository: str) -> tuple[str, str]:
    """
    Convert a GitHub repository name such as
    'psf/requests' into ('psf', 'requests').
    """
    parts = repository.strip("/").split("/")

    if len(parts) >= 2:
        return parts[-2], parts[-1]

    return "", repository


@router.post("/analyze")
def analyze_repository(request: RepositoryRequest):
    db = SessionLocal()

    try:
        result = analyze_public_repository(
            str(request.url),
            branch=request.branch,
        )

        repository_name = result.get(
            "repository",
            "",
        )

        repository_url = result.get(
            "url",
            str(request.url),
        )

        analysis_data = result.get(
            "analysis",
            {},
        )

        owner, name = parse_repository_name(
            repository_name
        )

        repository = db.execute(
            select(Repository).where(
                Repository.url == repository_url
            )
        ).scalar_one_or_none()

        if repository is None:
            repository = Repository(
                owner=owner,
                name=name,
                url=repository_url,
            )

            db.add(repository)

        repository.owner = owner
        repository.name = name
        repository.url = repository_url
        repository.file_count = analysis_data.get(
            "file_count",
            0,
        )
        repository.loc = analysis_data.get(
            "loc",
            0,
        )
        repository.status = result.get(
            "status",
            "completed",
        )

        db.commit()
        db.refresh(repository)

        create_repository_node(
            owner=repository.owner,
            name=repository.name,
            url=repository.url,
        )

        create_file_nodes(
            repository_url=repository.url,
            files=analysis_data.get(
                "files",
                [],
            ),
        )

        result["repository_id"] = repository.id

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

    except Exception as exc:
        db.rollback()

        raise HTTPException(
            status_code=500,
            detail=str(exc),
        )

    finally:
        db.close()


@router.post("/analyze-and-index")
def analyze_and_index_repository(
    request: RepositoryRequest,
):
    try:
        analysis = analyze_public_repository(
            str(request.url),
            branch=request.branch,
        )

        graph_result = write_analysis_to_graph(
            analysis
        )

        return {
            "repository": analysis["repository"],
            "status": "analyzed_and_indexed",
            "analysis": analysis,
            "graph": graph_result,
        }

    except ValueError as exc:
        raise HTTPException(
            status_code=400,
            detail=str(exc),
        )

    except RuntimeError as exc:
        raise HTTPException(
            status_code=502,
            detail=str(exc),
        )

    except Exception as error:
        raise HTTPException(
            status_code=500,
            detail=str(error),
        )