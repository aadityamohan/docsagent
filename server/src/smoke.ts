import "dotenv/config";
import { AnswerSchema } from "./lib/claude.js";

// Behavioural smoke test (not a quality score — that's `npm run eval`). Verifies guardrails
// fire, malformed input is handled, and telemetry is populated. Run against local or prod:
//   npm run smoke            (http://localhost:3001)
//   SMOKE_API_URL=https://docsagent-api.onrender.com npm run smoke
const BASE = process.env.SMOKE_API_URL || "http://localhost:3001";

type Res = { status: number; data: any };
async function query(body: unknown): Promise<Res> {
  const r = await fetch(`${BASE}/query`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  let data: any = null;
  try { data = await r.json(); } catch { /* non-JSON body */ }
  return { status: r.status, data };
}

function assert(cond: unknown, msg: string): void {
  if (!cond) throw new Error(msg);
}

// Assertions that must hold on every non-error /query response.
function checkAnswered(d: any): void {
  assert(d && d.telemetry, "telemetry missing");
  assert(typeof d.telemetry.latencyMs === "number", "telemetry.latencyMs missing");
  assert(typeof d.telemetry.retrievedChunks === "number", "telemetry.retrievedChunks missing");
  const c = d.telemetry.costUSD;
  assert(typeof c === "number" && !Number.isNaN(c) && c >= 0, "telemetry.costUSD is not a number >= 0");
  // Validates against the same Zod schema the server uses to shape the answer.
  AnswerSchema.parse({ answer: d.answer, sources: d.sources, confidence: d.confidence });
}

type Case = { n: number; name: string; run: () => Promise<void> };

const cases: Case[] = [
  {
    n: 1,
    name: "saas mode plan",
    run: async () => {
      const { status, data } = await query({ question: "Which plan includes SaaS Mode and what does it cost?" });
      assert(status === 200, `status ${status}`);
      checkAnswered(data);
      assert(!data.guardrailTriggered, "unexpected guardrail on an answerable question");
      assert(Array.isArray(data.sources) && data.sources.length > 0, "sources empty");
      assert(data.confidence !== "low", "confidence is low");
    },
  },
  {
    n: 2,
    name: "reworded resell question",
    run: async () => {
      const { status, data } = await query({ question: "How much do I pay monthly if I want to resell this to my clients?" });
      assert(status === 200, `status ${status}`);
      checkAnswered(data);
      assert(!data.guardrailTriggered && data.telemetry.outputTokens > 0, "should answer, not guardrail");
      assert(/497/.test(data.answer), "expected the $497 SaaS Pro price in the answer");
    },
  },
  {
    n: 3,
    name: "cross-chunk starter vs unlimited",
    run: async () => {
      const { status, data } = await query({ question: "What's the difference between the Starter and Unlimited plans?" });
      assert(status === 200, `status ${status}`);
      checkAnswered(data);
      const distinct = new Set((data.citations ?? []).map((c: any) => `${c.source}#${c.chunkIndex}`));
      assert(distinct.size >= 2, `expected >= 2 distinct chunks, got ${distinct.size}`);
    },
  },
  {
    n: 4,
    name: "capital of france (guardrail)",
    run: async () => {
      const { status, data } = await query({ question: "What is the capital of France?" });
      assert(status === 200, `status ${status}`);
      checkAnswered(data);
      // The highest-value check: off-topic must short-circuit before the LLM.
      assert(data.telemetry.outputTokens === 0, "guardrail should short-circuit before the LLM (outputTokens > 0 → GUARD_MIN_SCORE too loose)");
      assert(data.guardrailTriggered === true, "guardrailTriggered should be true");
      assert(data.sources.length === 0, "sources should be empty");
    },
  },
  {
    n: 5,
    name: "life insurance (guardrail)",
    run: async () => {
      const { status, data } = await query({ question: "Does HighLevel offer life insurance to customers?" });
      assert(status === 200, `status ${status}`);
      checkAnswered(data);
      assert(data.telemetry.outputTokens === 0, "guardrail should short-circuit before the LLM (outputTokens > 0 → GUARD_MIN_SCORE too loose)");
      assert(data.guardrailTriggered === true, "guardrailTriggered should be true");
      assert(data.sources.length === 0, "sources should be empty");
    },
  },
  {
    n: 6,
    name: "empty input",
    run: async () => {
      const { status, data } = await query({ question: "" });
      assert(status === 400, `expected 400, got ${status}`);
      assert(data && data.error, "expected a clean error body");
    },
  },
  {
    n: 7,
    name: "5k random words",
    run: async () => {
      const words = Array.from({ length: 850 }, () => Math.random().toString(36).slice(2, 8));
      const q = words.join(" ").slice(0, 5000);
      const { status, data } = await query({ question: q });
      assert(status === 200, `status ${status}`);
      checkAnswered(data);
      assert(data.guardrailTriggered === true, "expected guardrail to fire on random noise");
    },
  },
];

async function main() {
  console.log(`Smoke testing ${BASE}\n`);
  const rows: { n: number; name: string; pass: boolean; detail: string; latency: number; cost: number }[] = [];

  for (const c of cases) {
    const start = Date.now();
    try {
      await c.run();
      rows.push({ n: c.n, name: c.name, pass: true, detail: "", latency: Date.now() - start, cost: 0 });
    } catch (e) {
      rows.push({ n: c.n, name: c.name, pass: false, detail: e instanceof Error ? e.message : String(e), latency: Date.now() - start, cost: 0 });
    }
  }

  console.log("#  case                            result   time");
  for (const r of rows) {
    console.log(
      `${String(r.n).padEnd(2)} ${r.name.padEnd(31)} ${(r.pass ? "PASS" : "FAIL").padEnd(7)} ${r.latency}ms` +
        (r.pass ? "" : `\n     └─ ${r.detail}`)
    );
  }

  const passed = rows.filter((r) => r.pass).length;
  console.log(`\n${passed}/${rows.length} passed`);
  if (passed < rows.length) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
