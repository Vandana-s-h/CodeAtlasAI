from typing import Any

from app.git_analysis.commits import analyze_git_history


def build_training_data(repository_path: str = ".") -> list[dict[str, Any]]:
    history = analyze_git_history(repository_path)

    rows = []

    for file_path, metrics in history.items():
        churn = metrics.get("churn", 0)

        # Demonstration label only.
        risk_label = 1 if churn >= 20 else 0

        rows.append(
            {
                "file_path": file_path,
                "commits": metrics.get("commits", 0),
                "contributors": metrics.get("contributors", 0),
                "lines_added": metrics.get("lines_added", 0),
                "lines_deleted": metrics.get("lines_deleted", 0),
                "churn": churn,
                "risk_label": risk_label,
            }
        )

    print(f"Training rows generated: {len(rows)}")

    return rows