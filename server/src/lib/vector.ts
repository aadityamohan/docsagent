import { Pinecone } from "@pinecone-database/pinecone";
import { EMBED_DIM } from "./embed.js";
import type { Chunk } from "./chunker.js";

const INDEX_NAME = process.env.PINECONE_INDEX || "docsagent";

let pc: Pinecone | null = null;
function client(): Pinecone {
  if (!pc) pc = new Pinecone({ apiKey: process.env.PINECONE_API_KEY! });
  return pc;
}
function index() {
  return client().index(INDEX_NAME);
}

// Create the serverless index on first run if it doesn't exist (free tier: aws/us-east-1).
export async function ensureIndex(): Promise<void> {
  await client().createIndex({
    name: INDEX_NAME,
    dimension: EMBED_DIM,
    metric: "cosine",
    spec: { serverless: { cloud: "aws", region: "us-east-1" } },
    waitUntilReady: true,
    suppressConflicts: true,
  } as any);
}

export type Match = {
  id: string;
  score: number;
  text: string;
  source: string;
  chunkIndex: number;
};

// namespace lets the eval runner isolate each tuning config (chunk size / overlap)
// without clobbering the default demo data.
export async function upsert(chunks: Chunk[], vectors: number[][], namespace = ""): Promise<void> {
  const records = chunks.map((c, i) => ({
    id: c.id,
    values: vectors[i],
    metadata: { text: c.text, source: c.source, chunkIndex: c.chunkIndex },
  }));
  // Pinecone caps batch size; 100 is safe.
  const ns = index().namespace(namespace);
  for (let i = 0; i < records.length; i += 100) {
    await ns.upsert({ records: records.slice(i, i + 100) });
  }
}

export async function query(vector: number[], topK = 4, namespace = ""): Promise<Match[]> {
  const res = await index()
    .namespace(namespace)
    .query({ vector, topK, includeMetadata: true } as any);
  return (res.matches ?? []).map((m) => ({
    id: m.id,
    score: m.score ?? 0,
    text: String(m.metadata?.text ?? ""),
    source: String(m.metadata?.source ?? ""),
    chunkIndex: Number(m.metadata?.chunkIndex ?? 0),
  }));
}

export async function clearNamespace(namespace: string): Promise<void> {
  try {
    await index().namespace(namespace).deleteAll();
  } catch {
    // namespace may not exist yet — fine.
  }
}
