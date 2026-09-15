import { Router } from "express";
import { chunk } from "../lib/chunker.js";
import { embed } from "../lib/embed.js";
import { upsert } from "../lib/vector.js";

export const ingestRouter = Router();

// text -> chunks -> Voyage embed (batched) -> Pinecone upsert.
ingestRouter.post("/ingest", async (req, res) => {
  const { text, source, chunkTokens, overlapRatio } = req.body ?? {};
  if (typeof text !== "string" || !text.trim()) {
    return res.status(400).json({ error: "text (non-empty string) is required" });
  }
  const src = typeof source === "string" && source ? source : "untitled";
  const chunks = chunk(text, src, chunkTokens, overlapRatio);
  try {
    const { vectors, tokens } = await embed(chunks.map((c) => c.text), "document");
    await upsert(chunks, vectors);
    res.json({ chunkCount: chunks.length, embedTokens: tokens });
  } catch (err) {
    res.status(502).json({ error: "ingestion failed", detail: String(err) });
  }
});
