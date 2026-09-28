import {
  useMemo,
  useState,
  type MouseEvent,
} from "react";
import { createRoot } from "react-dom/client";

import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  type Edge,
  type Node,
} from "@xyflow/react";

import "@xyflow/react/dist/style.css";
import "./styles.css";

type FileInfo = {
  path: string;
  language: string;
  loc: number;
};

type Analysis = {
  files?: FileInfo[];
  file_count?: number;
  loc?: number;
  languages?: Record<string, number>;
};

type AnalysisResult = {
  repository?: string;
  url?: string;
  analysis?: Analysis;
  status?: string;
  repository_id?: number;
};

type GraphNode = {
  id: string;
  label: string;
  type: string;

  name?: string;
  path?: string;
  file_path?: string;

  language?: string;
  loc?: number;

  repository?: string;

  risk?: number | string;
  risk_label?: string;
  risk_confidence?: number | string;

  // Complete Neo4j node properties.
  properties?: Record<string, unknown>;
};

type GraphEdge = {
  id?: string;
  source: string;
  target: string;
  relationship: string;
};

const EMPTY_RESULT: AnalysisResult = {
  repository: "",
  url: "",
  analysis: {
    files: [],
    file_count: 0,
    loc: 0,
    languages: {},
  },
};

function formatNumber(
  value: number | undefined
): string {
  return Number(value || 0).toLocaleString();
}

function normalizePath(
  value: unknown
): string {
  return typeof value === "string"
    ? value
    : "";
}

function isTestFile(
  path: string
): boolean {
  const lower = path.toLowerCase();

  return (
    lower.includes("test") ||
    lower.includes("tests") ||
    lower.includes("__tests__")
  );
}

function getFileSymbol(
  language: string
): string {
  const normalized =
    language.toLowerCase();

  if (normalized.includes("python")) {
    return "🐍";
  }

  if (
    normalized.includes("javascript")
  ) {
    return "🟨";
  }

  if (
    normalized.includes("typescript")
  ) {
    return "🔷";
  }

  if (normalized.includes("java")) {
    return "☕";
  }

  if (normalized.includes("c++")) {
    return "⚙️";
  }

  if (normalized.includes("c#")) {
    return "🔷";
  }

  if (normalized.includes("go")) {
    return "🐹";
  }

  if (normalized.includes("rust")) {
    return "🦀";
  }

  return "📄";
}

function normalizeGraphType(
  type: string
): "File" | "Class" | "Function" | "Unknown" {
  const normalized =
    type.toLowerCase();

  if (normalized === "file") {
    return "File";
  }

  if (normalized === "class") {
    return "Class";
  }

  if (normalized === "function") {
    return "Function";
  }

  return "Unknown";
}

function formatGraphPropertyValue(
  value: unknown
): string {
  if (value === null || value === undefined) {
    return "—";
  }

  if (typeof value === "string") {
    return value;
  }

  if (
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return String(value);
  }

  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function getNodeColor(
  type: string
): string {
  switch (
    normalizeGraphType(type)
  ) {
    case "File":
      return "#a78bfa";

    case "Class":
      return "#38bdf8";

    case "Function":
      return "#34d399";

    default:
      return "#94a3b8";
  }
}

function getRelationshipColor(
  relationship: string
): string {
  switch (relationship) {
    case "CALLS":
      return "#34d399";

    case "IMPORTS":
      return "#a78bfa";

    case "CONTAINS":
      return "#38bdf8";

    default:
      return "#64748b";
  }
}

function Stat({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div className="stat">
      <span className="stat-label">
        {label}
      </span>

      <strong>{value}</strong>
    </div>
  );
}

function OverviewMetric({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div className="overview-metric">
      <span>{label}</span>

      <strong>{value}</strong>
    </div>
  );
}

function FutureFeature({
  number,
  title,
  description,
}: {
  number: string;
  title: string;
  description: string;
}) {
  return (
    <div className="future-feature">
      <div className="future-number">
        {number}
      </div>

      <h4>{title}</h4>

      <p>{description}</p>
    </div>
  );
}

function Step({
  number,
  title,
  description,
}: {
  number: string;
  title: string;
  description: string;
}) {
  return (
    <div className="step">
      <div className="step-number">
        {number}
      </div>

      <div>
        <h4>{title}</h4>

        <p>{description}</p>
      </div>
    </div>
  );
}

function App() {
  const [repoUrl, setRepoUrl] =
    useState(
      "https://github.com/psf/requests"
    );

  const [branch, setBranch] =
    useState("");

  const [result, setResult] =
    useState<AnalysisResult>(
      EMPTY_RESULT
    );

  const [loading, setLoading] =
    useState(false);

  const [error, setError] =
    useState("");

  const [activeTab, setActiveTab] =
    useState<
      "overview" | "explorer" | "graph"
    >("overview");

  const [search, setSearch] =
    useState("");

  const [languageFilter, setLanguageFilter] =
    useState("all");

  const [sortBy, setSortBy] =
    useState<"path" | "loc">(
      "path"
    );

  const [selectedFile, setSelectedFile] =
    useState<FileInfo | null>(
      null
    );

  /*
   * ================================
   * GRAPH STATE
   * ================================
   */

  const [graphLoading, setGraphLoading] =
    useState(false);

  const [graphError, setGraphError] =
    useState("");

  const [graphNodes, setGraphNodes] =
    useState<GraphNode[]>([]);

  const [graphEdges, setGraphEdges] =
    useState<GraphEdge[]>([]);

  const [graphFilter, setGraphFilter] =
    useState("all");

  const [graphSearch, setGraphSearch] =
    useState("");

  const [
    relationshipFilter,
    setRelationshipFilter,
  ] = useState("all");

  const [
    selectedGraphNodeId,
    setSelectedGraphNodeId,
  ] = useState<string | null>(
    null
  );

  const [
    focusSelection,
    setFocusSelection,
  ] = useState(false);

  /*
   * ================================
   * REPOSITORY ANALYSIS
   * ================================
   */

  const analyzeRepository =
    async () => {
      if (!repoUrl.trim()) {
        setError(
          "Please enter a GitHub repository URL."
        );

        return;
      }

      setLoading(true);
      setError("");

      setSelectedFile(null);

      setGraphNodes([]);
      setGraphEdges([]);

      setSelectedGraphNodeId(
        null
      );

      setFocusSelection(false);

      setGraphError("");

      try {
        const response =
          await fetch(
            "http://127.0.0.1:8000/api/repositories/analyze",
            {
              method: "POST",

              headers: {
                "Content-Type":
                  "application/json",
              },

              body: JSON.stringify({
                url: repoUrl.trim(),

                branch:
                  branch.trim() ||
                  undefined,
              }),
            }
          );

        if (!response.ok) {
          const text =
            await response.text();

          throw new Error(
            text ||
              `Request failed with ${response.status}`
          );
        }

        const data =
          await response.json();

        const rawFiles =
          data?.analysis?.files ??
          data?.files ??
          [];

        const normalizedFiles: FileInfo[] =
          Array.isArray(rawFiles)
            ? rawFiles
                .map(
                  (file: any) => ({
                    path: normalizePath(
                      file?.path
                    ),

                    language:
                      typeof file?.language ===
                      "string"
                        ? file.language
                        : "unknown",

                    loc: Number(
                      file?.loc || 0
                    ),
                  })
                )

                .filter(
                  (file: FileInfo) =>
                    file.path.length >
                    0
                )
            : [];

        const normalizedResult:
          AnalysisResult = {
          repository:
            typeof data?.repository ===
            "string"
              ? data.repository
              : "",

          url:
            typeof data?.url ===
            "string"
              ? data.url
              : repoUrl.trim(),

          status: data?.status,

          repository_id:
            data?.repository_id,

          analysis: {
            ...data?.analysis,

            files:
              normalizedFiles,

            file_count: Number(
              data?.analysis
                ?.file_count ??
                normalizedFiles.length
            ),

            loc: Number(
              data?.analysis?.loc ??
                normalizedFiles.reduce(
                  (
                    sum,
                    file
                  ) =>
                    sum + file.loc,
                  0
                )
            ),

            languages:
              data?.analysis
                ?.languages ?? {},
          },
        };

        setResult(
          normalizedResult
        );

        setActiveTab(
          "overview"
        );
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Failed to analyze repository."
        );
      } finally {
        setLoading(false);
      }
    };

  /*
   * ================================
   * GRAPH LOADING
   * ================================
   */

  const loadGraph = async () => {
    const repository =
      result.repository?.trim();

    if (!repository) {
      setGraphError(
        "Analyze a repository first."
      );

      return;
    }

    setGraphLoading(true);
    setGraphError("");

    try {
      const response =
        await fetch(
          `http://127.0.0.1:8000/api/graph?repository=${encodeURIComponent(
            repository
          )}&limit=1000&offset=0`
        );

      if (!response.ok) {
        const text =
          await response.text();

        throw new Error(
          text ||
            `Graph request failed with ${response.status}`
        );
      }

      const data =
        await response.json();

      const nodes: GraphNode[] =
        Array.isArray(data?.nodes)
          ? data.nodes
              .map(
                (node: any) => ({
                  id: String(
                    node?.id ?? ""
                  ),

                  label: String(
                    node?.label ??
                      node?.name ??
                      node?.id ??
                      ""
                  ),

                  type: String(
                    node?.type ??
                      "Unknown"
                  ),

                  name:
                    node?.name != null
                      ? String(
                          node.name
                        )
                      : undefined,

                  path:
                    node?.path != null
                      ? String(
                          node.path
                        )
                      : undefined,

                  file_path:
                    node?.file_path !=
                    null
                      ? String(
                          node.file_path
                        )
                      : undefined,

                  language:
                    node?.language !=
                    null
                      ? String(
                          node.language
                        )
                      : undefined,

                  loc:
                    node?.loc != null
                      ? Number(
                          node.loc
                        )
                      : undefined,

                  repository:
                    node?.repository !=
                    null
                      ? String(
                          node.repository
                        )
                      : repository,

                  risk:
                    node?.risk != null
                      ? node.risk
                      : undefined,

                  risk_label:
                    node?.risk_label !=
                    null
                      ? String(
                          node.risk_label
                        )
                      : undefined,

                  risk_confidence:
                    node?.risk_confidence !=
                    null
                      ? node.risk_confidence
                      : undefined,

                  properties:
                    node?.properties &&
                    typeof node.properties ===
                      "object"
                      ? node.properties
                      : {},
                })
              )

              .filter(
                (node: GraphNode) =>
                  node.id.length >
                  0
              )
          : [];

      const edges: GraphEdge[] =
        Array.isArray(data?.edges)
          ? data.edges
              .map(
                (
                  edge: any,
                  index: number
                ) => ({
                  id:
                    edge?.id ??
                    `${edge?.source}-${edge?.target}-${index}`,

                  source: String(
                    edge?.source ?? ""
                  ),

                  target: String(
                    edge?.target ?? ""
                  ),

                  relationship: String(
                    edge?.relationship ??
                      "RELATED"
                  ),
                })
              )

              .filter(
                (edge: GraphEdge) =>
                  edge.source.length >
                    0 &&
                  edge.target.length >
                    0
              )
          : [];

      setGraphNodes(nodes);
      setGraphEdges(edges);

      setSelectedGraphNodeId(
        null
      );

      setFocusSelection(false);
    } catch (err) {
      setGraphError(
        err instanceof Error
          ? err.message
          : "Failed to load dependency graph."
      );
    } finally {
      setGraphLoading(false);
    }
  };

  /*
   * ================================
   * FILE DATA
   * ================================
   */

  const files = useMemo(() => {
    const rawFiles =
      result.analysis?.files ??
      [];

    let filtered =
      rawFiles.filter(
        (file) => {
          const matchesSearch =
            !search.trim() ||
            file.path
              .toLowerCase()
              .includes(
                search
                  .trim()
                  .toLowerCase()
              );

          const matchesLanguage =
            languageFilter ===
              "all" ||
            file.language
              .toLowerCase() ===
              languageFilter.toLowerCase();

          return (
            matchesSearch &&
            matchesLanguage
          );
        }
      );

    filtered = [
      ...filtered,
    ].sort((a, b) => {
      if (sortBy === "loc") {
        return b.loc - a.loc;
      }

      return a.path.localeCompare(
        b.path
      );
    });

    return filtered;
  }, [
    result.analysis?.files,
    search,
    languageFilter,
    sortBy,
  ]);

  const languages = useMemo(() => {
    const source =
      result.analysis?.languages ??
      {};

    if (
      Object.keys(source).length >
      0
    ) {
      return source;
    }

    const counts: Record<
      string,
      number
    > = {};

    for (const file of
      result.analysis?.files ??
      []) {
      counts[file.language] =
        (counts[file.language] ||
          0) + 1;
    }

    return counts;
  }, [
    result.analysis?.languages,
    result.analysis?.files,
  ]);

  const testFiles = useMemo(
    () =>
      (
        result.analysis?.files ??
        []
      ).filter((file) =>
        isTestFile(file.path)
      ),
    [result.analysis?.files]
  );

  const testLoc = useMemo(
    () =>
      testFiles.reduce(
        (sum, file) =>
          sum + file.loc,
        0
      ),
    [testFiles]
  );

  const largestFile = useMemo(
    () => {
      const allFiles =
        result.analysis?.files ??
        [];

      if (
        allFiles.length === 0
      ) {
        return null;
      }

      return [
        ...allFiles,
      ].sort(
        (a, b) => b.loc - a.loc
      )[0];
    },
    [result.analysis?.files]
  );

  const languageOptions =
    useMemo(
      () =>
        Object.keys(
          languages
        ).sort((a, b) =>
          a.localeCompare(b)
        ),
      [languages]
    );

  /*
   * ================================
   * GRAPH LOOKUPS
   * ================================
   */

  const graphNodeMap = useMemo(
    () => {
      const map =
        new Map<
          string,
          GraphNode
        >();

      for (const node of
        graphNodes) {
        map.set(
          node.id,
          node
        );
      }

      return map;
    },
    [graphNodes]
  );

  const selectedGraphNode =
    selectedGraphNodeId
      ? graphNodeMap.get(
          selectedGraphNodeId
        ) ?? null
      : null;

  /*
   * ================================
   * GRAPH FILTERING
   * ================================
   */

  const filteredGraphNodes =
    useMemo(() => {
      return graphNodes.filter(
        (node) => {
          const nodeType =
            normalizeGraphType(
              node.type
            );

          const typeMatches =
            graphFilter ===
              "all" ||
            nodeType ===
              graphFilter;

          const searchMatches =
            !graphSearch.trim() ||
            node.label
              .toLowerCase()
              .includes(
                graphSearch
                  .trim()
                  .toLowerCase()
              ) ||
            node.id
              .toLowerCase()
              .includes(
                graphSearch
                  .trim()
                  .toLowerCase()
              );

          return (
            typeMatches &&
            searchMatches
          );
        }
      );
    }, [
      graphNodes,
      graphFilter,
      graphSearch,
    ]);

  /*
   * ================================
   * GRAPH RELATIONSHIP FILTER
   * ================================
   */

  const relationshipFilteredEdges =
    useMemo(() => {
      return graphEdges.filter(
        (edge) =>
          relationshipFilter ===
            "all" ||
          edge.relationship ===
            relationshipFilter
      );
    }, [
      graphEdges,
      relationshipFilter,
    ]);

  /*
   * ================================
   * FOCUS MODE
   * ================================
   *
   * When a node is selected and Focus
   * Selection is enabled, only the
   * selected node and its immediate
   * Neo4j relationships are displayed.
   */

  const focusNodeIds = useMemo(() => {
    if (
      !selectedGraphNodeId
    ) {
      return new Set<string>();
    }

    const ids =
      new Set<string>();

    ids.add(
      selectedGraphNodeId
    );

    for (const edge of
      relationshipFilteredEdges) {
      if (
        edge.source ===
        selectedGraphNodeId
      ) {
        ids.add(edge.target);
      }

      if (
        edge.target ===
        selectedGraphNodeId
      ) {
        ids.add(edge.source);
      }
    }

    return ids;
  }, [
    selectedGraphNodeId,
    relationshipFilteredEdges,
  ]);

  const displayGraphNodes =
    useMemo(() => {
      if (
        focusSelection &&
        selectedGraphNodeId
      ) {
        return graphNodes.filter(
          (node) =>
            focusNodeIds.has(
              node.id
            )
        );
      }

      return filteredGraphNodes;
    }, [
      graphNodes,
      filteredGraphNodes,
      focusSelection,
      selectedGraphNodeId,
      focusNodeIds,
    ]);

  const displayGraphNodeIds =
    useMemo(
      () =>
        new Set(
          displayGraphNodes.map(
            (node) => node.id
          )
        ),
      [displayGraphNodes]
    );

  const displayGraphEdges =
    useMemo(() => {
      return relationshipFilteredEdges.filter(
        (edge) =>
          displayGraphNodeIds.has(
            edge.source
          ) &&
          displayGraphNodeIds.has(
            edge.target
          )
      );
    }, [
      relationshipFilteredEdges,
      displayGraphNodeIds,
    ]);

  /*
   * ================================
   * REACT FLOW NODES
   * ================================
   */

  const flowNodes: Node[] =
    useMemo(() => {
      const columns = 5;

      return displayGraphNodes.map(
        (node, index) => {
          const column =
            index % columns;

          const row = Math.floor(
            index / columns
          );

          const nodeType =
            normalizeGraphType(
              node.type
            );

          const color =
            getNodeColor(
              node.type
            );

          const isSelected =
            node.id ===
            selectedGraphNodeId;

          const isConnected =
            selectedGraphNodeId
              ? displayGraphEdges.some(
                  (edge) =>
                    edge.source ===
                      node.id ||
                    edge.target ===
                      node.id
                )
              : true;

          const opacity =
            selectedGraphNodeId &&
            !isSelected &&
            !isConnected
              ? 0.3
              : 1;

          return {
            id: node.id,

            position: {
              x:
                column * 270,
              y:
                row * 145,
            },

            draggable: true,

            style: {
              background:
                "transparent",

              border: "none",

              padding: 0,

              width: 190,

              opacity,
            },

            data: {
              type: nodeType,

              label: (
                <div
                  style={{
                    width: 190,
                    minHeight: 86,

                    padding:
                      "12px 14px",

                    border:
                      `1.5px solid ${
                        isSelected
                          ? "#ffffff"
                          : color
                      }`,

                    borderRadius: 12,

                    background:
                      "linear-gradient(145deg, #171a22, #0e1016)",

                    boxShadow:
                      isSelected
                        ? `0 0 0 3px ${color}55, 0 0 28px ${color}55`
                        : `0 0 14px ${color}18`,

                    color: "#edf0f5",

                    textAlign:
                      "left",

                    transition:
                      "all 0.2s ease",
                  }}
                >
                  <div
                    style={{
                      color,

                      fontSize: 9,

                      fontWeight: 800,

                      letterSpacing:
                        "0.12em",

                      textTransform:
                        "uppercase",

                      marginBottom: 6,
                    }}
                  >
                    {nodeType}
                  </div>

                  <div
                    title={
                      node.label
                    }
                    style={{
                      fontSize: 12,

                      fontWeight: 700,

                      whiteSpace:
                        "nowrap",

                      overflow:
                        "hidden",

                      textOverflow:
                        "ellipsis",
                    }}
                  >
                    {node.label}
                  </div>

                  <div
                    title={
                      node.file_path ??
                      node.path ??
                      node.id
                    }
                    style={{
                      marginTop: 6,

                      color:
                        "#697182",

                      fontSize: 9,

                      fontFamily:
                        "Consolas, monospace",

                      whiteSpace:
                        "nowrap",

                      overflow:
                        "hidden",

                      textOverflow:
                        "ellipsis",
                    }}
                  >
                    {node.file_path ??
                      node.path ??
                      node.id}
                  </div>
                </div>
              ),
            },
          };
        }
      );
    }, [
      displayGraphNodes,
      displayGraphEdges,
      selectedGraphNodeId,
    ]);

  /*
   * ================================
   * REACT FLOW EDGES
   * ================================
   */

  const flowEdges: Edge[] =
    useMemo(() => {
      return displayGraphEdges.map(
        (edge, index) => {
          const color =
            getRelationshipColor(
              edge.relationship
            );

          const connectedToSelected =
            selectedGraphNodeId &&
            (edge.source ===
              selectedGraphNodeId ||
              edge.target ===
                selectedGraphNodeId);

          return {
            id:
              edge.id ??
              `${edge.source}-${edge.target}-${index}`,

            source: edge.source,

            target: edge.target,

            label:
              edge.relationship,

            animated:
              edge.relationship ===
                "CALLS" &&
              Boolean(
                connectedToSelected
              ),

            style: {
              stroke: color,

              strokeWidth:
                connectedToSelected
                  ? 3
                  : 1.4,

              opacity:
                selectedGraphNodeId &&
                !connectedToSelected
                  ? 0.18
                  : 0.8,
            },

            labelStyle: {
              fill: color,

              fontSize:
                connectedToSelected
                  ? 10
                  : 8,

              fontWeight: 700,

              opacity:
                selectedGraphNodeId &&
                !connectedToSelected
                  ? 0.25
                  : 0.9,
            },

            labelBgStyle: {
              fill: "#0d1017",

              fillOpacity: 0.92,
            },

            labelBgPadding: [
              4,
              2,
            ] as [
              number,
              number
            ],

            labelBgBorderRadius: 4,
          };
        }
      );
    }, [
      displayGraphEdges,
      selectedGraphNodeId,
    ]);

  /*
   * ================================
   * GRAPH NODE CLICK
   * ================================
   */

  const handleGraphNodeClick =
    (
      _event: MouseEvent,
      node: Node
    ) => {
      setSelectedGraphNodeId(
        node.id
      );
    };

  /*
   * ================================
   * GRAPH PANE CLICK
   * ================================
   */

  const handleGraphPaneClick =
    () => {
      setSelectedGraphNodeId(
        null
      );

      setFocusSelection(false);
    };

  /*
   * ================================
   * NODE RELATIONSHIP COUNTS
   * ================================
   */

  const selectedNodeRelationships =
    useMemo(() => {
      if (
        !selectedGraphNodeId
      ) {
        return {
          incoming: 0,
          outgoing: 0,
        };
      }

      let incoming = 0;
      let outgoing = 0;

      for (const edge of
        graphEdges) {
        if (
          edge.target ===
          selectedGraphNodeId
        ) {
          incoming++;
        }

        if (
          edge.source ===
          selectedGraphNodeId
        ) {
          outgoing++;
        }
      }

      return {
        incoming,
        outgoing,
      };
    }, [
      graphEdges,
      selectedGraphNodeId,
    ]);

  /*
   * ================================
   * UI
   * ================================
   */

  return (
    <div className="app">
      {/* ============================
          TOP BAR
      ============================= */}

      <header className="topbar">
        <div className="brand">
          <div className="brand-mark">
            CA
          </div>

          <div>
            <h1>
              CodeAtlas AI
            </h1>

            <span>
              Map. Understand.
              Predict.
            </span>
          </div>
        </div>

        <div className="topbar-status">
          <span className="status-dot" />

          Repository
          Intelligence
        </div>
      </header>

      <main className="container">
        {/* ==========================
            HERO
        =========================== */}

        <section className="hero">
          <div className="hero-copy">
            <span className="eyebrow">
              AI SOFTWARE ENGINEERING
              PLATFORM
            </span>

            <h2>
              Understand your
              codebase like a map.
            </h2>

            <p>
              Analyze a public GitHub
              repository, explore its
              structure, inspect files,
              and visualize how the
              code is connected.
            </p>
          </div>

          <div className="analyzer-card">
            <label>
              GitHub repository URL
            </label>

            <div className="input-row">
              <input
                value={repoUrl}
                onChange={(
                  event
                ) =>
                  setRepoUrl(
                    event.target
                      .value
                  )
                }
                placeholder="https://github.com/owner/repository"
              />

              <button
                onClick={
                  analyzeRepository
                }
                disabled={loading}
              >
                {loading
                  ? "Analyzing..."
                  : "Analyze"}
              </button>
            </div>

            <div className="branch-row">
              <label>
                Branch
              </label>

              <input
                value={branch}
                onChange={(
                  event
                ) =>
                  setBranch(
                    event.target
                      .value
                  )
                }
                placeholder="Optional — e.g. main"
              />
            </div>

            {error && (
              <div className="error">
                {error}
              </div>
            )}
          </div>
        </section>

        {/* ==========================
            ANALYZED REPOSITORY
        =========================== */}

        {result.repository && (
          <>
            <section className="repo-header">
              <div>
                <span className="eyebrow">
                  ANALYZED REPOSITORY
                </span>

                <h2>
                  {result.repository}
                </h2>

                <p>
                  {result.url}
                </p>
              </div>

              <div className="repo-status">
                <span className="status-dot" />

                Analysis completed
              </div>
            </section>

            {/* ========================
                TABS
            ========================= */}

            <nav className="tabs">
              <button
                className={
                  activeTab ===
                  "overview"
                    ? "active"
                    : ""
                }
                onClick={() =>
                  setActiveTab(
                    "overview"
                  )
                }
              >
                Overview
              </button>

              <button
                className={
                  activeTab ===
                  "explorer"
                    ? "active"
                    : ""
                }
                onClick={() =>
                  setActiveTab(
                    "explorer"
                  )
                }
              >
                Code Explorer
              </button>

              <button
                className={
                  activeTab ===
                  "graph"
                    ? "active"
                    : ""
                }
                onClick={() => {
                  setActiveTab(
                    "graph"
                  );

                  if (
                    graphNodes.length ===
                    0
                  ) {
                    loadGraph();
                  }
                }}
              >
                Dependency Graph
              </button>
            </nav>

            {/* ========================
                OVERVIEW
            ========================= */}

            {activeTab ===
              "overview" && (
              <section>
                <div className="section-heading">
                  <div>
                    <span className="eyebrow">
                      REPOSITORY OVERVIEW
                    </span>

                    <h2>
                      Codebase at a
                      glance
                    </h2>
                  </div>
                </div>

                <div className="metrics-grid">
                  <OverviewMetric
                    label="Files"
                    value={formatNumber(
                      result
                        .analysis
                        ?.file_count
                    )}
                  />

                  <OverviewMetric
                    label="Lines of Code"
                    value={formatNumber(
                      result
                        .analysis?.loc
                    )}
                  />

                  <OverviewMetric
                    label="Languages"
                    value={formatNumber(
                      Object.keys(
                        languages
                      ).length
                    )}
                  />

                  <OverviewMetric
                    label="Test Files"
                    value={formatNumber(
                      testFiles.length
                    )}
                  />
                </div>

                <div className="overview-grid">
                  <div className="panel">
                    <div className="panel-header">
                      <span className="eyebrow">
                        LANGUAGES
                      </span>

                      <h3>
                        Language
                        distribution
                      </h3>
                    </div>

                    <div className="language-list">
                      {Object.entries(
                        languages
                      )
                        .sort(
                          (
                            [, a],
                            [, b]
                          ) =>
                            b - a
                        )
                        .map(
                          ([
                            language,
                            count,
                          ]) => (
                            <div
                              className="language-row"
                              key={
                                language
                              }
                            >
                              <div className="language-name">
                                <span>
                                  {getFileSymbol(
                                    language
                                  )}
                                </span>

                                {
                                  language
                                }
                              </div>

                              <strong>
                                {formatNumber(
                                  count
                                )}
                              </strong>
                            </div>
                          )
                        )}
                    </div>
                  </div>

                  <div className="panel">
                    <div className="panel-header">
                      <span className="eyebrow">
                        TEST COVERAGE
                      </span>

                      <h3>
                        Test code
                      </h3>
                    </div>

                    <div className="stats">
                      <Stat
                        label="Test files"
                        value={formatNumber(
                          testFiles.length
                        )}
                      />

                      <Stat
                        label="Test LOC"
                        value={formatNumber(
                          testLoc
                        )}
                      />

                      <Stat
                        label="Largest file"
                        value={
                          largestFile
                            ?.path ||
                          "—"
                        }
                      />
                    </div>
                  </div>
                </div>

                <div className="section-heading future-heading">
                  <div>
                    <span className="eyebrow">
                      CODE INTELLIGENCE
                    </span>

                    <h2>
                      What CodeAtlas
                      will understand
                    </h2>
                  </div>
                </div>

                <div className="future-grid">
                  <FutureFeature
                    number="01"
                    title="PR Risk Prediction"
                    description="Predict the risk of a pull request using repository history and code-change signals."
                  />

                  <FutureFeature
                    number="02"
                    title="What-if Analysis"
                    description="Explore which parts of the system may be affected before changing a file."
                  />

                  <FutureFeature
                    number="03"
                    title="AI Test Recommendations"
                    description="Recommend tests based on the code being changed and its dependency relationships."
                  />

                  <FutureFeature
                    number="04"
                    title="Hotspot Detection"
                    description="Identify files that combine high change activity with structural complexity."
                  />
                </div>
              </section>
            )}

            {/* ========================
                CODE EXPLORER
            ========================= */}

            {activeTab ===
              "explorer" && (
              <section>
                <div className="section-heading">
                  <div>
                    <span className="eyebrow">
                      CODE EXPLORER
                    </span>

                    <h2>
                      Explore repository
                      files
                    </h2>
                  </div>
                </div>

                <div className="explorer-layout">
                  <div className="panel explorer-panel">
                    <div className="explorer-toolbar">
                      <input
                        value={search}
                        onChange={(
                          event
                        ) =>
                          setSearch(
                            event.target
                              .value
                          )
                        }
                        placeholder="Search files..."
                      />

                      <select
                        value={
                          languageFilter
                        }
                        onChange={(
                          event
                        ) =>
                          setLanguageFilter(
                            event.target
                              .value
                          )
                        }
                      >
                        <option value="all">
                          All languages
                        </option>

                        {languageOptions.map(
                          (
                            language
                          ) => (
                            <option
                              key={
                                language
                              }
                              value={
                                language
                              }
                            >
                              {
                                language
                              }
                            </option>
                          )
                        )}
                      </select>

                      <select
                        value={
                          sortBy
                        }
                        onChange={(
                          event
                        ) =>
                          setSortBy(
                            event.target
                              .value as
                              | "path"
                              | "loc"
                          )
                        }
                      >
                        <option value="path">
                          Sort by path
                        </option>

                        <option value="loc">
                          Sort by LOC
                        </option>
                      </select>
                    </div>

                    <div className="file-list">
                      {files.map(
                        (file) => (
                          <button
                            className={`file-row ${
                              selectedFile?.path ===
                              file.path
                                ? "selected"
                                : ""
                            }`}
                            key={
                              file.path
                            }
                            onClick={() =>
                              setSelectedFile(
                                file
                              )
                            }
                          >
                            <span className="file-icon">
                              {getFileSymbol(
                                file.language
                              )}
                            </span>

                            <span className="file-path">
                              {
                                file.path
                              }
                            </span>

                            <span className="file-language">
                              {
                                file.language
                              }
                            </span>

                            <span className="file-loc">
                              {formatNumber(
                                file.loc
                              )}{" "}
                              LOC
                            </span>
                          </button>
                        )
                      )}

                      {files.length ===
                        0 && (
                        <div className="empty-state">
                          No files match
                          your filters.
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="panel file-details">
                    {selectedFile ? (
                      <>
                        <span className="eyebrow">
                          FILE DETAILS
                        </span>

                        <h3>
                          {
                            selectedFile.path
                          }
                        </h3>

                        <div className="detail-grid">
                          <Stat
                            label="Language"
                            value={
                              selectedFile.language
                            }
                          />

                          <Stat
                            label="Lines of code"
                            value={formatNumber(
                              selectedFile.loc
                            )}
                          />

                          <Stat
                            label="Test file"
                            value={
                              isTestFile(
                                selectedFile.path
                              )
                                ? "Yes"
                                : "No"
                            }
                          />
                        </div>
                      </>
                    ) : (
                      <div className="empty-state">
                        Select a file to
                        inspect its
                        details.
                      </div>
                    )}
                  </div>
                </div>
              </section>
            )}

            {/* ========================
                DEPENDENCY GRAPH
            ========================= */}

            {activeTab ===
              "graph" && (
              <section>
                <div className="section-heading">
                  <div>
                    <span className="eyebrow">
                      NEO4J CODE KNOWLEDGE GRAPH
                    </span>

                    <h2>
                      Dependency Graph
                    </h2>

                    <p>
                      Explore the
                      repository knowledge
                      graph generated from
                      your codebase.
                    </p>
                  </div>

                  <button
                    className="secondary-button"
                    onClick={
                      loadGraph
                    }
                    disabled={
                      graphLoading
                    }
                  >
                    {graphLoading
                      ? "Loading..."
                      : "Refresh Graph"}
                  </button>
                </div>

                {graphError && (
                  <div className="error">
                    {graphError}
                  </div>
                )}

                {/* GRAPH TOOLBAR */}

                <div
                  className="graph-toolbar"
                  style={{
                    display:
                      "grid",

                    gridTemplateColumns:
                      "minmax(260px, 1fr) 160px 160px auto",

                    gap: 10,

                    alignItems:
                      "center",

                    marginBottom: 14,
                  }}
                >
                  <input
                    value={
                      graphSearch
                    }
                    onChange={(
                      event
                    ) =>
                      setGraphSearch(
                        event.target
                          .value
                      )
                    }
                    placeholder="Search files, classes, or functions..."
                  />

                  <select
                    value={
                      graphFilter
                    }
                    onChange={(
                      event
                    ) =>
                      setGraphFilter(
                        event.target
                          .value
                      )
                    }
                  >
                    <option value="all">
                      All node types
                    </option>

                    <option value="File">
                      Files
                    </option>

                    <option value="Class">
                      Classes
                    </option>

                    <option value="Function">
                      Functions
                    </option>
                  </select>

                  <select
                    value={
                      relationshipFilter
                    }
                    onChange={(
                      event
                    ) =>
                      setRelationshipFilter(
                        event.target
                          .value
                      )
                    }
                  >
                    <option value="all">
                      All relationships
                    </option>

                    <option value="CONTAINS">
                      Contains
                    </option>

                    <option value="IMPORTS">
                      Imports
                    </option>

                    <option value="CALLS">
                      Calls
                    </option>
                  </select>

                  <div
                    className="graph-count"
                    style={{
                      whiteSpace:
                        "nowrap",
                    }}
                  >
                    {
                      displayGraphNodes.length
                    }{" "}
                    nodes ·{" "}
                    {
                      displayGraphEdges.length
                    }{" "}
                    relationships
                  </div>
                </div>

                {/* GRAPH ACTION BAR */}

                <div
                  style={{
                    display:
                      "flex",

                    alignItems:
                      "center",

                    justifyContent:
                      "space-between",

                    gap: 12,

                    marginBottom: 12,
                  }}
                >
                  <div
                    style={{
                      display:
                        "flex",

                      gap: 8,

                      alignItems:
                        "center",
                    }}
                  >
                    <span
                      style={{
                        color:
                          "#737a8b",

                        fontSize: 12,
                      }}
                    >
                      Graph source:
                    </span>

                    <span
                      style={{
                        color:
                          "#c7cbd5",

                        fontSize: 12,

                        fontFamily:
                          "Consolas, monospace",
                      }}
                    >
                      Neo4j Aura
                    </span>

                    <span
                      style={{
                        width: 6,
                        height: 6,

                        borderRadius:
                          "50%",

                        background:
                          "#34d399",

                        boxShadow:
                          "0 0 10px #34d399",
                      }}
                    />
                  </div>

                  <div
                    style={{
                      display:
                        "flex",

                      gap: 8,
                    }}
                  >
                    {selectedGraphNode && (
                      <button
                        className="secondary-button"
                        onClick={() =>
                          setFocusSelection(
                            (
                              current
                            ) =>
                              !current
                          )
                        }
                        style={{
                          padding:
                            "9px 14px",

                          fontSize: 12,
                        }}
                      >
                        {focusSelection
                          ? "Show Full Graph"
                          : "Focus Selection"}
                      </button>
                    )}

                    {selectedGraphNode && (
                      <button
                        className="secondary-button"
                        onClick={() => {
                          setSelectedGraphNodeId(
                            null
                          );

                          setFocusSelection(
                            false
                          );
                        }}
                        style={{
                          padding:
                            "9px 14px",

                          fontSize: 12,

                          background:
                            "#171a22",

                          boxShadow:
                            "none",
                        }}
                      >
                        Clear Selection
                      </button>
                    )}
                  </div>
                </div>

                {/* GRAPH + NODE DETAILS */}

                <div
                  style={{
                    display:
                      "grid",

                    gridTemplateColumns:
                      selectedGraphNode
                        ? "minmax(0, 1fr) 340px"
                        : "minmax(0, 1fr)",

                    gap: 14,

                    alignItems:
                      "stretch",
                  }}
                >
                  {/* GRAPH */}

                  <div
                    className="graph-panel"
                    style={{
                      height: 700,

                      minWidth: 0,
                    }}
                  >
                    {graphLoading &&
                      graphNodes.length ===
                        0 && (
                        <div className="graph-loading">
                          Loading Neo4j
                          knowledge
                          graph...
                        </div>
                      )}

                    {!graphLoading &&
                      graphNodes.length ===
                        0 &&
                      !graphError && (
                        <div className="graph-empty">
                          <h3>
                            No graph loaded
                          </h3>

                          <p>
                            Click{" "}
                            <strong>
                              Refresh Graph
                            </strong>{" "}
                            to load the
                            repository
                            knowledge
                            graph.
                          </p>
                        </div>
                      )}

                    {graphNodes.length >
                      0 && (
                      <ReactFlow
                        nodes={
                          flowNodes
                        }
                        edges={
                          flowEdges
                        }
                        fitView
                        fitViewOptions={{
                          padding: 0.18,
                          minZoom: 0.25,
                          maxZoom: 1.2,
                        }}
                        minZoom={0.1}
                        maxZoom={2.5}
                        nodesDraggable
                        nodesConnectable={
                          false
                        }
                        elementsSelectable
                        onNodeClick={
                          handleGraphNodeClick
                        }
                        onPaneClick={
                          handleGraphPaneClick
                        }
                      >
                        <Background
                          gap={22}
                          size={1}
                        />

                        <Controls />

                        <MiniMap
                          pannable
                          zoomable
                          nodeColor={(
                            node
                          ) =>
                            getNodeColor(
                              String(
                                node.data
                                  ?.type ??
                                  "File"
                              )
                            )
                          }
                        />
                      </ReactFlow>
                    )}
                  </div>

                  {/* NODE DETAILS */}

                  {selectedGraphNode && (
                    <aside
                      style={{
                        height: 700,

                        overflowY:
                          "auto",

                        border:
                          "1px solid #272b37",

                        borderRadius: 18,

                        background:
                          "linear-gradient(145deg, #12151b, #0c0e13)",

                        boxShadow:
                          "0 20px 60px rgba(0,0,0,.28)",
                      }}
                    >
                      <div
                        style={{
                          padding:
                            "20px 20px 16px",

                          borderBottom:
                            "1px solid #242833",
                        }}
                      >
                        <div
                          style={{
                            display:
                              "flex",

                            alignItems:
                              "center",

                            justifyContent:
                              "space-between",

                            gap: 10,
                          }}
                        >
                          <div>
                            <div
                              style={{
                                color:
                                  getNodeColor(
                                    selectedGraphNode.type
                                  ),

                                fontSize: 10,

                                fontWeight:
                                  800,

                                letterSpacing:
                                  "0.12em",

                                textTransform:
                                  "uppercase",
                              }}
                            >
                              {normalizeGraphType(
                                selectedGraphNode.type
                              )}
                            </div>

                            <h3
                              style={{
                                margin:
                                  "7px 0 0",

                                color:
                                  "#edf0f5",

                                fontSize: 18,

                                lineHeight:
                                  1.3,

                                wordBreak:
                                  "break-word",
                              }}
                            >
                              {
                                selectedGraphNode.name ??
                                selectedGraphNode.label
                              }
                            </h3>
                          </div>

                          <button
                            onClick={() =>
                              setSelectedGraphNodeId(
                                null
                              )
                            }
                            style={{
                              width: 32,
                              height: 32,

                              border:
                                "1px solid #303542",

                              borderRadius:
                                8,

                              background:
                                "#171a22",

                              color:
                                "#9da4b3",

                              cursor:
                                "pointer",
                            }}
                          >
                            ×
                          </button>
                        </div>
                      </div>

                      <div
                        style={{
                          padding: 20,
                        }}
                      >
                        <div
                          style={{
                            display:
                              "grid",

                            gap: 14,
                          }}
                        >
                          {/* TYPE */}

                          <div>
                            <div
                              style={{
                                color:
                                  "#686f80",

                                fontSize: 10,

                                textTransform:
                                  "uppercase",

                                letterSpacing:
                                  "0.08em",

                                marginBottom:
                                  5,
                              }}
                            >
                              Type
                            </div>

                            <div
                              style={{
                                color:
                                  getNodeColor(
                                    selectedGraphNode.type
                                  ),

                                fontWeight:
                                  700,

                                fontSize: 13,
                              }}
                            >
                              {normalizeGraphType(
                                selectedGraphNode.type
                              )}
                            </div>
                          </div>

                          {/* ID */}

                          <div>
                            <div
                              style={{
                                color:
                                  "#686f80",

                                fontSize: 10,

                                textTransform:
                                  "uppercase",

                                letterSpacing:
                                  "0.08em",

                                marginBottom:
                                  5,
                              }}
                            >
                              Node ID
                            </div>

                            <div
                              style={{
                                color:
                                  "#c9ced8",

                                fontSize: 11,

                                lineHeight:
                                  1.5,

                                fontFamily:
                                  "Consolas, monospace",

                                wordBreak:
                                  "break-all",
                              }}
                            >
                              {
                                selectedGraphNode.id
                              }
                            </div>
                          </div>

                          {/* NEO4J PROPERTIES */}

                          <div
                            style={{
                              paddingTop: 8,

                              borderTop:
                                "1px solid #242833",
                            }}
                          >
                            <div
                              style={{
                                color:
                                  "#686f80",

                                fontSize: 10,

                                textTransform:
                                  "uppercase",

                                letterSpacing:
                                  "0.08em",

                                marginBottom:
                                  12,
                              }}
                            >
                              Neo4j Properties
                            </div>

                            <div
                              style={{
                                display:
                                  "grid",

                                gap: 10,
                              }}
                            >
                              {Object.entries(
                                selectedGraphNode.properties ??
                                {}
                              ).map(
                                ([
                                  propertyName,
                                  propertyValue,
                                ]) => (
                                  <div
                                    key={
                                      propertyName
                                    }
                                    style={{
                                      padding:
                                        "10px 11px",

                                      border:
                                        "1px solid #242833",

                                      borderRadius:
                                        9,

                                      background:
                                        "#0d1016",
                                    }}
                                  >
                                    <div
                                      style={{
                                        color:
                                          "#7d8596",

                                        fontSize:
                                          10,

                                        textTransform:
                                          "uppercase",

                                        letterSpacing:
                                          "0.06em",

                                        marginBottom:
                                          5,
                                      }}
                                    >
                                      {
                                        propertyName
                                      }
                                    </div>

                                    <div
                                      style={{
                                        color:
                                          "#e0e3ea",

                                        fontSize:
                                          12,

                                        lineHeight:
                                          1.5,

                                        fontFamily:
                                          "Consolas, monospace",

                                        whiteSpace:
                                          "pre-wrap",

                                        wordBreak:
                                          "break-word",
                                      }}
                                    >
                                      {formatGraphPropertyValue(
                                        propertyValue
                                      )}
                                    </div>
                                  </div>
                                )
                              )}

                              {Object.keys(
                                selectedGraphNode.properties ??
                                {}
                              ).length === 0 && (
                                <div
                                  style={{
                                    color:
                                      "#747b8b",

                                    fontSize:
                                      12,
                                  }}
                                >
                                  No Neo4j properties
                                  available for this
                                  node.
                                </div>
                              )}
                            </div>
                          </div>

                          {/* RELATIONSHIPS */}

                          <div
                            style={{
                              paddingTop:
                                8,

                              borderTop:
                                "1px solid #242833",
                            }}
                          >
                            <div
                              style={{
                                color:
                                  "#686f80",

                                fontSize: 10,

                                textTransform:
                                  "uppercase",

                                letterSpacing:
                                  "0.08em",

                                marginBottom:
                                  12,
                              }}
                            >
                              Relationships
                            </div>

                            <div
                              style={{
                                display:
                                  "grid",

                                gridTemplateColumns:
                                  "1fr 1fr",

                                gap: 8,
                              }}
                            >
                              <div
                                style={{
                                  padding:
                                    12,

                                  border:
                                    "1px solid #242833",

                                  borderRadius:
                                    9,

                                  background:
                                    "#10131a",
                                }}
                              >
                                <div
                                  style={{
                                    color:
                                      "#687080",

                                    fontSize: 10,
                                  }}
                                >
                                  Incoming
                                </div>

                                <strong
                                  style={{
                                    display:
                                      "block",

                                    marginTop:
                                      4,

                                    fontSize:
                                      18,
                                  }}
                                >
                                  {
                                    selectedNodeRelationships.incoming
                                  }
                                </strong>
                              </div>

                              <div
                                style={{
                                  padding:
                                    12,

                                  border:
                                    "1px solid #242833",

                                  borderRadius:
                                    9,

                                  background:
                                    "#10131a",
                                }}
                              >
                                <div
                                  style={{
                                    color:
                                      "#687080",

                                    fontSize: 10,
                                  }}
                                >
                                  Outgoing
                                </div>

                                <strong
                                  style={{
                                    display:
                                      "block",

                                    marginTop:
                                      4,

                                    fontSize:
                                      18,
                                  }}
                                >
                                  {
                                    selectedNodeRelationships.outgoing
                                  }
                                </strong>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </aside>
                  )}
                </div>

                {/* LEGEND */}

                <div
                  className="graph-legend"
                  style={{
                    display:
                      "flex",

                    flexWrap:
                      "wrap",

                    gap: 18,

                    marginTop: 14,
                  }}
                >
                  <div>
                    <span className="legend-dot file-dot" />

                    File
                  </div>

                  <div>
                    <span className="legend-dot class-dot" />

                    Class
                  </div>

                  <div>
                    <span className="legend-dot function-dot" />

                    Function
                  </div>

                  <div
                    style={{
                      color:
                        "#737a8b",
                    }}
                  >
                    <strong
                      style={{
                        color:
                          "#38bdf8",
                      }}
                    >
                      CONTAINS
                    </strong>

                    {" · "}

                    <strong
                      style={{
                        color:
                          "#a78bfa",
                      }}
                    >
                      IMPORTS
                    </strong>

                    {" · "}

                    <strong
                      style={{
                        color:
                          "#34d399",
                      }}
                    >
                      CALLS
                    </strong>
                  </div>
                </div>
              </section>
            )}
          </>
        )}

        {/* ==========================
            GETTING STARTED
        =========================== */}

        {!result.repository && (
          <section className="getting-started">
            <div className="section-heading">
              <div>
                <span className="eyebrow">
                  GETTING STARTED
                </span>

                <h2>
                  Turn a repository
                  into an intelligent
                  map.
                </h2>
              </div>
            </div>

            <div className="steps">
              <Step
                number="01"
                title="Connect a repository"
                description="Provide a public GitHub repository URL."
              />

              <Step
                number="02"
                title="Analyze the codebase"
                description="CodeAtlas parses files, structure, dependencies, and repository history."
              />

              <Step
                number="03"
                title="Explore the system"
                description="Use the dashboard, code explorer, and dependency graph to understand the codebase."
              />

              <Step
                number="04"
                title="Predict and explain"
                description="AI and ML features will turn repository data into engineering insights."
              />
            </div>
          </section>
        )}
      </main>

      <footer className="footer">
        <span>
          CodeAtlas AI
        </span>

        <span>
          Map. Understand.
          Predict.
        </span>
      </footer>
    </div>
  );
}

createRoot(
  document.getElementById("root")!
).render(<App />);