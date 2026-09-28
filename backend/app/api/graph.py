from fastapi import APIRouter, HTTPException, Query

from app.graph.neo4j_query_client import Neo4jQueryClient


client = Neo4jQueryClient()


router = APIRouter(
    prefix="/api/graph",
    tags=["Graph"],
)


def build_node_id(
    node_type: str,
    name: str | None,
    path: str | None,
    file_path: str | None,
) -> str:
    """
    Build a unique graph node ID.

    Examples:

        File:
            File:src/requests/api.py

        Class:
            Class:src/requests/api.py:Session

        Function:
            Function:src/requests/api.py:get
    """

    node_type = node_type or "Unknown"

    if node_type == "File":
        identity = (
            path
            or file_path
            or name
            or "unknown"
        )

        return f"File:{identity}"

    if node_type == "Class":
        identity = (
            file_path
            or path
            or "unknown"
        )

        class_name = (
            name
            or "unknown"
        )

        return (
            f"Class:"
            f"{identity}:"
            f"{class_name}"
        )

    if node_type == "Function":
        identity = (
            file_path
            or path
            or "unknown"
        )

        function_name = (
            name
            or "unknown"
        )

        return (
            f"Function:"
            f"{identity}:"
            f"{function_name}"
        )

    identity = (
        path
        or file_path
        or name
        or "unknown"
    )

    return f"{node_type}:{identity}"


def build_node(
    properties: dict,
    labels: list[str] | None,
) -> dict:
    """
    Convert a complete Neo4j node into the API graph format.

    All Neo4j properties are preserved under `properties`.
    """

    labels = labels or []

    node_type = (
        labels[0]
        if labels
        else "Unknown"
    )

    name = properties.get("name")
    path = properties.get("path")
    file_path = properties.get(
        "file_path"
    )

    node_id = build_node_id(
        node_type=node_type,
        name=name,
        path=path,
        file_path=file_path,
    )

    label = (
        name
        or path
        or file_path
        or "Unknown"
    )

    return {
        "id": node_id,
        "label": label,
        "type": node_type,

        # Preserve every property stored
        # on the Neo4j node.
        "properties": properties,
    }


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
        description=(
            "Repository name, for example "
            "octocat/Hello-World"
        ),
    ),
    limit: int = Query(
        100,
        ge=1,
        le=1000,
        description=(
            "Maximum number of relationships "
            "to return"
        ),
    ),
    offset: int = Query(
        0,
        ge=0,
        description=(
            "Number of relationships to skip"
        ),
    ),
):
    try:
        query = """
        MATCH (source)-[rel]->(target)

        WHERE source.repository = $repository
          AND target.repository = $repository

        RETURN
            properties(source) AS source_properties,
            labels(source) AS source_labels,

            type(rel) AS relationship,

            properties(target) AS target_properties,
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

        records = (
            result
            .get("data", {})
            .get("values", [])
        )

        for row in records:
            (
                source_properties,
                source_labels,
                relationship,
                target_properties,
                target_labels,
            ) = row

            source_properties = (
                source_properties
                or {}
            )

            target_properties = (
                target_properties
                or {}
            )

            source_labels = (
                source_labels
                or []
            )

            target_labels = (
                target_labels
                or []
            )

            # ==========================================
            # SOURCE NODE
            # ==========================================

            source_node = build_node(
                properties=source_properties,
                labels=source_labels,
            )

            source_id = source_node["id"]

            # ==========================================
            # TARGET NODE
            # ==========================================

            target_node = build_node(
                properties=target_properties,
                labels=target_labels,
            )

            target_id = target_node["id"]

            if not source_id or not target_id:
                continue

            nodes[source_id] = source_node
            nodes[target_id] = target_node

            # ==========================================
            # RELATIONSHIP
            # ==========================================

            edges.append(
                {
                    "id": (
                        f"{source_id}"
                        f"->{target_id}"
                        f":{relationship}"
                        f":{len(edges)}"
                    ),
                    "source": source_id,
                    "target": target_id,
                    "relationship": relationship,
                }
            )

        return {
            "repository": repository,
            "limit": limit,
            "offset": offset,
            "node_count": len(nodes),
            "relationship_count": len(edges),
            "nodes": list(nodes.values()),
            "edges": edges,
        }

    except Exception as error:
        raise HTTPException(
            status_code=500,
            detail=str(error),
        )


@router.get("/summary")
def get_graph_summary(
    repository: str = Query(...)
):
    query = """
    MATCH (r:Repository {name: $repository})

    OPTIONAL MATCH
        (r)-[:CONTAINS*0..]->(n)

    WITH
        r,
        count(DISTINCT n) AS node_count

    OPTIONAL MATCH
        (source)-[rel]->(target)

    WHERE source.repository = $repository
      AND target.repository = $repository

    RETURN
        node_count,
        count(rel) AS relationship_count
    """

    result = client.run_query(
        query,
        {
            "repository": repository
        },
    )

    data = result.get(
        "data",
        {},
    )

    values = data.get(
        "values",
        [],
    )

    if not values:
        return {
            "repository": repository,
            "node_count": 0,
            "relationship_count": 0,
        }

    row = values[0]

    return {
        "repository": repository,
        "node_count": row[0],
        "relationship_count": row[1],
    }


@router.get("/statistics")
def get_graph_statistics(
    repository: str = Query(...)
):
    node_query = """
    MATCH (n)

    WHERE n.repository = $repository

    UNWIND labels(n) AS label

    RETURN
        label,
        count(*) AS count

    ORDER BY label
    """

    relationship_query = """
    MATCH (source)-[rel]->(target)

    WHERE source.repository = $repository
      AND target.repository = $repository

    RETURN
        type(rel) AS relationship_type,
        count(*) AS count

    ORDER BY relationship_type
    """

    node_result = client.run_query(
        node_query,
        {
            "repository": repository
        },
    )

    relationship_result = client.run_query(
        relationship_query,
        {
            "repository": repository
        },
    )

    node_values = (
        node_result
        .get("data", {})
        .get("values", [])
    )

    relationship_values = (
        relationship_result
        .get("data", {})
        .get("values", [])
    )

    return {
        "repository": repository,

        "nodes": {
            row[0]: row[1]
            for row in node_values
        },

        "relationships": {
            row[0]: row[1]
            for row in relationship_values
        },
    }