from backend.app.graph.neo4j_query_client import Neo4jQueryClient


class GraphWriter:
    def __init__(self):
        self.client = Neo4jQueryClient()

    def create_repository(self, repository: str, url: str) -> dict:
        query = """
        MERGE (r:Repository {name: $repository})
        SET r.url = $url
        RETURN r
        """

        return self.client.run_query(
            query,
            {
                "repository": repository,
                "url": url,
            },
        )

    def create_file(
        self,
        repository: str,
        file_path: str,
        language: str,
        loc: int,
    ) -> dict:
        query = """
        MATCH (r:Repository {name: $repository})
        MERGE (f:File {path: $file_path, repository: $repository})
        SET f.language = $language,
            f.loc = $loc
        MERGE (r)-[:CONTAINS]->(f)
        RETURN f
        """

        return self.client.run_query(
            query,
            {
                "repository": repository,
                "file_path": file_path,
                "language": language,
                "loc": loc,
            },
        )

    def create_dependency(
        self,
        repository: str,
        source: str,
        target: str,
    ) -> dict:
        query = """
        MATCH (source:File {
            path: $source,
            repository: $repository
        })
        MATCH (target:File {
            path: $target,
            repository: $repository
        })
        MERGE (source)-[:IMPORTS]->(target)
        RETURN source, target
        """

        return self.client.run_query(
            query,
            {
                "repository": repository,
                "source": source,
                "target": target,
            },
        )

    def create_function_call(
        self,
        repository: str,
        source_file: str,
        source_function: str,
        target_function: str,
    ) -> dict:
        query = """
        MATCH (source:Function {
            name: $source_function,
            file_path: $source_file,
            repository: $repository
        })
        MATCH (target:Function {
            name: $target_function,
            repository: $repository
        })
        MERGE (source)-[:CALLS]->(target)
        RETURN source, target
        """

        return self.client.run_query(
            query,
            {
                "repository": repository,
                "source_file": source_file,
                "source_function": source_function,
                "target_function": target_function,
            },
        )
    def create_class(
        self,
        repository: str,
        file_path: str,
        class_name: str,
    ) -> dict:
        query = """
        MATCH (f:File {
            path: $file_path,
            repository: $repository
        })
        MERGE (c:Class {
            name: $class_name,
            file_path: $file_path,
            repository: $repository
        })
        MERGE (f)-[:CONTAINS]->(c)
        RETURN c
        """

        return self.client.run_query(
            query,
            {
                "repository": repository,
                "file_path": file_path,
                "class_name": class_name,
            },
        )

    def create_function(
        self,
        repository: str,
        file_path: str,
        function_name: str,
    ) -> dict:
        query = """
        MATCH (f:File {
            path: $file_path,
            repository: $repository
        })
        MERGE (fn:Function {
            name: $function_name,
            file_path: $file_path,
            repository: $repository
        })
        MERGE (f)-[:CONTAINS]->(fn)
        RETURN fn
        """

        return self.client.run_query(
            query,
            {
                "repository": repository,
                "file_path": file_path,
                "function_name": function_name,
            },
        )    

def write_analysis_to_graph(analysis: dict) -> dict:
    writer = GraphWriter()

    repository = analysis["repository"]
    url = analysis["url"]

    data = analysis.get("analysis", analysis)

    writer.create_repository(repository, url)

    for file_data in data.get("files", []):
        for call in file_data.get("calls", []):
            source_function = call.get("source_function")
            target_function = call.get("target_function")

            # Skip calls made outside a function
            if not source_function or not target_function:
                continue

            # Keep only the final name from calls like helpers.get_answer
            target_function = target_function.split(".")[-1]

            writer.create_function_call(
                repository,
                file_path,
                source_function,
                target_function,
            )
        file_path = file_data["path"]
        language = file_data.get("language", "unknown")
        loc = file_data.get("loc", 0)

        writer.create_file(
            repository=repository,
            file_path=file_path,
            language=language,
            loc=loc,
        )

        for class_name in file_data.get("classes", []):
            writer.create_class(
                repository=repository,
                file_path=file_path,
                class_name=class_name,
            )

        for function_name in file_data.get("functions", []):
            writer.create_function(
                repository=repository,
                file_path=file_path,
                function_name=function_name,
            )

       

    for dependency in data.get("dependencies", []):
        writer.create_dependency(
            repository=repository,
            source=dependency["source"],
            target=dependency["target"],
        )

    return {
        "repository": repository,
        "status": "graph_written",
    }