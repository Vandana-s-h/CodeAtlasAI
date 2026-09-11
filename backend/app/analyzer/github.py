from pathlib import Path
import re
import shutil
import tempfile
from urllib.parse import urlparse
from git import Repo, GitCommandError

ALLOWED_HOSTS = {"github.com", "www.github.com"}
IGNORED_DIRS = {".git", "node_modules", "dist", "build", "__pycache__", ".venv", "venv"}
TEXT_EXTENSIONS = {
    ".py": "Python", ".js": "JavaScript", ".jsx": "JavaScript", ".ts": "TypeScript",
    ".tsx": "TypeScript", ".java": "Java", ".cpp": "C++", ".cc": "C++", ".c": "C",
    ".h": "C/C++", ".hpp": "C++", ".go": "Go", ".rs": "Rust", ".rb": "Ruby",
    ".php": "PHP", ".cs": "C#", ".kt": "Kotlin", ".swift": "Swift",
}


def parse_github_url(url: str) -> tuple[str, str]:
    parsed = urlparse(url)
    if parsed.scheme != "https" or parsed.netloc.lower() not in ALLOWED_HOSTS:
        raise ValueError("Only https://github.com/<owner>/<repository> URLs are supported in V1.")
    parts = [p for p in parsed.path.split("/") if p]
    if len(parts) < 2:
        raise ValueError("Enter a valid GitHub repository URL.")
    owner = parts[0]
    repo = re.sub(r"\.git$", "", parts[1])
    if not re.fullmatch(r"[A-Za-z0-9_.-]+", owner) or not re.fullmatch(r"[A-Za-z0-9_.-]+", repo):
        raise ValueError("Invalid GitHub repository URL.")
    return owner, repo


def scan_repository(root: Path) -> dict:
    files = []
    language_counts: dict[str, int] = {}
    total_loc = 0

    for path in root.rglob("*"):
        if not path.is_file() or any(part in IGNORED_DIRS for part in path.parts):
            continue
        rel = path.relative_to(root).as_posix()
        suffix = path.suffix.lower()
        language = TEXT_EXTENSIONS.get(suffix)
        if not language:
            continue
        try:
            text = path.read_text(encoding="utf-8", errors="ignore")
        except OSError:
            continue
        loc = sum(1 for line in text.splitlines() if line.strip())
        total_loc += loc
        language_counts[language] = language_counts.get(language, 0) + 1
        files.append({"path": rel, "language": language, "loc": loc})

    files.sort(key=lambda item: item["path"])
    return {
        "file_count": len(files),
        "loc": total_loc,
        "languages": language_counts,
        "files": files[:500],
        "files_truncated": len(files) > 500,
    }


def analyze_public_repository(url: str) -> dict:
    owner, repo_name = parse_github_url(url)
    temp_dir = Path(tempfile.mkdtemp(prefix="codeatlas-"))
    target = temp_dir / "repo"
    try:
        Repo.clone_from(f"https://github.com/{owner}/{repo_name}.git", target, depth=1)
    except GitCommandError as exc:
        shutil.rmtree(temp_dir, ignore_errors=True)
        raise RuntimeError("Could not clone the repository. V1 supports public GitHub repositories only.") from exc

    try:
        scan = scan_repository(target)
        return {
            "repository": {"owner": owner, "name": repo_name, "url": f"https://github.com/{owner}/{repo_name}"},
            "analysis": scan,
            "status": "completed",
        }
    finally:
        shutil.rmtree(temp_dir, ignore_errors=True)
