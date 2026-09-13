import os

from dotenv import load_dotenv
from neo4j import GraphDatabase

load_dotenv()

NEO4J_URI = os.getenv("NEO4J_URI")
NEO4J_USERNAME = os.getenv("NEO4J_USERNAME")
NEO4J_PASSWORD = os.getenv("NEO4J_PASSWORD")

if not NEO4J_URI:
    raise RuntimeError("NEO4J_URI is not set")

if not NEO4J_USERNAME:
    raise RuntimeError("NEO4J_USERNAME is not set")

if not NEO4J_PASSWORD:
    raise RuntimeError("NEO4J_PASSWORD is not set")


driver = GraphDatabase.driver(
    NEO4J_URI,
    auth=(NEO4J_USERNAME, NEO4J_PASSWORD),
)


def close_driver():
    driver.close()


def create_repository_node(owner: str, name: str, url: str):
    query = """
    MERGE (r:Repository {url: $url})
    SET r.owner = $owner,
        r.name = $name
    RETURN r
    """

    with driver.session() as session:
        result = session.run(
            query,
            owner=owner,
            name=name,
            url=url,
        )
        return result.single()[0]


def create_file_nodes(repository_url: str, files: list[dict]):
    query = """
    MATCH (r:Repository {url: $repository_url})
    UNWIND $files AS file
    MERGE (f:File {
        path: file.path,
        repository_url: $repository_url
    })
    SET f.language = file.language,
        f.loc = file.loc
    MERGE (r)-[:CONTAINS]->(f)
    """

    with driver.session() as session:
        session.run(
            query,
            repository_url=repository_url,
            files=files,
        )