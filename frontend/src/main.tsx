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

const EMPTY_ANALYSIS: AnalysisResult = {
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
  return value.toLocaleString();
}

function App() {
  const [url, setUrl] = useState("");
  const [result, setResult] = useState<AnalysisResult>(EMPTY_ANALYSIS);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [search, setSearch] = useState("");
  const [language, setLanguage] = useState("All");
  const [sortBy, setSortBy] = useState("name");
  const [selectedFile, setSelectedFile] = useState<FileInfo | null>(null);

  async function analyzeRepository(event: FormEvent) {
    event.preventDefault();

    if (!url.trim()) {
      setError("Please enter a GitHub repository URL.");
      return;
    }

    if (!url.startsWith("https://github.com/")) {
      setError(
        "Only public GitHub repository URLs are supported in V1."
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
            url: url.trim(),
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data?.detail || "Repository analysis failed."
        );
      }

      const rawFiles = Array.isArray(data?.analysis?.files)
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

          if (file && typeof file === "object") {
            const item = file as Record<string, unknown>;

            return {
              path:
                typeof item.path === "string"
                  ? item.path
                  : "Unknown file",
              language:
                typeof item.language === "string"
                  ? item.language
                  : "Unknown",
              loc:
                typeof item.loc === "number"
                  ? item.loc
                  : 0,
            };
          }

          return null;
        })
        .filter(Boolean) as FileInfo[];

      const normalized: AnalysisResult = {
        repository: {
          owner:
            typeof data?.repository?.owner === "string"
              ? data.repository.owner
              : "",
          name:
            typeof data?.repository?.name === "string"
              ? data.repository.name
              : "",
          url:
            typeof data?.repository?.url === "string"
              ? data.repository.url
              : url.trim(),
        },
        analysis: {
          file_count:
            typeof data?.analysis?.file_count === "number"
              ? data.analysis.file_count
              : files.length,
          loc:
            typeof data?.analysis?.loc === "number"
              ? data.analysis.loc
              : 0,
          languages:
            data?.analysis?.languages &&
            typeof data.analysis.languages === "object"
              ? data.analysis.languages
              : {},
          files,
          files_truncated:
            Boolean(data?.analysis?.files_truncated),
        },
        status:
          typeof data?.status === "string"
            ? data.status
            : "completed",
      };

      setResult(normalized);
      setSearch("");
      setLanguage("All");
      setSortBy("name");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Something went wrong."
      );
    } finally {
      setLoading(false);
    }
  }

  const languages = useMemo(() => {
    const uniqueLanguages = result.analysis.files
      .map((file) => file.language)
      .filter(Boolean);

    return ["All", ...Array.from(new Set(uniqueLanguages))];
  }, [result.analysis.files]);

  const filteredFiles = useMemo(() => {
    const normalizedSearch = search.toLowerCase().trim();

    const filtered = result.analysis.files.filter((file) => {
      const matchesSearch =
        !normalizedSearch ||
        file.path.toLowerCase().includes(normalizedSearch);

      const matchesLanguage =
        language === "All" || file.language === language;

      return matchesSearch && matchesLanguage;
    });

    return [...filtered].sort((a, b) => {
      if (sortBy === "loc-desc") {
        return b.loc - a.loc;
      }

      if (sortBy === "loc-asc") {
        return a.loc - b.loc;
      }

      return a.path.localeCompare(b.path);
    });
  }, [
    result.analysis.files,
    search,
    language,
    sortBy,
  ]);

  const topLanguages = useMemo(() => {
    return Object.entries(result.analysis.languages).sort(
      (a, b) => b[1] - a[1]
    );
  }, [result.analysis.languages]);

  return (
    <div className="app-shell">
      <header className="navbar">
        <div className="brand">
          <div className="brand-mark">C</div>
          <div>
            <div className="brand-name">CodeAtlas AI</div>
            <div className="brand-tagline">
              Map. Understand. Predict.
            </div>
          </div>
        </div>

        <div className="nav-pill">
          <span className="status-dot" />
          Public repositories
        </div>
      </header>

      <main>
        {!result.repository.name ? (
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
                Analyze a GitHub repository and turn its source code
                into an intelligent map of structure, complexity,
                dependencies, and risk.
              </p>

              <form
                className="analyze-box"
                onSubmit={analyzeRepository}
              >
                <div className="input-wrapper">
                  <span className="input-icon">↗</span>

                  <input
                    value={url}
                    onChange={(event) =>
                      setUrl(event.target.value)
                    }
                    placeholder="https://github.com/owner/repository"
                  />
                </div>

                <button
                  className="analyze-button"
                  type="submit"
                  disabled={loading}
                >
                  {loading ? "Analyzing..." : "Analyze repository"}
                  <span>→</span>
                </button>
              </form>

              {error && (
                <div className="error-message">
                  {error}
                </div>
              )}

              <div className="hero-note">
                Currently supports public GitHub repositories
              </div>
            </section>

            <section className="features-section">
              <div className="section-label">WHAT CODEATLAS DOES</div>

              <div className="feature-grid">
                <FeatureCard
                  number="01"
                  title="Map"
                  description="Build a structured view of your repository, files, languages, and dependencies."
                />

                <FeatureCard
                  number="02"
                  title="Understand"
                  description="Explore code structure and surface the important parts of a large codebase."
                />

                <FeatureCard
                  number="03"
                  title="Predict"
                  description="Use repository signals and machine learning to identify potentially risky changes."
                />
              </div>
            </section>

            <section className="steps-section">
              <div className="section-label">HOW IT WORKS</div>

              <div className="steps-grid">
                <Step
                  number="01"
                  title="Connect"
                  description="Provide a public GitHub repository."
                />

                <Step
                  number="02"
                  title="Analyze"
                  description="CodeAtlas scans the repository and extracts engineering signals."
                />

                <Step
                  number="03"
                  title="Explore"
                  description="Navigate the codebase through an interactive intelligence dashboard."
                />
              </div>
            </section>
          </>
        ) : (
          <section className="dashboard">
            <div className="dashboard-header">
              <div>
                <div className="section-label">REPOSITORY ANALYSIS</div>

                <h1>{result.repository.name}</h1>

                <p>
                  {result.repository.owner} · Public GitHub repository
                </p>
              </div>

              <button
                className="secondary-button"
                onClick={() => {
                  setResult(EMPTY_ANALYSIS);
                  setSelectedFile(null);
                  setUrl("");
                }}
              >
                Analyze another
              </button>
            </div>

            <div className="stats-grid">
              <Stat
                label="Files"
                value={formatNumber(result.analysis.file_count)}
              />

              <Stat
                label="Lines of code"
                value={formatNumber(result.analysis.loc)}
              />

              <Stat
                label="Languages"
                value={formatNumber(
                  Object.keys(result.analysis.languages).length
                )}
              />

              <Stat
                label="Status"
                value="Ready"
              />
            </div>

            <div className="dashboard-grid">
              <div className="main-panel">
                <div className="panel-header">
                  <div>
                    <div className="panel-title">
                      Code Explorer
                    </div>

                    <div className="panel-subtitle">
                      Explore files detected in the repository
                    </div>
                  </div>

                  <div className="file-count">
                    {filteredFiles.length} files
                  </div>
                </div>

                <div className="explorer-controls">
                  <div className="search-box">
                    <span>⌕</span>

                    <input
                      value={search}
                      onChange={(event) =>
                        setSearch(event.target.value)
                      }
                      placeholder="Search files..."
                    />
                  </div>

                  <select
                    value={language}
                    onChange={(event) =>
                      setLanguage(event.target.value)
                    }
                  >
                    {languages.map((item) => (
                      <option key={item} value={item}>
                        {item === "All"
                          ? "All languages"
                          : item}
                      </option>
                    ))}
                  </select>

                  <select
                    value={sortBy}
                    onChange={(event) =>
                      setSortBy(event.target.value)
                    }
                  >
                    <option value="name">Name</option>
                    <option value="loc-desc">
                      LOC: High → Low
                    </option>
                    <option value="loc-asc">
                      LOC: Low → High
                    </option>
                  </select>
                </div>

                {filteredFiles.length === 0 ? (
                  <div className="empty-state">
                    <div className="empty-icon">⌕</div>

                    <h3>No files found</h3>

                    <p>
                      Try changing your search or language filter.
                    </p>
                  </div>
                ) : (
                  <div className="file-list">
                    {filteredFiles.map((file) => (
                      <button
                        key={file.path}
                        className={`file-row ${
                          selectedFile?.path === file.path
                            ? "selected"
                            : ""
                        }`}
                        onClick={() =>
                          setSelectedFile(file)
                        }
                      >
                        <div className="file-symbol">
                          {getFileSymbol(file.language)}
                        </div>

                        <div className="file-info">
                          <div className="file-path">
                            {file.path}
                          </div>

                          <div className="file-meta">
                            {file.language}
                          </div>
                        </div>

                        <div className="file-loc">
                          {formatNumber(file.loc)} LOC
                        </div>

                        <div className="file-arrow">
                          →
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <aside className="side-column">
                <div className="side-panel">
                  <div className="panel-title">
                    File details
                  </div>

                  {selectedFile ? (
                    <div className="file-detail">
                      <div className="detail-symbol">
                        {getFileSymbol(selectedFile.language)}
                      </div>

                      <h3>{selectedFile.path}</h3>

                      <div className="detail-row">
                        <span>Language</span>
                        <strong>
                          {selectedFile.language}
                        </strong>
                      </div>

                      <div className="detail-row">
                        <span>Lines of code</span>
                        <strong>
                          {formatNumber(selectedFile.loc)}
                        </strong>
                      </div>

                      <div className="detail-row">
                        <span>Risk score</span>
                        <strong className="muted-value">
                          Coming soon
                        </strong>
                      </div>

                      <div className="detail-row">
                        <span>Dependencies</span>
                        <strong className="muted-value">
                          Coming soon
                        </strong>
                      </div>

                      <div className="detail-row">
                        <span>AI explanation</span>
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
                        Select a file to inspect its details.
                      </p>
                    </div>
                  )}
                </div>

                <div className="side-panel">
                  <div className="panel-title">
                    Languages
                  </div>

                  <div className="language-list">
                    {topLanguages.map(
                      ([name, count]) => (
                        <div
                          className="language-row"
                          key={name}
                        >
                          <div>
                            <span className="language-dot" />
                            {name}
                          </div>

                          <strong>
                            {count}
                          </strong>
                        </div>
                      )
                    )}
                  </div>
                </div>
              </aside>
            </div>

            {result.analysis.files_truncated && (
              <div className="notice">
                The repository contains more files than the current
                explorer limit. Some files are not displayed.
              </div>
            )}
          </section>
        )}
      </main>

      <footer className="footer">
        <div>CodeAtlas AI</div>
        <div>Map. Understand. Predict.</div>
      </footer>
    </div>
  );
}

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
    <div className="feature-card">
      <div className="feature-number">{number}</div>

      <div className="feature-title">{title}</div>

      <p>{description}</p>

      <div className="feature-line" />
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
      <div className="step-number">{number}</div>

      <div>
        <h3>{title}</h3>
        <p>{description}</p>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="stat-card">
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value}</div>
    </div>
  );
}

createRoot(document.getElementById("root")!).render(
  <App />
);