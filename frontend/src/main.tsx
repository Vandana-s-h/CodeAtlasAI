import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";

type Repository = {
  owner: string;
  name: string;
  url: string;
};

type FileInfo = {
  path: string;
  language?: string;
  loc?: number;
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

const EMPTY_ANALYSIS: Analysis = {
  file_count: 0,
  loc: 0,
  languages: {},
  files: [],
  files_truncated: false,
};

function formatNumber(value: number): string {
  return Number(value || 0).toLocaleString();
}

function App() {
  const [repoUrl, setRepoUrl] = useState("");
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function analyzeRepository() {
    const url = repoUrl.trim();

    if (!url) {
      setError("Please enter a GitHub repository URL.");
      return;
    }

    if (!url.includes("github.com/")) {
      setError("Please enter a valid public GitHub repository URL.");
      return;
    }

    setLoading(true);
    setError("");
    setResult(null);

    try {
      const response = await fetch(
        "http://127.0.0.1:8000/api/repositories/analyze",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            url,
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

      const normalizedFiles: FileInfo[] = rawFiles
        .map((file: unknown) => {
          if (typeof file === "string") {
            return {
              path: file,
            };
          }

          if (file && typeof file === "object") {
            const item = file as {
              path?: unknown;
              language?: unknown;
              loc?: unknown;
            };

            return {
              path:
                typeof item.path === "string"
                  ? item.path
                  : "Unknown file",
              language:
                typeof item.language === "string"
                  ? item.language
                  : undefined,
              loc:
                typeof item.loc === "number"
                  ? item.loc
                  : Number(item.loc ?? 0),
            };
          }

          return {
            path: "Unknown file",
          };
        })
        .filter((file) => file.path);

      const normalizedResult: AnalysisResult = {
        repository: {
          owner: data?.repository?.owner ?? "",
          name: data?.repository?.name ?? "",
          url: data?.repository?.url ?? url,
        },

        analysis: {
          file_count: Number(
            data?.analysis?.file_count ?? 0
          ),

          loc: Number(
            data?.analysis?.loc ?? 0
          ),

          languages:
            data?.analysis?.languages &&
            typeof data.analysis.languages === "object"
              ? data.analysis.languages
              : {},

          files: normalizedFiles,

          files_truncated: Boolean(
            data?.analysis?.files_truncated
          ),
        },

        status: data?.status ?? "completed",
      };

      setResult(normalizedResult);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Something went wrong while analyzing the repository."
      );
    } finally {
      setLoading(false);
    }
  }

  function handleKeyDown(
    event: React.KeyboardEvent<HTMLInputElement>
  ) {
    if (event.key === "Enter" && !loading) {
      analyzeRepository();
    }
  }

  const analysis = result?.analysis ?? EMPTY_ANALYSIS;

  return (
    <>
      <style>{`
        * {
          box-sizing: border-box;
        }

        html {
          scroll-behavior: smooth;
        }

        body {
          margin: 0;
          background: #050507;
          color: #f5f5f7;
          font-family:
            Inter,
            ui-sans-serif,
            system-ui,
            -apple-system,
            BlinkMacSystemFont,
            "Segoe UI",
            sans-serif;
        }

        button,
        input {
          font: inherit;
        }

        button {
          cursor: pointer;
        }

        .app {
          min-height: 100vh;
          background:
            radial-gradient(
              circle at 50% -10%,
              rgba(112, 76, 255, 0.16),
              transparent 34%
            ),
            #050507;
        }

        .navbar {
          width: 100%;
          height: 76px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0 5vw;
          border-bottom: 1px solid rgba(255,255,255,0.07);
          background: rgba(5,5,7,0.72);
          backdrop-filter: blur(16px);
          position: sticky;
          top: 0;
          z-index: 20;
        }

        .logo {
          display: flex;
          align-items: center;
          gap: 11px;
          font-weight: 800;
          font-size: 18px;
          letter-spacing: -0.4px;
        }

        .logo-mark {
          width: 31px;
          height: 31px;
          border-radius: 9px;
          display: grid;
          place-items: center;
          background: linear-gradient(
            135deg,
            #8b5cf6,
            #5b5bf7
          );
          box-shadow:
            0 0 24px rgba(124, 92, 246, 0.28);
          font-size: 15px;
        }

        .nav-links {
          display: flex;
          gap: 30px;
          align-items: center;
          color: #96969f;
          font-size: 14px;
        }

        .nav-links a {
          color: inherit;
          text-decoration: none;
          transition: color 0.2s;
        }

        .nav-links a:hover {
          color: white;
        }

        .hero {
          max-width: 1120px;
          margin: 0 auto;
          padding: 105px 24px 85px;
          text-align: center;
        }

        .eyebrow {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 7px 12px;
          border: 1px solid rgba(139,92,246,0.28);
          border-radius: 999px;
          color: #a78bfa;
          background: rgba(124,92,246,0.08);
          font-size: 12px;
          font-weight: 700;
          letter-spacing: 1.3px;
          text-transform: uppercase;
        }

        .hero h1 {
          margin: 25px auto 20px;
          max-width: 850px;
          font-size: clamp(45px, 7vw, 78px);
          line-height: 0.98;
          letter-spacing: -4px;
          font-weight: 800;
        }

        .gradient-text {
          background: linear-gradient(
            110deg,
            #ffffff 15%,
            #a78bfa 52%,
            #6366f1 90%
          );
          -webkit-background-clip: text;
          background-clip: text;
          color: transparent;
        }

        .hero p {
          max-width: 650px;
          margin: 0 auto;
          color: #9999a3;
          font-size: 18px;
          line-height: 1.7;
        }

        .analyze-box {
          max-width: 720px;
          margin: 38px auto 0;
          padding: 7px;
          display: flex;
          gap: 8px;
          border-radius: 15px;
          border: 1px solid rgba(255,255,255,0.12);
          background: rgba(255,255,255,0.045);
          box-shadow:
            0 20px 70px rgba(0,0,0,0.3),
            0 0 50px rgba(104,75,220,0.08);
        }

        .analyze-input {
          flex: 1;
          min-width: 0;
          border: 0;
          outline: 0;
          padding: 15px 16px;
          color: white;
          background: transparent;
          font-size: 15px;
        }

        .analyze-input::placeholder {
          color: #666670;
        }

        .analyze-button {
          border: 0;
          border-radius: 10px;
          padding: 0 24px;
          min-height: 50px;
          color: white;
          background: linear-gradient(
            135deg,
            #7c3aed,
            #5b5bf7
          );
          font-weight: 700;
          transition:
            transform 0.2s,
            opacity 0.2s;
          box-shadow:
            0 8px 25px rgba(99,102,241,0.2);
        }

        .analyze-button:hover:not(:disabled) {
          transform: translateY(-1px);
        }

        .analyze-button:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .error {
          max-width: 720px;
          margin: 14px auto 0;
          padding: 12px 15px;
          text-align: left;
          border-radius: 10px;
          border: 1px solid rgba(248,113,113,0.22);
          background: rgba(248,113,113,0.07);
          color: #fca5a5;
          font-size: 14px;
        }

        .hint {
          margin-top: 15px;
          color: #606069;
          font-size: 12px;
        }

        .section {
          max-width: 1120px;
          margin: 0 auto;
          padding: 75px 24px;
        }

        .section-heading {
          margin-bottom: 35px;
        }

        .section-heading .small {
          color: #8b5cf6;
          font-size: 11px;
          font-weight: 800;
          letter-spacing: 1.8px;
          text-transform: uppercase;
        }

        .section-heading h2 {
          margin: 10px 0 0;
          font-size: 35px;
          letter-spacing: -1.5px;
        }

        .features {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 16px;
        }

        .feature {
          padding: 27px;
          min-height: 190px;
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 18px;
          background:
            linear-gradient(
              145deg,
              rgba(255,255,255,0.045),
              rgba(255,255,255,0.018)
            );
          transition:
            transform 0.25s,
            border-color 0.25s;
        }

        .feature:hover {
          transform: translateY(-3px);
          border-color: rgba(139,92,246,0.3);
        }

        .feature-icon {
          width: 39px;
          height: 39px;
          display: grid;
          place-items: center;
          border-radius: 11px;
          background: rgba(124,92,246,0.12);
          border: 1px solid rgba(139,92,246,0.2);
          color: #a78bfa;
          font-size: 17px;
          margin-bottom: 20px;
        }

        .feature h3 {
          margin: 0 0 9px;
          font-size: 16px;
        }

        .feature p {
          margin: 0;
          color: #85858f;
          line-height: 1.6;
          font-size: 14px;
        }

        .steps {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 15px;
        }

        .step {
          padding: 26px;
          border-top: 1px solid rgba(255,255,255,0.1);
        }

        .step-number {
          color: #8b5cf6;
          font-size: 12px;
          font-weight: 800;
          letter-spacing: 1px;
        }

        .step h3 {
          margin: 12px 0 8px;
        }

        .step p {
          margin: 0;
          color: #81818b;
          font-size: 14px;
          line-height: 1.65;
        }

        .dashboard {
          max-width: 1180px;
          margin: 30px auto 90px;
          padding: 0 24px;
        }

        .dashboard-header {
          padding: 30px 0 28px;
          border-bottom: 1px solid rgba(255,255,255,0.08);
        }

        .analysis-label {
          color: #8b5cf6;
          font-size: 12px;
          font-weight: 800;
          letter-spacing: 1.5px;
          text-transform: uppercase;
        }

        .repo-title {
          margin: 13px 0 8px;
          font-size: clamp(34px, 5vw, 48px);
          letter-spacing: -2.4px;
          line-height: 1;
        }

        .repo-url {
          color: #71717b;
          font-size: 14px;
          word-break: break-all;
        }

        .status {
          display: inline-flex;
          align-items: center;
          margin-top: 18px;
          padding: 7px 11px;
          border-radius: 999px;
          border: 1px solid rgba(34,197,94,0.22);
          background: rgba(34,197,94,0.07);
          color: #86efac;
          font-size: 12px;
          font-weight: 700;
        }

        .stats {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 15px;
          margin-top: 28px;
        }

        .stat {
          padding: 30px;
          min-height: 130px;
          border-radius: 17px;
          border: 1px solid rgba(255,255,255,0.09);
          background: rgba(255,255,255,0.025);
        }

        .stat-value {
          font-size: 37px;
          font-weight: 750;
          letter-spacing: -1.5px;
        }

        .stat-label {
          margin-top: 8px;
          color: #73737d;
          font-size: 13px;
        }

        .dashboard-grid {
          display: grid;
          grid-template-columns: 1fr 1.35fr;
          gap: 16px;
          margin-top: 16px;
        }

        .panel {
          min-width: 0;
          border-radius: 17px;
          border: 1px solid rgba(255,255,255,0.09);
          background: rgba(255,255,255,0.025);
          overflow: hidden;
        }

        .panel-header {
          padding: 21px 24px;
          border-bottom: 1px solid rgba(255,255,255,0.07);
        }

        .panel-header h3 {
          margin: 0;
          font-size: 15px;
        }

        .panel-body {
          padding: 24px;
        }

        .language-row {
          margin-bottom: 18px;
        }

        .language-top {
          display: flex;
          justify-content: space-between;
          gap: 10px;
          margin-bottom: 7px;
          font-size: 13px;
        }

        .language-name {
          color: #dddde2;
        }

        .language-count {
          color: #777782;
        }

        .language-bar {
          height: 5px;
          border-radius: 99px;
          overflow: hidden;
          background: rgba(255,255,255,0.07);
        }

        .language-fill {
          height: 100%;
          border-radius: inherit;
          background: linear-gradient(
            90deg,
            #7c3aed,
            #6366f1
          );
        }

        .empty {
          padding: 25px 0;
          color: #666671;
          font-size: 14px;
          line-height: 1.6;
        }

        .file-list {
          max-height: 430px;
          overflow-y: auto;
        }

        .file-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 20px;
          padding: 13px 0;
          border-bottom: 1px solid rgba(255,255,255,0.05);
        }

        .file-row:last-child {
          border-bottom: 0;
        }

        .file-path {
          min-width: 0;
          color: #d4d4d9;
          font-family:
            "SFMono-Regular",
            Consolas,
            "Liberation Mono",
            monospace;
          font-size: 12px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .file-meta {
          flex-shrink: 0;
          display: flex;
          align-items: center;
          gap: 10px;
          color: #666671;
          font-size: 11px;
        }

        .file-language {
          padding: 4px 7px;
          border-radius: 5px;
          background: rgba(124,92,246,0.08);
          color: #9b8af8;
        }

        .truncated {
          margin-top: 12px;
          color: #696974;
          font-size: 11px;
        }

        .footer {
          padding: 55px 24px;
          text-align: center;
          color: #4f4f58;
          border-top: 1px solid rgba(255,255,255,0.06);
          font-size: 12px;
        }

        @media (max-width: 850px) {
          .features,
          .steps {
            grid-template-columns: 1fr;
          }

          .dashboard-grid {
            grid-template-columns: 1fr;
          }

          .stats {
            grid-template-columns: 1fr;
          }

          .nav-links {
            display: none;
          }

          .hero {
            padding-top: 75px;
          }
        }

        @media (max-width: 600px) {
          .navbar {
            padding: 0 20px;
          }

          .hero {
            padding-left: 18px;
            padding-right: 18px;
          }

          .hero h1 {
            letter-spacing: -2.5px;
          }

          .hero p {
            font-size: 15px;
          }

          .analyze-box {
            flex-direction: column;
            padding: 8px;
          }

          .analyze-button {
            min-height: 48px;
          }

          .section,
          .dashboard {
            padding-left: 18px;
            padding-right: 18px;
          }

          .file-row {
            align-items: flex-start;
            flex-direction: column;
            gap: 7px;
          }
        }
      `}</style>

      <div className="app">

        {/* NAVBAR */}
        <nav className="navbar">
          <div className="logo">
            <div className="logo-mark">⌘</div>
            <span>CodeAtlas AI</span>
          </div>

          <div className="nav-links">
            <a href="#features">Features</a>
            <a href="#how-it-works">How it works</a>
            <a href="#analyze">Analyze</a>
          </div>
        </nav>

        {/* HERO */}
        <section className="hero" id="analyze">
          <div className="eyebrow">
            ✦ AI-powered code intelligence
          </div>

          <h1>
            Map your code.
            <br />
            <span className="gradient-text">
              Understand what changes.
            </span>
          </h1>

          <p>
            CodeAtlas AI turns a GitHub repository into an
            intelligent map of your codebase — helping you
            understand structure, dependencies, risks, and
            change impact.
          </p>

          <div className="analyze-box">
            <input
              className="analyze-input"
              type="text"
              value={repoUrl}
              onChange={(event) =>
                setRepoUrl(event.target.value)
              }
              onKeyDown={handleKeyDown}
              placeholder="https://github.com/owner/repository"
              disabled={loading}
            />

            <button
              className="analyze-button"
              onClick={analyzeRepository}
              disabled={loading}
            >
              {loading ? "Analyzing..." : "Analyze repo →"}
            </button>
          </div>

          {error && (
            <div className="error">
              {error}
            </div>
          )}

          <div className="hint">
            Public GitHub repositories supported in V1
          </div>
        </section>

        {/* FEATURES */}
        <section className="section" id="features">
          <div className="section-heading">
            <div className="small">What CodeAtlas does</div>
            <h2>Understand software, not just files.</h2>
          </div>

          <div className="features">
            <FeatureCard
              icon="⌘"
              title="Code Intelligence"
              description="Analyze source code structure, languages, files, and relationships across the repository."
            />

            <FeatureCard
              icon="◈"
              title="Dependency Mapping"
              description="Build a connected view of how modules and components depend on each other."
            />

            <FeatureCard
              icon="◉"
              title="Change Impact"
              description="Understand which parts of a codebase could be affected before making a change."
            />

            <FeatureCard
              icon="⚡"
              title="PR Risk Prediction"
              description="Predict potentially risky changes using repository and historical engineering signals."
            />

            <FeatureCard
              icon="✦"
              title="AI Code Assistant"
              description="Ask questions about the repository and get context-aware explanations."
            />

            <FeatureCard
              icon="△"
              title="Hotspot Detection"
              description="Identify complex and frequently changing areas that deserve extra attention."
            />
          </div>
        </section>

        {/* HOW IT WORKS */}
        <section className="section" id="how-it-works">
          <div className="section-heading">
            <div className="small">Under the hood</div>
            <h2>From repository to intelligence.</h2>
          </div>

          <div className="steps">
            <Step
              number="01"
              title="Ingest"
              description="CodeAtlas connects to a public GitHub repository and collects its source structure and metadata."
            />

            <Step
              number="02"
              title="Understand"
              description="Source code is parsed and transformed into structured information about files, symbols, dependencies, and changes."
            />

            <Step
              number="03"
              title="Predict"
              description="AI and machine-learning models use that context to surface risks, explain changes, and answer engineering questions."
            />
          </div>
        </section>

        {/* DASHBOARD */}
        {result && (
          <section className="dashboard">

            <div className="dashboard-header">
              <div className="analysis-label">
                Analysis complete
              </div>

              <h2 className="repo-title">
                {result.repository.name || "Repository"}
              </h2>

              <div className="repo-url">
                {result.repository.url}
              </div>

              <div className="status">
                ✓ {result.status || "completed"}
              </div>
            </div>

            {/* STATS */}
            <div className="stats">
              <Stat
                value={formatNumber(analysis.file_count)}
                label="Files analyzed"
              />

              <Stat
                value={formatNumber(analysis.loc)}
                label="Lines of code"
              />

              <Stat
                value={formatNumber(
                  Object.keys(
                    analysis.languages ?? {}
                  ).length
                )}
                label="Languages detected"
              />
            </div>

            {/* LOWER PANELS */}
            <div className="dashboard-grid">

              {/* LANGUAGES */}
              <div className="panel">
                <div className="panel-header">
                  <h3>Languages</h3>
                </div>

                <div className="panel-body">
                  {Object.keys(
                    analysis.languages ?? {}
                  ).length === 0 ? (
                    <div className="empty">
                      No language information was
                      returned by the analyzer.
                    </div>
                  ) : (
                    Object.entries(
                      analysis.languages ?? {}
                    )
                      .sort(
                        ([, a], [, b]) =>
                          Number(b) - Number(a)
                      )
                      .map(
                        ([language, count]) => {
                          const total =
                            Math.max(
                              analysis.file_count,
                              1
                            );

                          const percentage =
                            Math.min(
                              100,
                              (Number(count) /
                                total) *
                                100
                            );

                          return (
                            <div
                              className="language-row"
                              key={language}
                            >
                              <div className="language-top">
                                <span className="language-name">
                                  {language}
                                </span>

                                <span className="language-count">
                                  {formatNumber(
                                    Number(count)
                                  )}
                                </span>
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
                      )
                  )}
                </div>
              </div>

              {/* FILES */}
              <div className="panel">
                <div className="panel-header">
                  <h3>Repository files</h3>
                </div>

                <div className="panel-body">
                  {analysis.files.length === 0 ? (
                    <div className="empty">
                      No files were detected by the
                      analyzer.
                    </div>
                  ) : (
                    <>
                      <div className="file-list">
                        {analysis.files.map(
                          (file, index) => (
                            <div
                              className="file-row"
                              key={`${file.path}-${index}`}
                            >
                              <div
                                className="file-path"
                                title={file.path}
                              >
                                {file.path}
                              </div>

                              <div className="file-meta">
                                {file.language && (
                                  <span className="file-language">
                                    {file.language}
                                  </span>
                                )}

                                {typeof file.loc ===
                                  "number" && (
                                  <span>
                                    {formatNumber(
                                      file.loc
                                    )}{" "}
                                    LOC
                                  </span>
                                )}
                              </div>
                            </div>
                          )
                        )}
                      </div>

                      {analysis.files_truncated && (
                        <div className="truncated">
                          Showing the first 500 files.
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>

            </div>
          </section>
        )}

        {/* FOOTER */}
        <footer className="footer">
          CodeAtlas AI · Map. Understand. Predict.
        </footer>

      </div>
    </>
  );
}


/* ---------------- COMPONENTS ---------------- */

function FeatureCard({
  icon,
  title,
  description,
}: {
  icon: string;
  title: string;
  description: string;
}) {
  return (
    <div className="feature">
      <div className="feature-icon">
        {icon}
      </div>

      <h3>{title}</h3>

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

      <h3>{title}</h3>

      <p>{description}</p>
    </div>
  );
}


function Stat({
  value,
  label,
}: {
  value: string;
  label: string;
}) {
  return (
    <div className="stat">
      <div className="stat-value">
        {value}
      </div>

      <div className="stat-label">
        {label}
      </div>
    </div>
  );
}


/* ---------------- MOUNT APP ---------------- */

createRoot(
  document.getElementById("root")!
).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);