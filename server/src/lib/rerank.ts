import { voyageClient } from "./embed.js";
import type { Match } from "./vector.js";

export const RERANK_MODEL = "rerank-2.5-lite";

export type RerankResult = { matches: Match[]; tokens: number };

// Second stage: re-score the retrieved candidates for true query relevance. A cross-encoder
// reranker separates plausible-but-off-topic questions from real ones far better than cosine
// similarity — e.g. "life insurance?" reranks ~0.39 while a legit reworded query reranks ~0.59,
// even though their cosine scores are indistinguishable (~0.51). Returned matches carry the
// rerank relevance score in `.score`, sorted best-first.
export async function rerank(question: string, matches: Match[]): Promise<RerankResult> {
  if (matches.length === 0) return { matches: [], tokens: 0 };
  const res: any = await voyageClient().rerank({
    query: question,
    documents: matches.map((m) => m.text),
    model: RERANK_MODEL,
  });
  const results = res.data ?? res.results ?? [];
  const reranked: Match[] = results
    .map((r: any) => ({ ...matches[r.index], score: r.relevanceScore ?? r.relevance_score ?? 0 }))
    .sort((a: Match, b: Match) => b.score - a.score);
  const tokens: number = res.usage?.totalTokens ?? res.totalTokens ?? 0;
  return { matches: reranked, tokens };
}
