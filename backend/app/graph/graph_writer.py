from backend.app.graph.neo4j_query_client import Neo4jQueryClient


BATCH_SIZE = 50


class GraphWriter:
    def __init__(self):
        self.client = Neo4jQueryClient()

    def _run_batches(
        self,
        query: str,
        items: list[dict],
        repository: str,
    ) -> None:
        for start in range(0, len(items), BATCH_SIZE):
            batch = items[start:start + BATCH_SIZE]

            if not batch:
                continue

            self.client.run_query(
                query,
                {
                    "repository": repository,
                    "items": batch,
                },
            )

    def write_analysis(self, analysis: dict) -> dict:
        repository = analysis["repository"]
        url = analysis["url"]

        data = analysis.get("analysis", analysis)
        risk_predictions = analysis.get("risk_predictions", {})

        files = []
        classes = []
        functions = []
        calls = []
        dependencies = []

        for file_data in data.get("files", []):
            file_path = file_data["path"]
            risk_data = risk_predictions.get(file_path, {})

            files.append(
                {
                    "path": file_path,
                    "language": file_data.get("language", "unknown"),
                    "loc": file_data.get("loc", 0),
                    "risk_label": risk_data.get("risk_label"),
                    "risk": risk_data.get("risk"),
                    "confidence": risk_data.get("confidence"),
                }
            )

            for class_name in file_data.get("classes", []):
                classes.append(
                    {
                        "file_path": file_path,
                        "name": class_name,
                    }
                )

            for function_name in file_data.get("functions", []):
                functions.append(
                    {
                        "file_path": file_path,
                        "name": function_name,
                    }
                )

            for call in file_data.get("calls", []):
                source_function = call.get("source_function")
                target_function = call.get("target_function")

                if source_function and target_function:
                    calls.append(
                        {
                            "source_file": file_path,
                            "source_function": source_function,
                            "target_function": target_function.split(".")[-1],
                        }
                    )

        for dependency in data.get("dependencies", []):
            dependencies.append(
                {
                    "source": dependency["source"],
                    "target": dependency["target"],
                }
            )

        self.client.run_query(
            """
            MERGE (r:Repository {name: $repository})
            SET r.url = $url
            """,
            {
                "repository": repository,
                "url": url,
            },
        )

        self._run_batches(
            """
            UNWIND $items AS item
            MATCH (r:Repository {name: $repository})
            MERGE (f:File {
                path: item.path,
                repository: $repository
            })
            SET f.language = item.language,
                f.loc = item.loc,
                f.risk_label = item.risk_label,
                f.risk = item.risk,
                f.risk_confidence = item.confidence
            MERGE (r)-[:CONTAINS]->(f)
            """,
            files,
            repository,
        )

        self._run_batches(
            """
            UNWIND $items AS item
            MATCH (f:File {
                path: item.file_path,
                repository: $repository
            })
            MERGE (c:Class {
                name: item.name,
                file_path: item.file_path,
                repository: $repository
            })
            MERGE (f)-[:CONTAINS]->(c)
            """,
            classes,
            repository,
        )

        self._run_batches(
            """
            UNWIND $items AS item
            MATCH (f:File {
                path: item.file_path,
                repository: $repository
            })
            MERGE (fn:Function {
                name: item.name,
                file_path: item.file_path,
                repository: $repository
            })
            MERGE (f)-[:CONTAINS]->(fn)
            """,
            functions,
            repository,
        )

        self._run_batches(
            """
            UNWIND $items AS item
            MATCH (source:Function {
                name: item.source_function,
                file_path: item.source_file,
                repository: $repository
            })
            MATCH (target:Function {
                name: item.target_function,
                repository: $repository
            })
            MERGE (source)-[:CALLS]->(target)
            """,
            calls,
            repository,
        )

        self._run_batches(
            """
            UNWIND $items AS item
            MATCH (source:File {
                path: item.source,
                repository: $repository
            })
            MATCH (target:File {
                path: item.target,
                repository: $repository
            })
            MERGE (source)-[:IMPORTS]->(target)
            """,
            dependencies,
            repository,
        )

        return {
            "repository": repository,
            "status": "graph_written",
            "files_written": len(files),
            "classes_written": len(classes),
            "functions_written": len(functions),
            "calls_written": len(calls),
            "dependencies_written": len(dependencies),
        }


def write_analysis_to_graph(analysis: dict) -> dict:
    writer = GraphWriter()
    return writer.write_analysis(analysis)