import { appendFileSync } from "node:fs";
import { join } from "node:path";

export type Telemetry = {
  ts: string;
  question: string;
  inputTokens: number;
  outputTokens: number;
  embedTokens: number;
  retrievedChunks: number;
  latencyMs: number;
  costUSD: number;
  guardrailTriggered: boolean;
};

const LOG = join(process.cwd(), "telemetry.jsonl");

// JSON-lines file is enough — no database for this (per the spec's Day 4 note).
export function logTelemetry(t: Telemetry): void {
  try {
    appendFileSync(LOG, JSON.stringify(t) + "\n");
  } catch {
    // logging must never break a request
  }
}
