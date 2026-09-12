from fastapi import APIRouter

router = APIRouter(
    prefix="/api/risk",
    tags=["Risk"],
)


@router.get("/status")
def risk_status():
    return {
        "service": "risk-prediction",
        "status": "ready",
    }