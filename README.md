# DocsAgent — RAG Support Assistant

**Live demo:** https://client-two-navy-33.vercel.app · **API:** https://docsagent-api.onrender.com/health

> A HighLevel help-center document is pre-loaded — ask it something like *"Which plan includes
> SaaS Mode and what does it cost?"* or an off-topic question to see the guardrail decline.
> The API runs on a free tier, so the first request after idle may take ~30s to wake.

Upload product documentation, ask questions in natural language, and get answers grounded
**only** in those documents — with source citations and a live token / latency / cost
readout. Built with Claude (generation), Voyage (embeddings), and Pinecone (vectors).

The differentiator isn't the chat box. It's the three things around it:

- **Guardrails** — if retrieval returns nothing relevant, Claude is never called; the
  assistant returns a fallback instead of inventing an answer.
- **Structured output + validation** — every answer is Zod-validated JSON
  (`{answer, sources, confidence}`); a malformed reply is retried once, then fails gracefully.
- **Telemetry + evaluation** — per-request tokens, latency, and estimated cost, plus a scored
  20-question eval harness with before/after tuning numbers.

---

## Architecture

```
┌──────────────┐
│  React UI    │  upload · chat · citations · cost panel
└──────┬───────┘
       │ HTTP
┌──────▼─────────────────────────────────────┐
│  Node.js + Express                         │
│  POST /ingest                              │
│    text → chunker → Voyage embed → Pinecone│
│  POST /query                               │
│    question → Voyage embed                 │
│             → Pinecone top-k               │
│             → guardrail: empty? → bail     │
│             → Claude + context             │
│             → Zod validate → retry once    │
│             → log telemetry                │
└────────────────────────────────────────────┘
   ┌───────┐    ┌───────────┐   ┌─────────┐
   │Voyage │    │ Pinecone  │   │ Claude  │
   │embed  │    │ vectors   │   │ answer  │
   └───────┘    └───────────┘   └─────────┘
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
| Generation | Claude API (`claude-sonnet-4-6` default; `claude-opus-4-8` for the demo) |
| Embeddings | Voyage `voyage-3-lite` (512-dim) |
| Vector store | Pinecone (serverless) |
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
PINECONE_INDEX=docsagent
PORT=3001
# optional tuning knobs
ANTHROPIC_MODEL=claude-sonnet-4-6
TOP_K=4
GUARD_MIN_SCORE=0.35
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

- **Chunk size / top-k / overlap** — chosen from the eval numbers above, not by feel.
- **Guardrail threshold** (`GUARD_MIN_SCORE`) — a single global cosine floor. Below it,
  retrieval is treated as empty and Claude is skipped. Calibrate on the eval set; a real
  physical knob, not a constant to hardcode blindly.
- **Batched embeddings** — all chunks embed in one Voyage call, not one per chunk. The single
  biggest cost/latency win in the pipeline.
- **Decoupled providers** — see architecture note above.

## Deliberately cut for scope

| Cut | Why |
|---|---|
| Multi-turn memory | Single-turn Q&A proves the pipeline |
| Auth | Not what's being demonstrated |
| Multi-file management | One doc, one chat box |
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
