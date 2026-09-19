from collections import defaultdict
from pathlib import PurePosixPath

from git import Repo


def analyze_git_history(repo_path: str) -> dict:
    repo = Repo(repo_path)

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

    for commit in repo.iter_commits():
        author = commit.author.email or commit.author.name

        # Skip the root commit because it has no parent to compare against.
        if not commit.parents:
            continue

        # Compare the commit with its first parent.
        parent = commit.parents[0]
        diff = parent.diff(commit, create_patch=False)

        for changed_file in diff:
            raw_path = changed_file.b_path or changed_file.a_path

            if not raw_path:
                continue

            path = str(PurePosixPath(raw_path))
            path_parts = set(PurePosixPath(path).parts)

            if path_parts.intersection(excluded_directories):
                continue

            file_commits[path] += 1
            file_contributors[path].add(author)

            try:
                stats = commit.stats.files.get(raw_path, {})
                added = stats.get("insertions", 0)
                deleted = stats.get("deletions", 0)
            except Exception:
                added = 0
                deleted = 0

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