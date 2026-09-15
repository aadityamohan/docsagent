import "dotenv/config";
import express from "express";
import cors from "cors";
import { ingestRouter } from "./routes/ingest.js";
import { queryRouter } from "./routes/query.js";

const app = express();
app.use(cors());
app.use(express.json({ limit: "5mb" }));

app.get("/health", (_req, res) => res.json({ ok: true }));
app.use(ingestRouter);
app.use(queryRouter);

const port = Number(process.env.PORT) || 3001;
app.listen(port, () => console.log(`DocsAgent API on :${port}`));
