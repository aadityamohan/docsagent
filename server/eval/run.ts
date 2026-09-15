import "dotenv/config";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { chunk } from "../src/lib/chunker.js";
import { embed } from "../src/lib/embed.js";
import { upsert, query, clearNamespace, ensureIndex } from "../src/lib/vector.js";
import { answer, judge } from "../src/lib/claude.js";

type Q = { q: string; expectedContains: string | null; expected: string; type: string };

const MIN_SCORE = Number(process.env.GUARD_MIN_SCORE) || 0.35;
const FALLBACK = "I don't have that information in the documentation.";

// One tuning config = one experiment row. Vary chunkTokens / topK / overlap here.
type Config = { name: string; chunkTokens: number; overlapRatio: number; topK: number };
const CONFIGS: Config[] = [
  { name: "baseline (400 / k1 / 10%)", chunkTokens: 400, overlapRatio: 0.1, topK: 1 },
  { name: "top-k 2", chunkTokens: 400, overlapRatio: 0.1, topK: 2 },
  { name: "top-k 4", chunkTokens: 400, overlapRatio: 0.1, topK: 4 },
  { name: "chunk 600 / k4", chunkTokens: 600, overlapRatio: 0.1, topK: 4 },
  { name: "chunk 600 / k4 / 20% overlap", chunkTokens: 600, overlapRatio: 0.2, topK: 4 },
];

async function ingestConfig(text: string, cfg: Config, ns: string) {
  await clearNamespace(ns);
  const chunks = chunk(text, "highlevel", cfg.chunkTokens, cfg.overlapRatio);
  const { vectors } = await embed(chunks.map((c) => c.text), "document");
  await upsert(chunks, vectors, ns);
}

async function runConfig(questions: Q[], qVectors: number[][], cfg: Config, ns: string) {
  let hits = 0, hitDenom = 0, correct = 0, correctDenom = 0;

  for (let qi = 0; qi < questions.length; qi++) {
    const item = questions[qi];
    const matches = await query(qVectors[qi], cfg.topK, ns);
    const relevant = matches.filter((m) => m.score >= MIN_SCORE);

    // Retrieval hit rate (answerable questions only): expected text present in a retrieved chunk.
    if (item.type !== "fallback" && item.expectedContains) {
      hitDenom++;
      if (matches.some((m) => m.text.includes(item.expectedContains!))) hits++;
    }

    // Answer correctness. Unified: if the guardrail fired we produced the fallback string;
    // otherwise Claude answered. Judge the produced text against the expected answer.
    // For fallback questions expected is a decline, so both the retrieval guardrail AND
    // Claude's own "I don't have that information" count as correct (defense in depth).
    correctDenom++;
    const produced = relevant.length === 0 ? FALLBACK : (await answer(item.q, relevant)).answer.answer;
    if (await judge(item.q, produced, item.expected)) correct++;
  }

  return {
    config: cfg.name,
    hitRate: hitDenom ? (hits / hitDenom) : 0,
    correctness: correct / correctDenom,
  };
}

async function main() {
  const text = readFileSync(join(process.cwd(), "data", "highlevel.md"), "utf8");
  const questions = JSON.parse(readFileSync(join(process.cwd(), "eval", "questions.json"), "utf8")) as Q[];

  await ensureIndex();

  // Query embeddings don't depend on chunk config — embed all questions once and reuse.
  const { vectors: qVectors } = await embed(questions.map((q) => q.q), "query");

  const rows: { config: string; hitRate: number; correctness: number }[] = [];
  for (const cfg of CONFIGS) {
    const ns = "eval-" + cfg.name.replace(/[^a-z0-9]+/gi, "-").toLowerCase();
    process.stderr.write(`Running ${cfg.name}...\n`);
    await ingestConfig(text, cfg, ns);
    rows.push(await runConfig(questions, qVectors, cfg, ns));
  }

  console.log("\n| Config | Retrieval hit rate | Answer correctness |");
  console.log("|---|---|---|");
  for (const r of rows) {
    console.log(`| ${r.config} | ${(r.hitRate * 100).toFixed(0)}% | ${(r.correctness * 100).toFixed(0)}% |`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
