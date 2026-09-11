from pathlib import Path


def extract_python_dependencies(files: list[dict]) -> list[dict]:
    dependencies = []

    for file in files:
        if file.get("language") != "Python":
            continue

        source_path = Path(file["path"])

        for import_statement in file.get("imports", []):
            dependencies.append({
                "source": str(source_path),
                "import": import_statement,
            })

    return dependencies