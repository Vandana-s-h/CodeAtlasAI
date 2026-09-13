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
    repository: str = Query(
        ...,
        description="Repository name, for example octocat/Hello-World",
    ),
    limit: int = Query(
        100,
        ge=1,
        le=1000,
        description="Maximum number of relationships to return",
    ),
    offset: int = Query(
        0,
        ge=0,
        description="Number of relationships to skip",
    ),
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
            source.file_path AS source_file_path,
            source.risk AS source_risk,
            source.risk_label AS source_risk_label,
            source.risk_confidence AS source_risk_confidence,
            labels(source) AS source_labels,

            type(rel) AS relationship,

            target.name AS target_name,
            target.path AS target_path,
            target.file_path AS target_file_path,
            target.risk AS target_risk,
            target.risk_label AS target_risk_label,
            target.risk_confidence AS target_risk_confidence,
            labels(target) AS target_labels

        SKIP $offset
        LIMIT $limit
        """

        result = client.run_query(
            query,
            {
                "repository": repository,
                "offset": offset,
                "limit": limit,
            },
        )

        nodes = {}
        edges = []

        records = result.get("data", {}).get("values", [])

        for row in records:
            (
                source_name,
                source_path,
                source_file_path,
                source_risk,
                source_risk_label,
                source_risk_confidence,
                source_labels,
                relationship,
                target_name,
                target_path,
                target_file_path,
                target_risk,
                target_risk_label,
                target_risk_confidence,
                target_labels,
            ) = row

            source_id = (
                source_path
                or source_file_path
                or source_name
            )

            target_id = (
                target_path
                or target_file_path
                or target_name
            )

            if not source_id or not target_id:
                continue

            source_node = {
                "id": source_id,
                "label": source_name or source_path or source_file_path,
                "type": source_labels[0] if source_labels else "Unknown",
            }

            target_node = {
                "id": target_id,
                "label": target_name or target_path or target_file_path,
                "type": target_labels[0] if target_labels else "Unknown",
            }

            if source_risk is not None:
                source_node["risk"] = source_risk

            if source_risk_label is not None:
                source_node["risk_label"] = source_risk_label

            if source_risk_confidence is not None:
                source_node["risk_confidence"] = source_risk_confidence

            if target_risk is not None:
                target_node["risk"] = target_risk

            if target_risk_label is not None:
                target_node["risk_label"] = target_risk_label

            if target_risk_confidence is not None:
                target_node["risk_confidence"] = target_risk_confidence

            nodes[source_id] = source_node
            nodes[target_id] = target_node

            edges.append(
                {
                    "source": source_id,
                    "target": target_id,
                    "relationship": relationship,
                }
            )

        return {
            "repository": repository,
            "limit": limit,
            "offset": offset,
            "nodes": list(nodes.values()),
            "edges": edges,
        }

    except Exception as error:
        raise HTTPException(
            status_code=500,
            detail=str(error),
        )