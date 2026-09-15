import { useState } from "react";

const API = import.meta.env.VITE_API_URL || "http://localhost:3001";

type Citation = { source: string; chunkIndex: number; score: number; text: string };
type Telemetry = {
  inputTokens: number;
  outputTokens: number;
  embedTokens: number;
  retrievedChunks: number;
  latencyMs: number;
  costUSD: number;
};
type QueryResponse = {
  answer: string;
  sources: string[];
  confidence: "high" | "medium" | "low";
  guardrailTriggered: boolean;
  citations: Citation[];
  telemetry: Telemetry;
};

export default function App() {
  const [text, setText] = useState("");
  const [source, setSource] = useState("");
  const [ingestMsg, setIngestMsg] = useState("");
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [resp, setResp] = useState<QueryResponse | null>(null);
  const [error, setError] = useState("");
  const [showCitations, setShowCitations] = useState(false);

  async function ingest() {
    setIngestMsg("Ingesting…");
    try {
      const r = await fetch(`${API}/ingest`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, source: source || "untitled" }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || "failed");
      setIngestMsg(`Ingested ${data.chunkCount} chunks (${data.embedTokens} embed tokens).`);
      setText("");
    } catch (e) {
      setIngestMsg("Error: " + String(e));
    }
  }

  async function ask() {
    if (!question.trim()) return;
    setLoading(true);
    setError("");
    setResp(null);
    try {
      const r = await fetch(`${API}/query`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || "failed");
      setResp(data);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="wrap">
      <header>
        <h1>DocsAgent</h1>
        <p className="sub">RAG support assistant · grounded answers · guardrails · cost telemetry</p>
      </header>

      <details className="panel">
        <summary>Upload a document</summary>
        <input
          className="input"
          placeholder="Source name (e.g. highlevel)"
          value={source}
          onChange={(e) => setSource(e.target.value)}
        />
        <textarea
          className="textarea"
          placeholder="Paste document text…"
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={6}
        />
        <button className="btn" onClick={ingest} disabled={!text.trim()}>
          Ingest
        </button>
        {ingestMsg && <p className="msg">{ingestMsg}</p>}
      </details>

      <section className="panel">
        <div className="row">
          <input
            className="input"
            placeholder="Ask a question about the docs…"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && ask()}
          />
          <button className="btn" onClick={ask} disabled={loading}>
            {loading ? "…" : "Ask"}
          </button>
        </div>

        {error && <p className="err">{error}</p>}

        {resp && (
          <div className="answer">
            <div className="answer-head">
              <span className={`badge conf-${resp.confidence}`}>{resp.confidence}</span>
              {resp.guardrailTriggered && <span className="badge guard">guardrail</span>}
            </div>
            <p className="answer-text">{resp.answer}</p>

            {resp.citations.length > 0 && (
              <div>
                <button className="link" onClick={() => setShowCitations((s) => !s)}>
                  {showCitations ? "Hide" : "Show"} sources ({resp.citations.length})
                </button>
                {showCitations && (
                  <ul className="cites">
                    {resp.citations.map((c, i) => (
                      <li key={i}>
                        <div className="cite-meta">
                          {c.source} · chunk {c.chunkIndex} · score {c.score.toFixed(3)}
                        </div>
                        <div className="cite-text">{c.text}</div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            <div className="telemetry">
              <span>⏱ {resp.telemetry.latencyMs} ms</span>
              <span>🔢 in {resp.telemetry.inputTokens} / out {resp.telemetry.outputTokens} tok</span>
              <span>🔎 {resp.telemetry.embedTokens} embed tok</span>
              <span>📄 {resp.telemetry.retrievedChunks} chunks</span>
              <span>💲 ${resp.telemetry.costUSD.toFixed(6)}</span>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
