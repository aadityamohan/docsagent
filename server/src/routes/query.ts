import { Router } from "express";
import { embed, EMBED_MODEL } from "../lib/embed.js";
import { query, cleanNamespace } from "../lib/vector.js";
import { rerank } from "../lib/rerank.js";
import { answer, MODEL } from "../lib/claude.js";
import { estimateCostUSD } from "../lib/pricing.js";
import { logTelemetry } from "../telemetry.js";

export const queryRouter = Router();

const RETRIEVE_K = Number(process.env.RETRIEVE_K) || 8; // candidates pulled from Pinecone for reranking
const TOP_K = Number(process.env.TOP_K) || 4; // reranked chunks handed to Claude
// Guardrail floor on the RERANK relevance score (not cosine). Below this, retrieval is treated
// as irrelevant and Claude is never called. Reranking makes this threshold meaningful: it
// separates plausible-but-absent questions (~0.39) from real ones (~0.59), which cosine cannot.
const RERANK_MIN_SCORE = Number(process.env.RERANK_MIN_SCORE) || 0.45;

const FALLBACK = "I don't have that information in the documentation.";

queryRouter.post("/query", async (req, res) => {
  const { question, sessionId } = req.body ?? {};
  if (typeof question !== "string" || !question.trim()) {
    return res.status(400).json({ error: "question (non-empty string) is required" });
  }
  const namespace = cleanNamespace(sessionId); // "" = shared demo corpus
  const start = Date.now();

  try {
    const { vectors, tokens: embedTokens } = await embed([question], "query");
    let candidates = await query(vectors[0], RETRIEVE_K, namespace);
    // A session that hasn't uploaded anything falls back to the shared demo corpus.
    if (candidates.length === 0 && namespace) {
      candidates = await query(vectors[0], RETRIEVE_K, "");
    }

    // Stage 2: rerank the candidates, then guardrail on the top relevance score.
    const { matches: reranked, tokens: rerankTokens } = await rerank(question, candidates);
    const voyageTokens = embedTokens + rerankTokens;
    const top = reranked.slice(0, TOP_K);

    const irrelevant = top.length === 0 || top[0].score < RERANK_MIN_SCORE;
    if (irrelevant) {
      const latencyMs = Date.now() - start;
      const costUSD = estimateCostUSD({ model: MODEL, inputTokens: 0, outputTokens: 0, embedModel: EMBED_MODEL, embedTokens: voyageTokens });
      logTelemetry({
        ts: new Date().toISOString(), question, inputTokens: 0, outputTokens: 0,
        embedTokens: voyageTokens, retrievedChunks: 0, latencyMs, costUSD, guardrailTriggered: true,
      });
      return res.json({
        answer: FALLBACK, sources: [], confidence: "low", guardrailTriggered: true,
        citations: [], telemetry: { inputTokens: 0, outputTokens: 0, embedTokens: voyageTokens, retrievedChunks: 0, latencyMs, costUSD },
      });
    }

    const { answer: a, inputTokens, outputTokens } = await answer(question, top);
    const latencyMs = Date.now() - start;
    const costUSD = estimateCostUSD({ model: MODEL, inputTokens, outputTokens, embedModel: EMBED_MODEL, embedTokens: voyageTokens });

    logTelemetry({
      ts: new Date().toISOString(), question, inputTokens, outputTokens,
      embedTokens: voyageTokens, retrievedChunks: top.length, latencyMs, costUSD, guardrailTriggered: false,
    });

    res.json({
      answer: a.answer, sources: a.sources, confidence: a.confidence, guardrailTriggered: false,
      citations: top.map((m) => ({ source: m.source, chunkIndex: m.chunkIndex, score: m.score, text: m.text })),
      telemetry: { inputTokens, outputTokens, embedTokens: voyageTokens, retrievedChunks: top.length, latencyMs, costUSD },
    });
  } catch (err) {
    res.status(502).json({ error: "query failed", detail: String(err) });
  }
});
