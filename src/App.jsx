import React, { useEffect, useMemo, useState } from "react";
import { parseXreoct, runXreoct } from "./xreoct";

const OWNER = "alexiusandromedavsgalaxia-lgtm";
const REPO = "xreoct";
const API = "https://api.github.com";

const icons = {
  folder: "▸",
  file: "◻",
  code: "</>",
  run: "▶",
  search: "⌕",
  branch: "⑂"
};

function App() {
  const [path, setPath] = useState("");
  const [tree, setTree] = useState([]);
  const [currentFile, setCurrentFile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [fileLoading, setFileLoading] = useState(false);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [runState, setRunState] = useState(null);
  const [tab, setTab] = useState("Code");

  const repoUrl = `https://github.com/${OWNER}/${REPO}`;

  async function github(url) {
    const response = await fetch(url, {
      headers: { Accept: "application/vnd.github+json" }
    });
    if (!response.ok) {
      throw new Error(`GitHub API ${response.status}: ${response.statusText}`);
    }
    return response.json();
  }

  async function loadTree() {
    setLoading(true);
    setError("");
    try {
      const data = await github(`${API}/repos/${OWNER}/${REPO}/git/trees/main?recursive=1`);
      setTree((data.tree || []).filter(item => item.type === "blob" || item.type === "tree"));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function openFile(filePath) {
    setFileLoading(true);
    setError("");
    setRunState(null);
    try {
      const data = await github(`${API}/repos/${OWNER}/${REPO}/contents/${encodeURIComponent(filePath)}?ref=main`);
      const content = atob(data.content.replaceAll("\n", ""));
      const bytes = Uint8Array.from(content, c => c.charCodeAt(0));
      const decoded = new TextDecoder().decode(bytes);
      setCurrentFile({
        path: filePath,
        sha: data.sha,
        content: decoded
      });
      setPath(filePath);
      setTab("Code");
    } catch (err) {
      setError(err.message);
    } finally {
      setFileLoading(false);
    }
  }

  useEffect(() => {
    loadTree();
  }, []);

  const visibleTree = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return tree;
    return tree.filter(item => item.path.toLowerCase().includes(q));
  }, [tree, query]);

  const rootFiles = visibleTree.filter(item => {
    const slash = item.path.indexOf("/");
    if (path) return item.path.startsWith(path.split("/").slice(0, -1).join("/"));
    return slash === -1 || item.path.split("/").length <= 2;
  });

  function runCurrent() {
    if (!currentFile) return;
    const ext = currentFile.path.split(".").pop()?.toLowerCase();

    if (ext === "rsx" || ext === "rs") {
      setRunState(runXreoct(currentFile.content, currentFile.path));
      setTab("Run");
      return;
    }

    if (ext === "js" || ext === "jsx") {
      const safe = currentFile.content
        .replaceAll(/import\s+[^;]+;?/g, "")
        .replaceAll(/export\s+default\s+/g, "");
      setRunState({
        parsed: { lines: currentFile.content.split("\n").length },
        output:
          "Browser JavaScript preview\n────────────────────────\n" +
          "This runner executes only self-contained JavaScript.\n\n" +
          "Detected lines: " + currentFile.content.split("\n").length +
          "\n\n" + safe.slice(0, 4000)
      });
      setTab("Run");
      return;
    }

    setRunState({
      parsed: {},
      output: `No browser runner is registered for .${ext || "unknown"} files yet.\n\nThe file can still be inspected normally.`
    });
    setTab("Run");
  }

  return (
    <div className="github-app">
      <header className="topbar">
        <div className="brand">
          <div className="octocat">●</div>
          <strong>GitHub</strong>
        </div>
        <div className="global-search">
          <span>{icons.search}</span>
          <input
            aria-label="Search this repository"
            placeholder="Search or jump to..."
            value={query}
            onChange={e => setQuery(e.target.value)}
          />
          <kbd>/</kbd>
        </div>
        <nav className="top-links">
          <a href={repoUrl}>Pull requests</a>
          <a href={repoUrl}>Issues</a>
          <a href={repoUrl}>Marketplace</a>
          <a href={repoUrl}>Explore</a>
        </nav>
      </header>

      <main>
        <section className="repo-head">
          <div className="repo-title">
            <span className="repo-icon">◉</span>
            <a href={`https://github.com/${OWNER}`}>{OWNER}</a>
            <span>/</span>
            <strong>{REPO}</strong>
            <span className="public-pill">Public</span>
          </div>
          <div className="repo-actions">
            <button>☆ Star</button>
            <button>⌁ Fork</button>
            <button onClick={() => window.open(repoUrl, "_blank")}>GitHub ↗</button>
          </div>
        </section>

        <nav className="repo-tabs">
          {["Code", "Issues", "Pull requests", "Actions", "Projects", "Security", "Insights"].map(item => (
            <button
              key={item}
              className={tab === item ? "active" : ""}
              onClick={() => setTab(item)}
            >
              {item}
            </button>
          ))}
        </nav>

        <section className="workspace">
          <aside className="sidebar">
            <div className="sidebar-head">
              <button className="branch">{icons.branch} main⌄</button>
              <button onClick={loadTree}>↻</button>
            </div>
            <div className="tree">
              {loading && <div className="muted">Loading repository…</div>}
              {!loading && rootFiles.map(item => (
                <button
                  className={currentFile?.path === item.path ? "tree-item selected" : "tree-item"}
                  key={item.path}
                  onClick={() => item.type === "blob" ? openFile(item.path) : setPath(item.path)}
                >
                  <span>{item.type === "tree" ? icons.folder : icons.file}</span>
                  <span>{item.path}</span>
                </button>
              ))}
            </div>
          </aside>

          <section className="content">
            <div className="breadcrumb">
              <span>{OWNER}</span><b>/</b><span>{REPO}</span>
              {currentFile && <><b>/</b><strong>{currentFile.path}</strong></>}
            </div>

            {!currentFile ? (
              <div className="repo-card">
                <div className="card-head">
                  <span>main</span>
                  <span className="muted">{tree.filter(x => x.type === "blob").length} files</span>
                </div>
                {tree.filter(x => x.type === "blob").map(file => (
                  <button className="file-row" key={file.path} onClick={() => openFile(file.path)}>
                    <span className="file-name">{icons.file} {file.path}</span>
                    <span className="muted">Open</span>
                  </button>
                ))}
              </div>
            ) : (
              <div className="code-shell">
                <div className="code-toolbar">
                  <div>
                    <strong>{currentFile.path}</strong>
                    <span className="muted"> · main</span>
                  </div>
                  <div className="toolbar-actions">
                    <button onClick={() => setTab("Code")}>Code</button>
                    <button className="run-button" onClick={runCurrent}>{icons.run} Run</button>
                    <button onClick={() => window.open(`${repoUrl}/blob/main/${currentFile.path}`, "_blank")}>Open on GitHub</button>
                  </div>
                </div>

                <div className="code-layout">
                  <div className="line-numbers">
                    {currentFile.content.split("\n").map((_, i) => <span key={i}>{i + 1}</span>)}
                  </div>
                  <pre className="code">
                    <code>{currentFile.content}</code>
                  </pre>
                </div>

                {tab === "Run" && runState && (
                  <div className="runner">
                    <div className="runner-head">
                      <strong>Run</strong>
                      <button onClick={() => setRunState(null)}>×</button>
                    </div>
                    <div className="runner-grid">
                      <div>
                        <h3>Parser</h3>
                        <pre>{JSON.stringify(runState.parsed, null, 2)}</pre>
                      </div>
                      <div>
                        <h3>Output</h3>
                        <pre>{runState.output}</pre>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {fileLoading && <div className="loading-overlay">Loading file…</div>}
            {error && <div className="error">{error}</div>}
          </section>
        </section>
      </main>
    </div>
  );
}

export default App;
