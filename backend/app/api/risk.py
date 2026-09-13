from typing import Any

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from backend.app.ml.predictor import predict_risk


router = APIRouter(
    prefix="/api/risk",
    tags=["Risk"],
)


class RiskPredictionRequest(BaseModel):
    commits: int = Field(default=0, ge=0)
    contributors: int = Field(default=0, ge=0)
    lines_added: int = Field(default=0, ge=0)
    lines_deleted: int = Field(default=0, ge=0)
    churn: int = Field(default=0, ge=0)


@router.get("/status")
def risk_status():
    return {
        "service": "risk-prediction",
        "status": "ready",
    }


@router.post("/predict")
def predict_repository_risk(request: RiskPredictionRequest) -> dict[str, Any]:
    try:
        return predict_risk(request.model_dump())
    except FileNotFoundError as error:
        raise HTTPException(
            status_code=503,
            detail=str(error),
        ) from error