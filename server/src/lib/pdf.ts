import { PDFParse } from "pdf-parse";

// pdf-parse v2 is class-based (v1's default-function export is gone). Digital PDFs only —
// it reads the embedded text layer; scanned PDFs return near-empty text (caught by the caller).
export async function extractPdf(buffer: Buffer): Promise<{ text: string; pageCount: number }> {
  const parser = new PDFParse({ data: buffer });
  try {
    const result = await parser.getText();
    return { text: result.text, pageCount: result.total };
  } finally {
    await parser.destroy();
  }
}
