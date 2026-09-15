from pathlib import Path
from collections import Counter

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

    feature_columns = [
        "commits",
        "contributors",
        "lines_added",
        "lines_deleted",
    ]

    X = dataframe[feature_columns]
    y = dataframe["risk_label"]

    class_counts = Counter(y)

    print("Class distribution:", dict(class_counts))

    if len(class_counts) < 2:
        raise ValueError(
            "Training requires at least two classes in risk_label."
        )

    if min(class_counts.values()) < 2:
        print(
            "Warning: one class has fewer than 2 samples. "
            "Training without stratification."
        )

        X_train, X_test, y_train, y_test = train_test_split(
            X,
            y,
            test_size=0.2,
            random_state=42,
        )
    else:
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
    print(
        classification_report(
            y_test,
            predictions,
            zero_division=0,
        )
    )

    MODEL_PATH.parent.mkdir(parents=True, exist_ok=True)
    joblib.dump(model, MODEL_PATH)

    print("\nModel saved to:", MODEL_PATH)


if __name__ == "__main__":
    train_model()