from pathlib import Path

import joblib
import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import train_test_split
from sklearn.metrics import accuracy_score, classification_report

from backend.app.ml.training_data import build_training_data


MODEL_PATH = Path("backend/app/ml/risk_model.joblib")


def train_model() -> None:
    rows = build_training_data(".")
    dataframe = pd.DataFrame(rows)

    features = [
        "commits",
        "contributors",
        "lines_added",
        "lines_deleted",
        "churn",
    ]

    X = dataframe[features]
    y = dataframe["risk_label"]

    X_train, X_test, y_train, y_test = train_test_split(
        X,
        y,
        test_size=0.2,
        random_state=42,
        stratify=y,
    )

    model = RandomForestClassifier(
        n_estimators=100,
        random_state=42,
        class_weight="balanced",
    )

    model.fit(X_train, y_train)

    predictions = model.predict(X_test)

    print("Accuracy:", accuracy_score(y_test, predictions))
    print("\nClassification report:")
    print(classification_report(y_test, predictions))

    MODEL_PATH.parent.mkdir(parents=True, exist_ok=True)
    joblib.dump(model, MODEL_PATH)

    print("\nModel saved to:", MODEL_PATH)


if __name__ == "__main__":
    train_model()