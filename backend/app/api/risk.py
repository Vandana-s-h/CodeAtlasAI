from typing import Any

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.ml.predictor import predict_risk


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
def risk_status() -> dict[str, Any]:
    return {
        "service": "risk-prediction",
        "status": "prototype",
        "description": (
            "Heuristic proof-of-concept model. "
            "Predictions require more representative labeled data "
            "for reliable production use."
        ),
        "features": [
            "commits",
            "contributors",
            "lines_added",
            "lines_deleted",
            "churn",
        ],
    }


@router.post("/predict")
def predict_repository_risk(
    request: RiskPredictionRequest,
) -> dict[str, Any]:
    try:
        result = predict_risk(request.model_dump())

        return {
            "service": "risk-prediction",
            "status": "prototype",
            "prediction": result,
        }

    except FileNotFoundError as error:
        raise HTTPException(
            status_code=503,
            detail=(
                "Risk model is not available. "
                "Train the model before making predictions."
            ),
        ) from error