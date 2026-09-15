import { VoyageAIClient } from "voyageai";

// voyage-3-lite was retired after the MongoDB acquisition; voyage-3.5-lite is its successor.
// It defaults to 1024-dim but supports 512 via outputDimension — we request 512 to match the
// existing Pinecone index (no rebuild needed).
export const EMBED_MODEL = "voyage-3.5-lite";
export const EMBED_DIM = 512;

// Voyage is now part of MongoDB. Model API keys created in MongoDB Atlas ("al-…") hit
// ai.mongodb.com, not the legacy api.voyageai.com. Override via VOYAGE_BASE_URL; leave it
// unset (empty) only if you have a legacy "pa-…" Voyage platform key.
const VOYAGE_BASE_URL = process.env.VOYAGE_BASE_URL || "https://ai.mongodb.com/v1";

let client: VoyageAIClient | null = null;
// Shared Voyage client — used by both embed() and rerank().
export function voyageClient(): VoyageAIClient {
  if (!client) {
    client = new VoyageAIClient({
      apiKey: process.env.VOYAGE_API_KEY,
      maxRetries: 5, // free tier is 3 RPM without a payment method — ride out 429s
      ...(VOYAGE_BASE_URL ? { baseUrl: VOYAGE_BASE_URL } : {}),
    });
  }
  return client;
}

export type EmbedResult = { vectors: number[][]; tokens: number };

// Batched embedding — one Voyage call for many texts. This is the biggest cost/latency
// win in the pipeline: N chunks = 1 request, not N.
export async function embed(
  texts: string[],
  inputType: "document" | "query"
): Promise<EmbedResult> {
  if (texts.length === 0) return { vectors: [], tokens: 0 };
  const res: any = await voyageClient().embed({
    input: texts,
    model: EMBED_MODEL,
    inputType,
    outputDimension: EMBED_DIM,
  });
  const vectors: number[][] = (res.data ?? []).map((d: any) => d.embedding);
  const tokens: number = res.usage?.totalTokens ?? res.totalTokens ?? 0;
  return { vectors, tokens };
}
