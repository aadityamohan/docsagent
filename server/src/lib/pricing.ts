// Published rates per 1M tokens (USD). Update if Anthropic/Voyage change pricing.
// ponytail: hardcoded table, not a live API — the rates move rarely; edit here when they do.
export const MODEL_PRICING: Record<string, { in: number; out: number }> = {
  "claude-sonnet-4-6": { in: 3, out: 15 },
  "claude-haiku-4-5": { in: 1, out: 5 },
  "claude-opus-4-8": { in: 5, out: 25 },
};

// Voyage rates ~$0.02 / 1M tokens (embed + rerank alike; free tier during dev).
export const VOYAGE_PRICING: Record<string, number> = {
  "voyage-3.5-lite": 0.02,
  "voyage-3-lite": 0.02,
};

export function estimateCostUSD(args: {
  model: string;
  inputTokens: number;
  outputTokens: number;
  embedModel: string;
  embedTokens: number;
}): number {
  const m = MODEL_PRICING[args.model] ?? { in: 0, out: 0 };
  const v = VOYAGE_PRICING[args.embedModel] ?? 0;
  const gen = (args.inputTokens * m.in + args.outputTokens * m.out) / 1_000_000;
  const embed = (args.embedTokens * v) / 1_000_000;
  return gen + embed;
}
