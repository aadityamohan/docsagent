import { useEffect, useRef, useState } from "react";

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

function fmtSize(bytes: number): string {
  return bytes < 1024 * 1024 ? `${(bytes / 1024).toFixed(0)} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

// Per-browser session id → isolates each user's uploaded docs into their own Pinecone namespace
// (multi-tenancy). Before any upload, queries fall back to the shared pre-loaded demo corpus.
function getSessionId(): string {
  let s = localStorage.getItem("docsagent-session");
  if (!s) {
    s = crypto.randomUUID();
    localStorage.setItem("docsagent-session", s);
  }
  return s;
}

export default function App() {
  const [text, setText] = useState("");
  const [source, setSource] = useState("");
  const [ingestMsg, setIngestMsg] = useState("");
  const [pdf, setPdf] = useState<File | null>(null);
  const [pdfLoading, setPdfLoading] = useState(false);
  const pdfInput = useRef<HTMLInputElement>(null);
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [resp, setResp] = useState<QueryResponse | null>(null);
  const [error, setError] = useState("");
  const [showCitations, setShowCitations] = useState(false);
  // Task C: free-tier API sleeps after idle; ping /health on mount so the first-request wait is explained, not dead air.
  const [waking, setWaking] = useState(true);
  const sessionId = useRef(getSessionId()).current;

  useEffect(() => {
    fetch(`${API}/health`).catch(() => {}).finally(() => setWaking(false));
  }, []);

  async function ingestText() {
    setIngestMsg("Ingesting…");
    try {
      const r = await fetch(`${API}/ingest`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, source: source || "untitled", sessionId }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.message || data.error || "failed");
      setIngestMsg(`Ingested ${data.chunkCount} chunks (${data.embedTokens} embed tokens).`);
      setText("");
    } catch (e) {
      setIngestMsg("Error: " + (e instanceof Error ? e.message : String(e)));
    }
  }

  async function ingestPdf() {
    if (!pdf) return;
    setPdfLoading(true);
    setIngestMsg("Parsing PDF…");
    try {
      const form = new FormData();
      form.append("file", pdf); // do NOT set Content-Type — the browser sets the multipart boundary
      form.append("sessionId", sessionId);
      const r = await fetch(`${API}/ingest/pdf`, { method: "POST", body: form });
      const data = await r.json();
      if (!r.ok) throw new Error(data.message || data.error || "failed");
      setIngestMsg(`Ingested "${pdf.name}" — ${data.chunkCount} chunks${data.pageCount ? `, ${data.pageCount} pages` : ""}.`);
      setPdf(null);
      if (pdfInput.current) pdfInput.current.value = "";
    } catch (e) {
      setIngestMsg("Error: " + (e instanceof Error ? e.message : String(e)));
    } finally {
      setPdfLoading(false);
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
        body: JSON.stringify({ question, sessionId }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.message || data.error || "failed");
      setResp(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="wrap">
      {waking && <div className="waking">Waking the API — the first request after idle takes ~30s…</div>}

      <header>
        <h1>DocsAgent</h1>
        <p className="sub">RAG support assistant · grounded answers · guardrails · cost telemetry</p>
        <p className="tag">📚 Pre-loaded with HighLevel's help-center docs — ask about plans, workflows, SaaS Mode, or upload your own.</p>
      </header>

      <details className="panel">
        <summary>Upload a document</summary>

        <div className="upload-block">
          <label className="label">Paste text</label>
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
            rows={5}
          />
          <button className="btn" onClick={ingestText} disabled={!text.trim()}>
            Ingest text
          </button>
        </div>

        <div className="or">— or —</div>

        <div className="upload-block">
          <label className="label">Upload a PDF <span className="hint">(digital / text-based only — scanned PDFs aren't supported)</span></label>
          <input
            ref={pdfInput}
            className="input"
            type="file"
            accept="application/pdf,.pdf"
            onChange={(e) => setPdf(e.target.files?.[0] ?? null)}
          />
          {pdf && (
            <p className="msg">
              {pdf.name} · {fmtSize(pdf.size)}
            </p>
          )}
          <button className="btn" onClick={ingestPdf} disabled={!pdf || pdfLoading}>
            {pdfLoading ? "Parsing…" : "Ingest PDF"}
          </button>
        </div>

        {ingestMsg && <p className={ingestMsg.startsWith("Error") ? "err" : "msg"}>{ingestMsg}</p>}
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
