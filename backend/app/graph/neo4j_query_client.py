import os

import requests
from dotenv import load_dotenv

load_dotenv()


class Neo4jQueryClient:
    def __init__(self):
        self.url = os.getenv("NEO4J_QUERY_URL")
        self.username = os.getenv("NEO4J_USERNAME")
        self.password = os.getenv("NEO4J_PASSWORD")

        if not self.url:
            raise ValueError("NEO4J_QUERY_URL is not configured.")

        if not self.username or not self.password:
            raise ValueError("Neo4j credentials are not configured.")

    def run_query(self, statement: str, parameters: dict | None = None) -> dict:
        payload = {
            "statement": statement,
            "parameters": parameters or {},
        }

        response = requests.post(
            self.url,
            auth=(self.username, self.password),
            json=payload,
            timeout=120,
        )

        response.raise_for_status()
        return response.json()