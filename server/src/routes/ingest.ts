import { Router } from "express";
import multer from "multer";
import { chunk } from "../lib/chunker.js";
import { embed } from "../lib/embed.js";
import { upsert } from "../lib/vector.js";
import { extractPdf } from "../lib/pdf.js";

export const ingestRouter = Router();

// text -> chunks -> Voyage embed (batched) -> Pinecone upsert. (Unchanged; the eval harness uses this.)
ingestRouter.post("/ingest", async (req, res) => {
  const { text, source, chunkTokens, overlapRatio } = req.body ?? {};
  if (typeof text !== "string" || !text.trim()) {
    return res.status(400).json({ error: "text (non-empty string) is required" });
  }
  const src = typeof source === "string" && source ? source : "untitled";
  const chunks = chunk(text, src, chunkTokens, overlapRatio);
  try {
    const { vectors, tokens } = await embed(chunks.map((c) => c.text), "document");
    await upsert(chunks, vectors);
    res.json({ chunkCount: chunks.length, embedTokens: tokens });
  } catch (err) {
    res.status(502).json({ error: "ingestion failed", detail: String(err) });
  }
});

// Digital PDFs only (embedded text layer). Scanned PDFs need OCR — out of scope, rejected below.
const upload = multer({
  storage: multer.memoryStorage(), // free tier: no disk writes
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype === "application/pdf") cb(null, true);
    else cb(new Error("invalid_file_type"));
  },
});

ingestRouter.post("/ingest/pdf", (req, res) => {
  upload.single("file")(req, res, async (err) => {
    if (err) {
      if (err.code === "LIMIT_FILE_SIZE") {
        return res.status(413).json({ error: "file_too_large", message: "PDF exceeds the 10 MB limit." });
      }
      if (err.message === "invalid_file_type") {
        return res.status(400).json({ error: "invalid_file_type", message: "Only PDF files are accepted." });
      }
      return res.status(400).json({ error: "upload_failed", message: String(err) });
    }
    if (!req.file) {
      return res.status(400).json({ error: "invalid_file_type", message: "No PDF file was provided (field name 'file')." });
    }

    // Extract text. Wrap so a corrupt/encrypted PDF never crashes the process.
    let text: string;
    let pageCount: number;
    try {
      ({ text, pageCount } = await extractPdf(req.file.buffer));
    } catch {
      return res.status(422).json({ error: "parse_failed", message: "Could not read this PDF — it may be corrupt or password-protected." });
    }

    // Scanned-PDF guardrail: no real text layer -> near-empty extraction.
    const cleaned = text.replace(/\s+/g, " ").trim();
    if (cleaned.length < 100) {
      return res.status(422).json({
        error: "no_text_layer",
        message: "This PDF has no extractable text. It's likely scanned — OCR isn't supported.",
      });
    }

    const source = req.file.originalname; // so citations name the document
    const chunks = chunk(text, source);
    try {
      const { vectors, tokens } = await embed(chunks.map((c) => c.text), "document");
      await upsert(chunks, vectors);
      // Same shape as the JSON path, plus pageCount — client doesn't branch on ingest type.
      res.json({ chunkCount: chunks.length, embedTokens: tokens, pageCount });
    } catch (e) {
      res.status(502).json({ error: "ingestion failed", detail: String(e) });
    }
  });
});
