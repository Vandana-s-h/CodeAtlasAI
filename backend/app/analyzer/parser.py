from pathlib import Path

from tree_sitter import Language, Parser
import tree_sitter_python


PYTHON_LANGUAGE = Language(tree_sitter_python.language())


def parse_python_file(file_path: str) -> dict:
    path = Path(file_path)
    source = path.read_bytes()

    parser = Parser(PYTHON_LANGUAGE)
    tree = parser.parse(source)
    root = tree.root_node

    classes = []
    functions = []
    imports = []

    def walk(node):
        if node.type == "class_definition":
            name_node = node.child_by_field_name("name")
            if name_node:
                classes.append(name_node.text.decode("utf-8"))

        elif node.type in ("function_definition", "async_function_definition"):
            name_node = node.child_by_field_name("name")
            if name_node:
                functions.append(name_node.text.decode("utf-8"))

        elif node.type == "import_statement":
            imports.append(node.text.decode("utf-8"))

        elif node.type == "import_from_statement":
            imports.append(node.text.decode("utf-8"))

        for child in node.children:
            walk(child)

    walk(root)

    return {
        "file": str(path),
        "classes": classes,
        "functions": functions,
        "imports": imports,
        "has_errors": root.has_error,
    }