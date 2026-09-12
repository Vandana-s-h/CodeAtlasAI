import { FormEvent, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";

type Repository = {
  owner: string;
  name: string;
  url: string;
};

type FileInfo = {
  path: string;
  language: string;
  loc: number;
};

type Analysis = {
  file_count: number;
  loc: number;
  languages: Record<string, number>;
  files: FileInfo[];
  files_truncated: boolean;
};

type AnalysisResult = {
  repository: Repository;
  analysis: Analysis;
  status: string;
};

const EMPTY_RESULT: AnalysisResult = {
  repository: {
    owner: "",
    name: "",
    url: "",
  },
  analysis: {
    file_count: 0,
    loc: 0,
    languages: {},
    files: [],
    files_truncated: false,
  },
  status: "",
};

function formatNumber(value: number) {
  return Number(value || 0).toLocaleString();
}

function normalizePath(path: string) {
  return path
    .replace(/\\/g, "/")
    .replace(/^\/+/, "")
    .toLowerCase();
}

function isTestFile(path: string) {
  const normalized = normalizePath(path);
  const parts = normalized.split("/");
  const filename = parts[parts.length - 1] || "";

  /*
   * Count files that are:
   *
   * 1. Inside a test/tests directory
   * 2. Named test_*.*
   * 3. Named *_test.*
   *
   * This avoids incorrectly counting files merely because
   * the word "test" appears somewhere in their path.
   */
  const insideTestDirectory =
    parts.includes("test") ||
    parts.includes("tests") ||
    parts.includes("__tests__");

  const testFilename =
    filename.startsWith("test_") ||
    filename.endsWith("_test.py") ||
    filename.endsWith(".test.js") ||
    filename.endsWith(".test.jsx") ||
    filename.endsWith(".test.ts") ||
    filename.endsWith(".test.tsx") ||
    filename.endsWith(".spec.js") ||
    filename.endsWith(".spec.jsx") ||
    filename.endsWith(".spec.ts") ||
    filename.endsWith(".spec.tsx");

  return insideTestDirectory || testFilename;
}

function App() {
  const [url, setUrl] = useState("");
  const [result, setResult] =
    useState<AnalysisResult>(EMPTY_RESULT);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [search, setSearch] = useState("");
  const [language, setLanguage] = useState("All");
  const [sortBy, setSortBy] = useState<
    "name" | "loc-desc" | "loc-asc"
  >("name");

  const [selectedFile, setSelectedFile] =
    useState<FileInfo | null>(null);

  async function analyzeRepository(
    event: FormEvent
  ) {
    event.preventDefault();

    const repositoryUrl = url.trim();

    if (!repositoryUrl) {
      setError(
        "Please enter a GitHub repository URL."
      );
      return;
    }

    if (
      !/^https?:\/\/(www\.)?github\.com\/[^/]+\/[^/]+\/?$/.test(
        repositoryUrl
      )
    ) {
      setError(
        "Please enter a valid public GitHub repository URL."
      );
      return;
    }

    setLoading(true);
    setError("");
    setSelectedFile(null);

    try {
      const response = await fetch(
        "http://127.0.0.1:8000/api/repositories/analyze",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify({
            url: repositoryUrl,
          }),
        }
      );

      let data: any = null;

      try {
        data = await response.json();
      } catch {
        throw new Error(
          "The backend returned an invalid response."
        );
      }

      if (!response.ok) {
        throw new Error(
          data?.detail ||
            data?.message ||
            "Repository analysis failed."
        );
      }

      const rawFiles = Array.isArray(
        data?.analysis?.files
      )
        ? data.analysis.files
        : [];

      const files: FileInfo[] = rawFiles
        .map((file: unknown) => {
          if (typeof file === "string") {
            return {
              path: file,
              language: "Unknown",
              loc: 0,
            };
          }

          if (
            file &&
            typeof file === "object"
          ) {
            const item =
              file as Record<string, unknown>;

            return {
              path:
                typeof item.path === "string"
                  ? item.path
                  : "",

              language:
                typeof item.language === "string"
                  ? item.language
                  : "Unknown",

              loc:
                typeof item.loc === "number"
                  ? item.loc
                  : Number(item.loc ?? 0),
            };
          }

          return null;
        })
        .filter(
          (file): file is FileInfo =>
            file !== null &&
            file.path.trim().length > 0
        );

      /*
       * Deduplicate files by normalized path.
       * This prevents the same repository file from
       * being counted twice in the frontend.
       */
      const uniqueFiles: FileInfo[] = [];
      const seenPaths = new Set<string>();

      for (const file of files) {
        const normalizedPath =
          normalizePath(file.path);

        if (seenPaths.has(normalizedPath)) {
          continue;
        }

        seenPaths.add(normalizedPath);
        uniqueFiles.push(file);
      }

      const backendLanguages =
        data?.analysis?.languages;

      const languagesData: Record<
        string,
        number
      > =
        backendLanguages &&
        typeof backendLanguages === "object"
          ? Object.fromEntries(
              Object.entries(
                backendLanguages
              ).map(([name, count]) => [
                name,
                Number(count) || 0,
              ])
            )
          : {};

      const normalizedResult: AnalysisResult = {
        repository: {
          owner:
            typeof data?.repository?.owner ===
            "string"
              ? data.repository.owner
              : "",

          name:
            typeof data?.repository?.name ===
            "string"
              ? data.repository.name
              : "",

          url:
            typeof data?.repository?.url ===
            "string"
              ? data.repository.url
              : repositoryUrl,
        },

        analysis: {
          /*
           * Use the backend's repository metric when it
           * exists, otherwise fall back to unique files.
           */
          file_count:
            typeof data?.analysis?.file_count ===
            "number"
              ? data.analysis.file_count
              : uniqueFiles.length,

          loc:
            typeof data?.analysis?.loc ===
            "number"
              ? data.analysis.loc
              : uniqueFiles.reduce(
                  (sum, file) =>
                    sum + file.loc,
                  0
                ),

          languages: languagesData,

          files: uniqueFiles,

          files_truncated: Boolean(
            data?.analysis?.files_truncated
          ),
        },

        status:
          typeof data?.status === "string"
            ? data.status
            : "completed",
      };

      setResult(normalizedResult);

      setSearch("");
      setLanguage("All");
      setSortBy("name");
    } catch (err) {
      console.error(err);

      setError(
        err instanceof Error
          ? err.message
          : "Something went wrong while analyzing the repository."
      );
    } finally {
      setLoading(false);
    }
  }

  /*
   * -------------------------------------------------------
   * DERIVED REPOSITORY METRICS
   * -------------------------------------------------------
   */

  const testFiles = useMemo(() => {
    return result.analysis.files.filter(
      (file) => isTestFile(file.path)
    );
  }, [result.analysis.files]);

  const testLoc = useMemo(() => {
    return testFiles.reduce(
      (sum, file) => sum + file.loc,
      0
    );
  }, [testFiles]);

  const averageFileSize = useMemo(() => {
    if (result.analysis.files.length === 0) {
      return 0;
    }

    return Math.round(
      result.analysis.files.reduce(
        (sum, file) => sum + file.loc,
        0
      ) / result.analysis.files.length
    );
  }, [result.analysis.files]);

  const largestFile = useMemo(() => {
    if (result.analysis.files.length === 0) {
      return null;
    }

    return [...result.analysis.files].sort(
      (a, b) => b.loc - a.loc
    )[0];
  }, [result.analysis.files]);

  const largestFiles = useMemo(() => {
    return [...result.analysis.files]
      .sort((a, b) => b.loc - a.loc)
      .slice(0, 5);
  }, [result.analysis.files]);

  const languageEntries = useMemo(() => {
    return Object.entries(
      result.analysis.languages || {}
    ).sort(
      (a, b) =>
        Number(b[1]) - Number(a[1])
    );
  }, [result.analysis.languages]);

  const languages = useMemo(() => {
    const unique = Array.from(
      new Set(
        result.analysis.files
          .map((file) => file.language)
          .filter(Boolean)
      )
    ).sort();

    return ["All", ...unique];
  }, [result.analysis.files]);

  /*
   * -------------------------------------------------------
   * CODE EXPLORER
   * -------------------------------------------------------
   */

  const filteredFiles = useMemo(() => {
    const query =
      search.toLowerCase().trim();

    const filtered =
      result.analysis.files.filter(
        (file) => {
          const matchesSearch =
            !query ||
            file.path
              .toLowerCase()
              .includes(query);

          const matchesLanguage =
            language === "All" ||
            file.language === language;

          return (
            matchesSearch &&
            matchesLanguage
          );
        }
      );

    return [...filtered].sort(
      (a, b) => {
        if (sortBy === "loc-desc") {
          return b.loc - a.loc;
        }

        if (sortBy === "loc-asc") {
          return a.loc - b.loc;
        }

        return a.path.localeCompare(
          b.path
        );
      }
    );
  }, [
    result.analysis.files,
    search,
    language,
    sortBy,
  ]);

  const isDashboard =
    Boolean(result.repository.name);

  return (
    <div className="app-shell">

      {/* =====================================================
          NAVBAR
      ===================================================== */}

      <header className="navbar">
        <div className="brand">
          <div className="brand-mark">
            C
          </div>

          <div>
            <div className="brand-name">
              CodeAtlas AI
            </div>

            <div className="brand-tagline">
              Map. Understand. Predict.
            </div>
          </div>
        </div>

        <div className="nav-pill">
          <span className="status-dot" />
          Public GitHub repositories
        </div>
      </header>

      <main>

        {/* ===================================================
            LANDING PAGE
        =================================================== */}

        {!isDashboard && (
          <>
            <section className="hero">
              <div className="hero-badge">
                <span>✦</span>
                AI-powered software intelligence
              </div>

              <h1>
                Understand any
                <br />
                <span>codebase.</span>
              </h1>

              <p className="hero-description">
                Analyze a GitHub repository and turn
                its source code into an intelligent map
                of structure, complexity, dependencies,
                and risk.
              </p>

              <form
                className="analyze-box"
                onSubmit={analyzeRepository}
              >
                <div className="input-wrapper">
                  <span className="input-icon">
                    ↗
                  </span>

                  <input
                    type="url"
                    value={url}
                    onChange={(event) =>
                      setUrl(
                        event.target.value
                      )
                    }
                    placeholder="https://github.com/owner/repository"
                    disabled={loading}
                  />
                </div>

                <button
                  className="analyze-button"
                  type="submit"
                  disabled={loading}
                >
                  {loading
                    ? "Analyzing..."
                    : "Analyze repository"}

                  <span>→</span>
                </button>
              </form>

              {error && (
                <div className="error-message">
                  {error}
                </div>
              )}

              <div className="hero-note">
                Currently supports public GitHub
                repositories
              </div>
            </section>

            <section className="features-section">
              <div className="section-label">
                WHAT CODEATLAS DOES
              </div>

              <div className="feature-grid">
                <FeatureCard
                  number="01"
                  title="Repository Mapping"
                  description="Build a structured view of your repository, files, languages, and dependencies."
                />

                <FeatureCard
                  number="02"
                  title="Code Understanding"
                  description="Explore the important parts of a large codebase instead of navigating blindly."
                />

                <FeatureCard
                  number="03"
                  title="Risk Prediction"
                  description="Use repository signals and machine learning to identify potentially risky changes."
                />

                <FeatureCard
                  number="04"
                  title="Change Impact"
                  description="Understand which parts of the system may be affected before changing code."
                />

                <FeatureCard
                  number="05"
                  title="AI Engineering Assistant"
                  description="Ask repository-aware questions about architecture, implementation, and dependencies."
                />

                <FeatureCard
                  number="06"
                  title="Hotspot Detection"
                  description="Find complex and frequently changing areas that deserve extra engineering attention."
                />
              </div>
            </section>

            <section className="steps-section">
              <div className="section-label">
                HOW IT WORKS
              </div>

              <div className="steps-grid">
                <Step
                  number="01"
                  title="Connect"
                  description="Provide a public GitHub repository."
                />

                <Step
                  number="02"
                  title="Analyze"
                  description="CodeAtlas scans the repository and extracts meaningful engineering signals."
                />

                <Step
                  number="03"
                  title="Explore"
                  description="Navigate the codebase through an intelligent engineering dashboard."
                />
              </div>
            </section>
          </>
        )}

        {/* ===================================================
            DASHBOARD
        =================================================== */}

        {isDashboard && (
          <section className="dashboard">

            {/* HEADER */}

            <div className="dashboard-header">
              <div>
                <div className="section-label">
                  REPOSITORY ANALYSIS
                </div>

                <h1>
                  {result.repository.name}
                </h1>

                <p>
                  {result.repository.owner}
                  {" · "}
                  Public GitHub repository
                </p>

                <div className="repo-url">
                  {result.repository.url}
                </div>
              </div>

              <button
                type="button"
                className="secondary-button"
                onClick={() => {
                  setResult(
                    EMPTY_RESULT
                  );
                  setUrl("");
                  setError("");
                  setSearch("");
                  setSelectedFile(null);
                }}
              >
                Analyze another
              </button>
            </div>

            {/* =================================================
                TOP STATISTICS
            ================================================= */}

            <div className="stats-grid">

              <Stat
                label="FILES"
                value={formatNumber(
                  result.analysis.file_count
                )}
              />

              <Stat
                label="LINES OF CODE"
                value={formatNumber(
                  result.analysis.loc
                )}
              />

              <Stat
                label="LANGUAGES"
                value={formatNumber(
                  languageEntries.length
                )}
              />

              <Stat
                label="TEST FILES"
                value={formatNumber(
                  testFiles.length
                )}
                subtitle={`${formatNumber(
                  testLoc
                )} test LOC`}
              />

            </div>

            {/* =================================================
                MAIN DASHBOARD GRID
            ================================================= */}

            <div className="dashboard-grid">

              {/* ===============================================
                  LEFT / MAIN COLUMN
              =============================================== */}

              <div className="main-column">

                {/* REPOSITORY OVERVIEW */}

                <section className="panel">
                  <div className="panel-header">
                    <div>
                      <div className="panel-title">
                        Repository Overview
                      </div>

                      <div className="panel-subtitle">
                        High-level engineering signals
                      </div>
                    </div>
                  </div>

                  <div className="panel-body">

                    <div className="overview-metrics">

                      <OverviewMetric
                        label="Total files"
                        value={formatNumber(
                          result.analysis.file_count
                        )}
                      />

                      <OverviewMetric
                        label="Total LOC"
                        value={formatNumber(
                          result.analysis.loc
                        )}
                      />

                      <OverviewMetric
                        label="Average file size"
                        value={`${formatNumber(
                          averageFileSize
                        )} LOC`}
                      />

                      <OverviewMetric
                        label="Largest file"
                        value={
                          largestFile
                            ? `${formatNumber(
                                largestFile.loc
                              )} LOC`
                            : "—"
                        }
                      />

                      <OverviewMetric
                        label="Test files"
                        value={formatNumber(
                          testFiles.length
                        )}
                      />

                      <OverviewMetric
                        label="Test LOC"
                        value={formatNumber(
                          testLoc
                        )}
                      />

                    </div>

                    {/* TESTING SIGNAL */}

                    <div className="testing-signal">
                      <div>
                        <div className="signal-label">
                          TESTING SIGNAL
                        </div>

                        <div className="signal-description">
                          Files detected using repository
                          test naming conventions
                        </div>
                      </div>

                      <div className="signal-value">
                        <strong>
                          {formatNumber(
                            testFiles.length
                          )}
                        </strong>

                        <span>
                          files
                        </span>

                        <small>
                          {formatNumber(
                            testLoc
                          )}{" "}
                          LOC
                        </small>
                      </div>
                    </div>

                    {/* LARGEST FILES */}

                    <div className="overview-section">
                      <div className="section-heading-row">
                        <div>
                          <div className="panel-title">
                            Largest files
                          </div>

                          <div className="panel-subtitle">
                            Files with the highest LOC
                          </div>
                        </div>
                      </div>

                      <div className="largest-files">
                        {largestFiles.map(
                          (file, index) => (
                            <button
                              type="button"
                              key={file.path}
                              className="largest-file"
                              onClick={() =>
                                setSelectedFile(
                                  file
                                )
                              }
                            >
                              <span className="largest-rank">
                                {String(
                                  index + 1
                                ).padStart(
                                  2,
                                  "0"
                                )}
                              </span>

                              <span className="largest-file-info">
                                <strong>
                                  {file.path}
                                </strong>

                                <small>
                                  {file.language}
                                </small>
                              </span>

                              <span className="largest-loc">
                                {formatNumber(
                                  file.loc
                                )}{" "}
                                LOC
                              </span>

                              <span className="largest-arrow">
                                →
                              </span>
                            </button>
                          )
                        )}
                      </div>
                    </div>
                  </div>
                </section>

                {/* CODE EXPLORER */}

                <section className="panel explorer-panel">
                  <div className="panel-header explorer-header">
                    <div>
                      <div className="panel-title">
                        Code Explorer
                      </div>

                      <div className="panel-subtitle">
                        Explore files detected in the
                        repository
                      </div>
                    </div>

                    <div className="file-count">
                      {formatNumber(
                        filteredFiles.length
                      )}{" "}
                      files
                    </div>
                  </div>

                  <div className="explorer-controls">

                    <div className="search-box">
                      <span>⌕</span>

                      <input
                        value={search}
                        onChange={(event) =>
                          setSearch(
                            event.target.value
                          )
                        }
                        placeholder="Search files..."
                      />
                    </div>

                    <select
                      value={language}
                      onChange={(event) =>
                        setLanguage(
                          event.target.value
                        )
                      }
                    >
                      {languages.map(
                        (item) => (
                          <option
                            key={item}
                            value={item}
                          >
                            {item === "All"
                              ? "All languages"
                              : item}
                          </option>
                        )
                      )}
                    </select>

                    <select
                      value={sortBy}
                      onChange={(event) =>
                        setSortBy(
                          event.target
                            .value as
                            | "name"
                            | "loc-desc"
                            | "loc-asc"
                        )
                      }
                    >
                      <option value="name">
                        Name
                      </option>

                      <option value="loc-desc">
                        LOC: High → Low
                      </option>

                      <option value="loc-asc">
                        LOC: Low → High
                      </option>
                    </select>

                  </div>

                  {filteredFiles.length ===
                  0 ? (
                    <div className="empty-state">
                      <div className="empty-icon">
                        ⌕
                      </div>

                      <h3>
                        No files found
                      </h3>

                      <p>
                        Try changing your search
                        or language filter.
                      </p>
                    </div>
                  ) : (
                    <div className="file-list">
                      {filteredFiles.map(
                        (file) => (
                          <button
                            type="button"
                            key={file.path}
                            className={`file-row ${
                              selectedFile?.path ===
                              file.path
                                ? "selected"
                                : ""
                            }`}
                            onClick={() =>
                              setSelectedFile(
                                file
                              )
                            }
                          >
                            <div className="file-symbol">
                              {getFileSymbol(
                                file.language
                              )}
                            </div>

                            <div className="file-info">
                              <div className="file-path">
                                {file.path}
                              </div>

                              <div className="file-meta">
                                {
                                  file.language
                                }
                              </div>
                            </div>

                            <div className="file-loc">
                              {formatNumber(
                                file.loc
                              )}{" "}
                              LOC
                            </div>

                            <div className="file-arrow">
                              →
                            </div>
                          </button>
                        )
                      )}
                    </div>
                  )}

                  {result.analysis.files_truncated && (
                    <div className="notice">
                      The analyzer returned a
                      truncated file list. Some
                      repository files are not
                      displayed.
                    </div>
                  )}
                </section>
              </div>

              {/* ===============================================
                  RIGHT COLUMN
              =============================================== */}

              <aside className="side-column">

                {/* FILE DETAILS */}

                <section className="side-panel">
                  <div className="panel-header">
                    <div className="panel-title">
                      File details
                    </div>
                  </div>

                  {selectedFile ? (
                    <div className="file-detail">

                      <div className="detail-symbol">
                        {getFileSymbol(
                          selectedFile.language
                        )}
                      </div>

                      <h3>
                        {selectedFile.path}
                      </h3>

                      <div className="detail-row">
                        <span>
                          Language
                        </span>

                        <strong>
                          {
                            selectedFile.language
                          }
                        </strong>
                      </div>

                      <div className="detail-row">
                        <span>
                          Lines of code
                        </span>

                        <strong>
                          {formatNumber(
                            selectedFile.loc
                          )}
                        </strong>
                      </div>

                      <div className="detail-row">
                        <span>
                          Risk score
                        </span>

                        <strong className="muted-value">
                          Coming soon
                        </strong>
                      </div>

                      <div className="detail-row">
                        <span>
                          Dependencies
                        </span>

                        <strong className="muted-value">
                          Coming soon
                        </strong>
                      </div>

                      <div className="detail-row">
                        <span>
                          AI explanation
                        </span>

                        <strong className="muted-value">
                          Coming soon
                        </strong>
                      </div>

                    </div>
                  ) : (
                    <div className="selection-empty">
                      <div className="selection-icon">
                        ⌁
                      </div>

                      <p>
                        Select a file to inspect
                        its details.
                      </p>
                    </div>
                  )}
                </section>

                {/* LANGUAGES */}

                <section className="side-panel">
                  <div className="panel-header">
                    <div className="panel-title">
                      Languages
                    </div>
                  </div>

                  <div className="language-list">
                    {languageEntries.map(
                      ([name, count]) => {
                        const percentage =
                          result.analysis.file_count >
                          0
                            ? Math.round(
                                (Number(
                                  count
                                ) /
                                  result.analysis
                                    .file_count) *
                                  100
                              )
                            : 0;

                        return (
                          <div
                            className="language-item"
                            key={name}
                          >
                            <div className="language-top">
                              <span>
                                {name}
                              </span>

                              <strong>
                                {formatNumber(
                                  Number(
                                    count
                                  )
                                )}
                              </strong>
                            </div>

                            <div className="language-bar">
                              <div
                                className="language-fill"
                                style={{
                                  width: `${percentage}%`,
                                }}
                              />
                            </div>
                          </div>
                        );
                      }
                    )}
                  </div>
                </section>

                {/* LARGEST FILE */}

                <section className="side-panel">
                  <div className="panel-header">
                    <div className="panel-title">
                      Largest file
                    </div>
                  </div>

                  {largestFile ? (
                    <button
                      type="button"
                      className="largest-side-file"
                      onClick={() =>
                        setSelectedFile(
                          largestFile
                        )
                      }
                    >
                      <div className="detail-symbol">
                        {getFileSymbol(
                          largestFile.language
                        )}
                      </div>

                      <strong>
                        {largestFile.path}
                      </strong>

                      <span>
                        {formatNumber(
                          largestFile.loc
                        )}{" "}
                        LOC
                      </span>
                    </button>
                  ) : (
                    <div className="selection-empty">
                      No file data available.
                    </div>
                  )}
                </section>

              </aside>
            </div>

            {/* =================================================
                FUTURE FEATURES
            ================================================= */}

            <section className="future-features">
              <div className="section-label">
                NEXT INTELLIGENCE LAYER
              </div>

              <div className="future-grid">

                <FutureFeature
                  number="01"
                  title="PR Risk Prediction"
                  description="Predict the engineering risk of incoming changes using repository and historical signals."
                />

                <FutureFeature
                  number="02"
                  title="What-if Analysis"
                  description="Understand potential change impact before modifying the codebase."
                />

                <FutureFeature
                  number="03"
                  title="AI Test Recommendations"
                  description="Generate intelligent test suggestions for changed files and components."
                />

                <FutureFeature
                  number="04"
                  title="Hotspot Detection"
                  description="Find complex and frequently changing areas that deserve extra attention."
                />

              </div>
            </section>

          </section>
        )}
      </main>

      <footer className="footer">
        <div>CodeAtlas AI</div>
        <div>
          Map. Understand. Predict.
        </div>
      </footer>
    </div>
  );
}

/*
 * -----------------------------------------------------------
 * COMPONENTS
 * -----------------------------------------------------------
 */

function getFileSymbol(language: string) {
  const symbols: Record<string, string> = {
    Python: "PY",
    JavaScript: "JS",
    TypeScript: "TS",
    Java: "JV",
    Go: "GO",
    Rust: "RS",
    "C++": "C+",
    "C#": "C#",
    Ruby: "RB",
    PHP: "PHP",
    Kotlin: "KT",
    Swift: "SW",
  };

  return symbols[language] || "FILE";
}

function FeatureCard({
  number,
  title,
  description,
}: {
  number: string;
  title: string;
  description: string;
}) {
  return (
    <article className="feature-card">
      <div className="feature-number">
        {number}
      </div>

      <h3>{title}</h3>

      <p>{description}</p>

      <div className="feature-line" />
    </article>
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
    <article className="step">
      <div className="step-number">
        {number}
      </div>

      <h3>{title}</h3>

      <p>{description}</p>
    </article>
  );
}

function Stat({
  label,
  value,
  subtitle,
}: {
  label: string;
  value: string;
  subtitle?: string;
}) {
  return (
    <div className="stat-card">
      <div className="stat-label">
        {label}
      </div>

      <div className="stat-value">
        {value}
      </div>

      {subtitle && (
        <div className="stat-subtitle">
          {subtitle}
        </div>
      )}
    </div>
  );
}

function OverviewMetric({
  label,
  value,
}: {
  label: string;
  value: string;
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
    <article className="future-feature">
      <span>{number}</span>

      <h3>{title}</h3>

      <p>{description}</p>
    </article>
  );
}

createRoot(
  document.getElementById("root")!
).render(<App />);