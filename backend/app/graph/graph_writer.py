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