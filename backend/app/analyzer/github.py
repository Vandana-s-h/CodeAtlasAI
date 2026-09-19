from pathlib import Path
import tempfile
import shutil

from urllib.parse import urlparse
import re

from git import Repo

from app.analyzer.parser import parse_python_file
from app.analyzer.dependency import extract_python_dependencies
from app.graph.graph_writer import GraphWriter
from app.git_analysis.commits import analyze_git_history
from app.ml.predictor import predict_risks_for_files


def validate_github_url(url: str) -> tuple[str, str]:
    parts = url.rstrip("/").split("/")

    if len(parts) < 5 or parts[2] != "github.com":
        raise ValueError("Only public GitHub repository URLs are supported.")

    owner = parts[3]
    repo = parts[4].replace(".git", "")

    if not owner or not repo:
        raise ValueError("Invalid GitHub repository URL.")

    return owner, repo


def clone_repository(url: str, destination: str) -> None:
    Repo.clone_from(repo_url, temp_dir)

def scan_repository(repo_path: str) -> dict:
    files = []
    total_loc = 0
    language_counts = {}

    root = Path(repo_path)

    ignored_directories = {
        ".git",
        ".venv",
        "venv",
        "env",
        "node_modules",
        "__pycache__",
        ".mypy_cache",
        ".pytest_cache",
        "dist",
        "build",
        "site-packages",
    }

    supported_extensions = {
        ".py",
        ".js",
        ".ts",
        ".tsx",
        ".jsx",
        ".java",
        ".cpp",
        ".c",
        ".go",
        ".rs",
    }

    for path in root.rglob("*"):
        if not path.is_file():
            continue

        if any(part in ignored_directories for part in path.parts):
            continue

        if path.suffix.lower() not in supported_extensions:
            continue

        # Avoid processing unusually large source files.
        try:
            if path.stat().st_size > 1_000_000:
                continue
        except OSError:
            continue

        try:
            text = path.read_text(encoding="utf-8")
        except (UnicodeDecodeError, OSError):
            continue

        lines = text.splitlines()
        loc = len(lines)
        suffix = path.suffix.lower()

        language = {
            ".py": "Python",
            ".js": "JavaScript",
            ".ts": "TypeScript",
            ".tsx": "TypeScript",
            ".jsx": "JavaScript",
            ".java": "Java",
            ".cpp": "C++",
            ".c": "C",
            ".go": "Go",
            ".rs": "Rust",
        }.get(suffix, "Other")

        file_info = {
            "path": str(path.relative_to(root)),
            "language": language,
            "loc": loc,
            "classes": [],
            "functions": [],
            "imports": [],
            "calls": [],
            "has_syntax_errors": False,
        }

        if suffix == ".py":
            parsed = parse_python_file(str(path))

            file_info["classes"] = parsed["classes"]
            file_info["functions"] = parsed["functions"]
            file_info["imports"] = parsed["imports"]
            file_info["calls"] = parsed["calls"]
            file_info["has_syntax_errors"] = parsed["has_errors"]

        files.append(file_info)

        total_loc += loc
        language_counts[language] = language_counts.get(language, 0) + 1

    dependencies = extract_python_dependencies(files)

    return {
        "files": files,
        "total_files": len(files),
        "total_loc": total_loc,
        "languages": language_counts,
        "dependencies": dependencies,
    }

def write_analysis_to_graph(repository: str, url: str, analysis: dict) -> None:
    writer = GraphWriter()

    writer.create_repository(repository, url)

    for file in analysis["files"]:
        writer.create_file(
            repository=repository,
            file_path=file["path"],
            language=file["language"],
            loc=file["loc"],
        )

        for class_name in file.get("classes", []):
            writer.create_class(
                repository=repository,
                file_path=file["path"],
                class_name=class_name,
            )

        for function_name in file.get("functions", []):
            writer.create_function(
                repository=repository,
                file_path=file["path"],
                function_name=function_name,
            )    

    for dependency in analysis["dependencies"]:
        writer.create_dependency(
            repository=repository,
            source=dependency["source"],
            target=dependency["target"],
        )

def parse_github_url(url: str) -> tuple[str, str]:
    parsed = urlparse(url)

    if parsed.netloc.lower() not in {"github.com", "www.github.com"}:
        raise ValueError("Only GitHub URLs are supported")

    parts = [part for part in parsed.path.split("/") if part]

    if len(parts) < 2:
        raise ValueError("Invalid GitHub repository URL")

    owner = parts[0]
    repo = re.sub(r"\.git$", "", parts[1])

    if not re.fullmatch(r"[A-Za-z0-9_.-]+", owner):
        raise ValueError("Invalid GitHub owner")

    if not re.fullmatch(r"[A-Za-z0-9_.-]+", repo):
        raise ValueError("Invalid GitHub repository name")

    return owner, repo

def analyze_public_repository(
    url: str,
    branch: str | None = None,
) -> dict:
    owner, repo = parse_github_url(url)

    repo_url = f"https://github.com/{owner}/{repo}.git"
    temp_dir = tempfile.mkdtemp()

    try:
        clone_kwargs = {}

        if branch:
           clone_kwargs["branch"] = branch

        Repo.clone_from(repo_url, temp_dir, **clone_kwargs)
        cloned_repo = Repo(temp_dir)


        analysis = scan_repository(temp_dir)

        try:
            
            analysis["git_history"] = analyze_git_history(temp_dir)
            analysis["risk_predictions"] = predict_risks_for_files(
               analysis["git_history"]
)
            
        except Exception as error:
            print("Git history analysis failed:", repr(error))
            analysis["git_history"] = {}

        return {
            "repository": f"{owner}/{repo}",
            "url": url,
            "analysis": analysis,
            "status": "completed",
        }

    finally:
        shutil.rmtree(temp_dir, ignore_errors=True)