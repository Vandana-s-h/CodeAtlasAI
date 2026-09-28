from collections import defaultdict
from pathlib import PurePosixPath
import subprocess

from git import Repo


MAX_COMMITS = 100


def analyze_git_history(repo_path: str, max_commits: int = MAX_COMMITS) -> dict:
    file_commits = defaultdict(int)
    file_contributors = defaultdict(set)
    file_added = defaultdict(int)
    file_deleted = defaultdict(int)

    excluded_directories = {
        ".git",
        "venv",
        ".venv",
        "node_modules",
        "__pycache__",
    }

    try:
        result = subprocess.run(
            [
                "git",
                "-C",
                repo_path,
                "log",
                f"-n{max_commits}",
                "--numstat",
                "--format=COMMIT:%H|%ae",
            ],
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
            timeout=30,
            check=True,
        )
    except (subprocess.TimeoutExpired, subprocess.CalledProcessError):
        return {}

    current_author = None

    for line in result.stdout.splitlines():
        if line.startswith("COMMIT:"):
            parts = line.split("|", 1)
            current_author = parts[1] if len(parts) > 1 else "unknown"
            continue

        if not line.strip() or current_author is None:
            continue

        parts = line.split("\t")

        if len(parts) < 3:
            continue

        added_raw, deleted_raw, raw_path = parts[0], parts[1], parts[2]

        try:
            added = int(added_raw)
        except ValueError:
            added = 0

        try:
            deleted = int(deleted_raw)
        except ValueError:
            deleted = 0

        if " => " in raw_path:
            raw_path = raw_path.split(" => ")[-1]

        path = str(PurePosixPath(raw_path))
        path_parts = set(PurePosixPath(path).parts)

        if path_parts.intersection(excluded_directories):
            continue

        file_commits[path] += 1
        file_contributors[path].add(current_author)
        file_added[path] += added
        file_deleted[path] += deleted

    return {
        path: {
            "commits": file_commits[path],
            "contributors": len(file_contributors[path]),
            "lines_added": file_added[path],
            "lines_deleted": file_deleted[path],
            "churn": file_added[path] + file_deleted[path],
        }
        for path in file_commits
    }