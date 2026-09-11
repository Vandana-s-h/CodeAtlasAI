from collections import defaultdict
from git import Repo


def analyze_git_history(repo_path: str) -> dict:
    repo = Repo(repo_path)

    file_commits = defaultdict(int)
    file_contributors = defaultdict(set)
    file_added = defaultdict(int)
    file_deleted = defaultdict(int)

    for commit in repo.iter_commits():
        if not commit.parents:
            continue

        author = commit.author.email or commit.author.name

        try:
            stats = commit.stats.files
        except Exception:
            continue

        for path, data in stats.items():
            file_commits[path] += 1
            file_contributors[path].add(author)
            file_added[path] += data.get("insertions", 0)
            file_deleted[path] += data.get("deletions", 0)

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