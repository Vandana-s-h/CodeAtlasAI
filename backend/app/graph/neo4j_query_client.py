import os

from dotenv import load_dotenv
from neo4j import GraphDatabase

load_dotenv()


class Neo4jQueryClient:
    def __init__(self):
        uri = os.getenv("NEO4J_URI")
        username = os.getenv("NEO4J_USERNAME")
        password = os.getenv("NEO4J_PASSWORD")

        if not uri:
            raise ValueError("NEO4J_URI is not configured.")

        if not username or not password:
            raise ValueError("Neo4j credentials are not configured.")

        self.driver = GraphDatabase.driver(
            uri,
            auth=(username, password),
        )

    def run_query(
        self,
        statement: str,
        parameters: dict | None = None,
    ) -> dict:
        with self.driver.session() as session:
            result = session.run(
                statement,
                parameters or {},
            )

            records = result.data()

        columns = []
        if records:
            columns = list(records[0].keys())

        values = [
            [record.get(column) for column in columns]
            for record in records
        ]

        return {
            "data": {
                "fields": columns,
                "values": values,
            }
        }

    def close(self):
        self.driver.close()