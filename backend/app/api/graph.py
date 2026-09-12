from fastapi import APIRouter, HTTPException

from backend.app.graph.neo4j_query_client import Neo4jQueryClient


router = APIRouter(
    prefix="/api/graph",
    tags=["Graph"],
)


@router.get("/status")
def graph_status():
    return {
        "service": "dependency-graph",
        "status": "ready",
    }


@router.get("/{repository}")
def get_repository_graph(repository: str):
    try:
        client = Neo4jQueryClient()

        query = """
        MATCH (r:Repository {name: $repository})-[rel]->(target)
        RETURN
            labels(r) AS source_labels,
            r AS source,
            type(rel) AS relationship,
            labels(target) AS target_labels,
            target
        """

        result = client.run_query(
            query,
            {"repository": repository},
        )

        return {
            "repository": repository,
            "graph": result,
        }

    except Exception as error:
        raise HTTPException(
            status_code=500,
            detail=str(error),
        )