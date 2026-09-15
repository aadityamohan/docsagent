import "dotenv/config";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { chunk } from "../src/lib/chunker.js";
import { embed } from "../src/lib/embed.js";
import { upsert, ensureIndex } from "../src/lib/vector.js";

// Pre-load the demo document so a recruiter can query it in one click.
async function main() {
  const path = join(process.cwd(), "data", "highlevel.md");
  const text = readFileSync(path, "utf8");
  await ensureIndex();
  const chunks = chunk(text, "highlevel");
  const { vectors, tokens } = await embed(chunks.map((c) => c.text), "document");
  await upsert(chunks, vectors);
  console.log(`Seeded ${chunks.length} chunks from highlevel.md (${tokens} embed tokens).`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
