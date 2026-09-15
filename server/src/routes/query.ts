import { Router } from "express";
import { embed, EMBED_MODEL } from "../lib/embed.js";
import { query } from "../lib/vector.js";
import { answer, MODEL } from "../lib/claude.js";
import { estimateCostUSD } from "../lib/pricing.js";
import { logTelemetry } from "../telemetry.js";

export const queryRouter = Router();

const TOP_K = Number(process.env.TOP_K) || 4;
// Guardrail floor: if the best cosine match is below this, treat retrieval as empty.
// ponytail: single global threshold, tune on the eval set (Day 5); per-doc thresholds if recall suffers.
const MIN_SCORE = Number(process.env.GUARD_MIN_SCORE) || 0.35;

const FALLBACK = "I don't have that information in the documentation.";

queryRouter.post("/query", async (req, res) => {
  const { question, topK } = req.body ?? {};
  if (typeof question !== "string" || !question.trim()) {
    return res.status(400).json({ error: "question (non-empty string) is required" });
  }
  const k = Number(topK) || TOP_K;
  const start = Date.now();

  try {
    const { vectors, tokens: embedTokens } = await embed([question], "query");
    const matches = await query(vectors[0], k);

    // Guardrail: nothing relevant -> don't call Claude at all. Saves tokens, removes the hallucination path.
    const relevant = matches.filter((m) => m.score >= MIN_SCORE);
    if (relevant.length === 0) {
      const latencyMs = Date.now() - start;
      const costUSD = estimateCostUSD({ model: MODEL, inputTokens: 0, outputTokens: 0, embedModel: EMBED_MODEL, embedTokens });
      logTelemetry({
        ts: new Date().toISOString(), question, inputTokens: 0, outputTokens: 0,
        embedTokens, retrievedChunks: 0, latencyMs, costUSD, guardrailTriggered: true,
      });
      return res.json({
        answer: FALLBACK, sources: [], confidence: "low", guardrailTriggered: true,
        citations: [], telemetry: { inputTokens: 0, outputTokens: 0, embedTokens, retrievedChunks: 0, latencyMs, costUSD },
      });
    }

    const { answer: a, inputTokens, outputTokens } = await answer(question, relevant);
    const latencyMs = Date.now() - start;
    const costUSD = estimateCostUSD({ model: MODEL, inputTokens, outputTokens, embedModel: EMBED_MODEL, embedTokens });

    logTelemetry({
      ts: new Date().toISOString(), question, inputTokens, outputTokens,
      embedTokens, retrievedChunks: relevant.length, latencyMs, costUSD, guardrailTriggered: false,
    });

    res.json({
      answer: a.answer, sources: a.sources, confidence: a.confidence, guardrailTriggered: false,
      citations: relevant.map((m) => ({ source: m.source, chunkIndex: m.chunkIndex, score: m.score, text: m.text })),
      telemetry: { inputTokens, outputTokens, embedTokens, retrievedChunks: relevant.length, latencyMs, costUSD },
    });
  } catch (err) {
    res.status(502).json({ error: "query failed", detail: String(err) });
  }
});
