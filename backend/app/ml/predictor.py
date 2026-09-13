from pathlib import Path
from typing import Any

import joblib
import pandas as pd


MODEL_PATH = Path("backend/app/ml/risk_model.joblib")

FEATURES = [
    "commits",
    "contributors",
    "lines_added",
    "lines_deleted",
    "churn",
]


def predict_risk(metrics: dict[str, Any]) -> dict[str, Any]:
    if not MODEL_PATH.exists():
        raise FileNotFoundError("Risk model has not been trained yet.")

    model = joblib.load(MODEL_PATH)

    values = pd.DataFrame(
    [[metrics.get(feature, 0) for feature in FEATURES]],
    columns=FEATURES,
)
    prediction = int(model.predict(values)[0])
    probability = float(model.predict_proba(values)[0][prediction])

    return {
        "risk_label": prediction,
        "risk": "high" if prediction == 1 else "low",
        "confidence": round(probability, 4),
    }

def predict_risks_for_files(
    git_history: dict[str, dict[str, Any]],
) -> dict[str, dict[str, Any]]:
    results = {}

    for path, metrics in git_history.items():
        results[path] = {
            **metrics,
            **predict_risk(metrics),
        }

    return results