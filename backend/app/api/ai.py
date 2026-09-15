from fastapi import APIRouter

router = APIRouter(
    prefix="/api/ai",
    tags=["AI"],
)


@router.get("/status")
def ai_status():
    return {
        "service": "ai-assistant",
        "status": "ready",
    }