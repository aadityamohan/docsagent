# DocsAgent — RAG Support Assistant

**Live demo:** https://docsagent.vercel.app · **API:** https://docsagent-api.onrender.com/health

> A HighLevel help-center document is pre-loaded — ask it something like *"Which plan includes
> SaaS Mode and what does it cost?"* or an off-topic question to see the guardrail decline.
> The API runs on a free tier, so the first request after idle may take ~30s to wake.

Upload product documentation (paste text **or upload a PDF**), ask questions in natural
language, and get answers grounded **only** in those documents — with source citations and a
live token / latency / cost readout. Built with Claude (generation), Voyage (embeddings +
reranking), and Pinecone (vectors).

The differentiator isn't the chat box. It's the things around it:

- **Two-stage retrieval with a real guardrail** — Pinecone returns candidates by cosine
  similarity, then a Voyage **reranker** re-scores them for true relevance. If the top reranked
  score is below the floor, Claude is never called and the assistant returns a fallback instead
  of inventing an answer. (Cosine alone couldn't do this — see *Trade-offs*.)
- **Structured output + validation** — every answer is Zod-validated JSON
  (`{answer, sources, confidence}`); a malformed reply is retried once, then fails gracefully.
- **Telemetry + evaluation** — per-request tokens, latency, and estimated cost, plus a scored
  20-question eval harness (retrieval tuning) and a `npm run smoke` behavioural test suite.

---

## Architecture

```
┌──────────────┐
│  React UI    │  upload · chat · citations · cost panel
└──────┬───────┘
       │ HTTP
┌──────▼──────────────────────────────────────────┐
│  Node.js + Express                              │
│  POST /ingest  ·  POST /ingest/pdf              │
│    text | PDF → chunker → Voyage embed → Pinecone│
│  POST /query                                    │
│    question → Voyage embed                       │
│             → Pinecone top-k (candidates)        │
│             → Voyage rerank                       │
│             → guardrail: top rerank < floor? bail│
│             → Claude + context                    │
│             → Zod validate → retry once           │
│             → log telemetry                       │
└──────────────────────────────────────────────────┘
   ┌────────────┐   ┌───────────┐   ┌─────────┐
   │Voyage      │   │ Pinecone  │   │ Claude  │
   │embed+rerank│   │ vectors   │   │ answer  │
   └────────────┘   └───────────┘   └─────────┘
```

**Why embeddings and generation come from different providers:** Anthropic doesn't ship an
embeddings API — it recommends Voyage. So retrieval (Voyage) and generation (Claude) are
deliberately decoupled: either layer can be swapped without touching the other, and embedding
cost is optimised independently of generation cost.

---

## Stack

| Layer | Choice |
|---|---|
| Frontend | React + TypeScript + Vite |
| Backend | Node.js + Express |
| Generation | Claude API (`claude-haiku-4-5` default; `claude-opus-4-8` for the demo) |
| Embeddings | Voyage `voyage-3.5-lite` (512-dim) |
| Reranking | Voyage `rerank-2.5-lite` |
| Vector store | Pinecone (serverless) |
| PDF parsing | `pdf-parse` (digital PDFs only) |
| Validation | Zod |

---

## Setup

### 1. Create the three API keys and the Pinecone index

- Anthropic, Voyage, and Pinecone API keys.
- Pinecone index: name `docsagent`, **dimension `512`** (must match `voyage-3-lite`), metric
  `cosine`, serverless.

### 2. Server

```bash
cd server
npm install
cp .env.example .env   # fill in the three keys
npm run check          # chunker self-check, no keys needed
npm run seed           # pre-load the demo HighLevel doc
npm run dev            # API on :3001
```

`.env`:

```
ANTHROPIC_API_KEY=
VOYAGE_API_KEY=
PINECONE_API_KEY=
ANTHROPIC_WORKSPACE_ID=      # only if your key is org-level, not workspace-scoped
PINECONE_INDEX=docsagent
VOYAGE_BASE_URL=https://ai.mongodb.com/v1
PORT=3001
# optional tuning knobs
ANTHROPIC_MODEL=claude-haiku-4-5
RETRIEVE_K=8                 # candidates pulled from Pinecone before reranking
TOP_K=4                      # reranked chunks handed to Claude
RERANK_MIN_SCORE=0.45        # guardrail floor on the top rerank relevance score
```

### 3. Client

```bash
cd client
npm install
cp .env.example .env    # VITE_API_URL=http://localhost:3001
npm run dev             # UI on :5173
```

---

## Evaluation

The eval harness ingests the demo doc under a separate Pinecone namespace per config, runs all
20 questions, and scores two metrics:

1. **Retrieval hit rate** — was the expected passage in the top-k?
2. **Answer correctness** — Claude-as-judge comparing the answer to a reference.

The 20 questions include deliberately hard cases: answers that span two chunks, questions
reworded away from the source text, and questions the docs genuinely don't answer (which must
trigger the fallback).

```bash
cd server
npm run eval
```

### Results

Measured on the demo HighLevel corpus, 20 questions, `voyage-3.5-lite` embeddings, judged by
`claude-haiku-4-5`. Correctness uses an LLM judge, so it carries minor run-to-run variance.

| Config | Retrieval hit rate | Answer correctness |
|---|---|---|
| baseline (400 / k1 / 10%) | 83% | 90% |
| top-k 2 | 100% | 100% |
| top-k 4 | 100% | 100% |
| chunk 600 / k4 | 100% | 100% |
| chunk 600 / k4 / 20% overlap | 100% | 95% |

**Headline:** raised retrieval hit rate from **83% → 100%** (and answer correctness 90% → 100%)
by raising top-k from 1 to 2. At top-k 1 the assistant missed the cross-chunk and reworded
questions — their answer chunk wasn't the single best match; widening top-k recovered them
without hurting precision. Beyond top-k 4 the corpus saturates, so the win is in top-k, not
chunk size, on a document this size.

Re-run any time with `npm run eval`.

### Smoke tests

`npm run eval` scores retrieval *quality*; `npm run smoke` checks *behaviour* end to end against
a running API — guardrails fire, malformed input is handled, telemetry is populated. It runs
against local or production:

```bash
npm run smoke                                                   # http://localhost:3001
SMOKE_API_URL=https://docsagent-api.onrender.com npm run smoke  # prod
```

The highest-value assertion, on every off-topic case: `telemetry.outputTokens === 0`. If Claude
produced any output on a question the docs don't answer, the guardrail is decorative rather than
real. The suite exits non-zero on any failure so it can be wired into CI.

> Note: the Voyage free tier is capped at 3 requests/min. Since each query makes two Voyage
> calls (embed + rerank), add a payment method in MongoDB Atlas (the 200M free-token allowance
> still applies) to run the full suite — and the demo — without rate-limit stalls.

---

## Cost & latency

Every `/query` response includes a `telemetry` block and each request is appended to
`server/telemetry.jsonl`:

```json
{ "inputTokens": 812, "outputTokens": 96, "embedTokens": 9,
  "retrievedChunks": 4, "latencyMs": 1240, "costUSD": 0.000662 }
```

Cost is computed from published rates (`server/src/lib/pricing.ts`) — no guessing.

---

## Trade-offs

- **Reranker guardrail, not a cosine threshold** — the guardrail first tried a cosine-similarity
  floor. On this corpus that fails: a plausible-but-absent question ("Does HighLevel offer life
  insurance?") scores cosine **0.52**, *higher* than a legitimate reworded question (**0.51**),
  because the docs are dense with sales/customer language. No single threshold separates them.
  A Voyage reranker does: it scores the off-topic question **0.39** and the legit one **0.59** —
  cleanly separable. The `npm run smoke` suite surfaced this, and the reranker fixed it. Cost is
  one extra Voyage call per query.
- **Chunk size / top-k / overlap** — chosen from the eval numbers above, not by feel.
- **Batched embeddings** — all chunks embed in one Voyage call, not one per chunk. The single
  biggest cost/latency win in the pipeline.
- **Decoupled providers** — see architecture note above.

## Deliberately cut for scope

| Cut | Why |
|---|---|
| OCR / scanned PDFs | Digital (text-layer) PDFs only; scanned pages need OCR (Tesseract / Vision) — extraction, not RAG. A scanned upload returns a clear `no_text_layer` error, not a silent empty success |
| Multi-turn memory | Single-turn Q&A proves the pipeline |
| Auth | Not what's being demonstrated |
| Streaming | Nice to have, not evidence of anything |

---

## Deploy

Deployed as a public GitHub repo → Render (API) + Vercel (UI).

- **Backend → Render:** a `render.yaml` blueprint provisions the `docsagent-api` web service
  (root `server/`, build `npm install`, start `npm run start`). The three non-secret env vars
  are baked into the blueprint; the four secrets (`ANTHROPIC_API_KEY`, `ANTHROPIC_WORKSPACE_ID`,
  `VOYAGE_API_KEY`, `PINECONE_API_KEY`) are set in the Render dashboard. The demo doc is already
  in Pinecone (cloud), so no re-seed is needed after deploy.
- **Frontend → Vercel:** root `client/`, framework auto-detected (Vite). Set the build-time env
  var `VITE_API_URL` to the Render API URL so the UI calls the deployed backend.
