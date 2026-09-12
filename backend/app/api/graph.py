from fastapi import APIRouter

router = APIRouter(
    prefix="/api/graph",
    tags=["Graph"],
)


@router.get("/status")
def graph_status():
    return {
        "service": "dependency-graph",
        "status": "ready",
    }