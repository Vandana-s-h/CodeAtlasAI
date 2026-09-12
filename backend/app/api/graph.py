from fastapi import APIRouter, HTTPException, Query

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



@router.get("")
def get_repository_graph(
    repository: str = Query(..., description="Repository name, for example octocat/Hello-World")
):
    try:
        client = Neo4jQueryClient()

        query = """
        MATCH (source)-[rel]->(target)
        WHERE source.repository = $repository
          AND target.repository = $repository
        RETURN
            source.name AS source_name,
            source.path AS source_path,
            labels(source) AS source_labels,
            type(rel) AS relationship,
            target.name AS target_name,
            target.path AS target_path,
            labels(target) AS target_labels
        """

        result = client.run_query(query, {"repository": repository})
        nodes = {}
        edges = []

        records = result.get("data", {}).get("values", [])

        for row in records:
            (
                source_name,
                source_path,
                source_labels,
                relationship,
                target_name,
                target_path,
                target_labels,
            ) = row

            source_id = source_path or source_name
            target_id = target_path or target_name

            if not source_id or not target_id:
                continue

            nodes[source_id] = {
                "id": source_id,
                "label": source_name or source_path,
                "type": source_labels[0] if source_labels else "Unknown",
            }

            nodes[target_id] = {
                "id": target_id,
                "label": target_name or target_path,
                "type": target_labels[0] if target_labels else "Unknown",
            }

            edges.append({
                "source": source_id,
                "target": target_id,
                "relationship": relationship,
            })

        return {
            "repository": repository,
            "nodes": list(nodes.values()),
            "edges": edges,
        }

    except Exception as error:
        raise HTTPException(status_code=500, detail=str(error))