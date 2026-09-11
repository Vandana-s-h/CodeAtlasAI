from pathlib import Path


def extract_python_dependencies(files: list[dict]) -> list[dict]:
    python_files = {
        Path(file["path"]).with_suffix("").as_posix().replace("/", "."): file["path"]
        for file in files
        if file.get("language") == "Python"
    }

    dependencies = []

    for file in files:
        if file.get("language") != "Python":
            continue

        source = file["path"]

        for import_statement in file.get("imports", []):
            target_module = None

            if import_statement.startswith("import "):
                target_module = import_statement.replace("import ", "").split(",")[0].strip()

            elif import_statement.startswith("from "):
                target_module = import_statement.split(" import ")[0].replace("from ", "").strip()

            if target_module in python_files:
                dependencies.append({
                    "source": source,
                    "target": python_files[target_module],
                    "import": import_statement,
                })

    return dependencies