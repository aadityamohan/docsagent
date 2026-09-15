import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import type { Match } from "./vector.js";

// Cheapest capable default for iterating; switch to claude-opus-4-8 for the final demo.
export const MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-4-6";

let client: Anthropic | null = null;
function anthropic(): Anthropic {
  if (!client) {
    // Org-level (non-workspace-scoped) keys must send the workspace id as a header.
    // Set ANTHROPIC_WORKSPACE_ID in .env, or use a workspace-scoped key and leave it blank.
    const wsId = process.env.ANTHROPIC_WORKSPACE_ID;
    client = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
      ...(wsId ? { defaultHeaders: { "anthropic-workspace-id": wsId } } : {}),
    });
  }
  return client;
}

export const AnswerSchema = z.object({
  answer: z.string(),
  sources: z.array(z.string()),
  confidence: z.enum(["high", "medium", "low"]),
});
export type Answer = z.infer<typeof AnswerSchema>;

const SYSTEM = `You are a documentation support assistant.
Answer the user's question using ONLY the provided context passages.
If the context does not contain the answer, say you do not have that information. Never guess or use outside knowledge.
Respond with ONLY a JSON object, no prose and no markdown fences, in exactly this shape:
{"answer": string, "sources": string[], "confidence": "high" | "medium" | "low"}
"sources" lists the source names of the passages you actually used.`;

function buildContext(chunks: Match[]): string {
  return chunks
    .map((c, i) => `[Passage ${i + 1} — source: ${c.source}]\n${c.text}`)
    .join("\n\n");
}

function parseJson(text: string): unknown {
  const cleaned = text.trim().replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  return JSON.parse(cleaned);
}

export type AnswerResult = { answer: Answer; inputTokens: number; outputTokens: number };

// Calls Claude, validates with Zod, retries once on malformed output, then fails gracefully.
export async function answer(question: string, chunks: Match[]): Promise<AnswerResult> {
  const context = buildContext(chunks);
  const user = `Context:\n${context}\n\nQuestion: ${question}`;
  let inputTokens = 0;
  let outputTokens = 0;

  for (let attempt = 0; attempt < 2; attempt++) {
    const res = await anthropic().messages.create({
      model: MODEL,
      max_tokens: 1024,
      system: attempt === 0 ? SYSTEM : SYSTEM + "\nYour previous reply was not valid JSON. Return ONLY the JSON object.",
      messages: [{ role: "user", content: user }],
    });
    inputTokens += res.usage.input_tokens;
    outputTokens += res.usage.output_tokens;
    const textBlock = res.content.find((b) => b.type === "text");
    const raw = textBlock && textBlock.type === "text" ? textBlock.text : "";
    try {
      const parsed = AnswerSchema.parse(parseJson(raw));
      return { answer: parsed, inputTokens, outputTokens };
    } catch {
      // fall through to retry
    }
  }

  // Both attempts malformed — graceful fallback, don't throw.
  return {
    answer: {
      answer: "I couldn't produce a reliable answer from the documentation. Please try rephrasing.",
      sources: [],
      confidence: "low",
    },
    inputTokens,
    outputTokens,
  };
}

// Day 5: Claude-as-judge. Returns true if the produced answer matches the expected answer.
export async function judge(question: string, produced: string, expected: string): Promise<boolean> {
  const res = await anthropic().messages.create({
    model: MODEL,
    max_tokens: 8,
    system:
      "You grade a support answer against a reference answer. Reply with exactly one word: CORRECT or WRONG. CORRECT means the produced answer conveys the same key facts as the reference (wording may differ).",
    messages: [
      {
        role: "user",
        content: `Question: ${question}\n\nReference answer: ${expected}\n\nProduced answer: ${produced}`,
      },
    ],
  });
  const block = res.content.find((b) => b.type === "text");
  const verdict = block && block.type === "text" ? block.text.toUpperCase() : "";
  return verdict.includes("CORRECT");
}
