export type Chunk = { id: string; text: string; source: string; chunkIndex: number };

// Token count is approximated as chars/4 — good enough for chunking, no tokenizer needed.
// chunkTokens / overlapRatio are params because Day 5 tuning varies them.
export function chunk(
  text: string,
  source: string,
  chunkTokens = 600,
  overlapRatio = 0.15
): Chunk[] {
  const clean = text.replace(/\r\n/g, "\n").trim();
  const size = chunkTokens * 4; // chars per chunk
  const step = Math.max(1, Math.floor(size * (1 - overlapRatio)));
  if (clean.length <= size) {
    return clean ? [{ id: `${source}-0`, text: clean, source, chunkIndex: 0 }] : [];
  }

  const chunks: Chunk[] = [];
  let i = 0;
  for (let start = 0; start < clean.length; start += step) {
    chunks.push({
      id: `${source}-${i}`,
      text: clean.slice(start, start + size),
      source,
      chunkIndex: i,
    });
    i++;
  }
  return chunks;
}
