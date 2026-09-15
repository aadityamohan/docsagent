import assert from "node:assert";
import { chunk } from "../src/lib/chunker.js";

// Smallest runnable check for the money path: chunking with overlap.
const text = "x".repeat(10_000);
const chunks = chunk(text, "t", 600, 0.15); // size=2400 chars, step=2040

assert(chunks.length > 1, "long text must split into multiple chunks");
assert(chunks.every((c) => c.text.length <= 2400), "no chunk exceeds size");
assert(chunks[0].chunkIndex === 0 && chunks[1].chunkIndex === 1, "sequential indices");

// Overlap: chunk 1 starts at step=2040, chunk 0 ends at 2400 -> 360 chars overlap.
const overlap = chunks[0].text.slice(2040);
assert(chunks[1].text.startsWith(overlap), "consecutive chunks overlap");

// Short text -> single chunk.
const one = chunk("hello world", "t");
assert(one.length === 1 && one[0].text === "hello world", "short text is one chunk");

// Empty text -> no chunks.
assert(chunk("   ", "t").length === 0, "blank text yields no chunks");

console.log("chunker checks passed");
