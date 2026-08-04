import { Router } from "express";
import multer from "multer";
import { createRequire } from "module";
const require = createRequire(import.meta.url);
// pdf-parse ESM build has no default export; load the CJS build via require
// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdfParse = require("pdf-parse") as (
  dataBuffer: Buffer,
  options?: Record<string, unknown>
) => Promise<{ text: string; numpages: number }>;
import { db } from "@workspace/db";
import { documentsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { generateEmbeddings } from "../lib/openai";
import {
  ensureIndex,
  upsertChunks,
  deleteDocumentChunks,
} from "../lib/pinecone";
import { chunkText } from "../lib/chunker";

const router = Router();

// Store files in memory for processing
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 }, // 50 MB
  fileFilter: (_req, file, cb) => {
    if (file.mimetype === "application/pdf") {
      cb(null, true);
    } else {
      cb(new Error("Only PDF files are allowed"));
    }
  },
});

router.get("/documents", async (req, res) => {
  try {
    const docs = await db.select().from(documentsTable).orderBy(documentsTable.createdAt);
    res.json(
      docs.map((d) => ({
        id: d.id,
        filename: d.filename,
        originalName: d.originalName,
        status: d.status,
        chunkCount: d.chunkCount,
        createdAt: d.createdAt.toISOString(),
        errorMessage: d.errorMessage ?? null,
      }))
    );
  } catch (err) {
    req.log.error({ err }, "Failed to list documents");
    res.status(500).json({ error: "Failed to list documents" });
  }
});

router.get("/documents/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const [doc] = await db
      .select()
      .from(documentsTable)
      .where(eq(documentsTable.id, id));
    if (!doc) {
      res.status(404).json({ error: "Document not found" });
      return;
    }
    res.json({
      id: doc.id,
      filename: doc.filename,
      originalName: doc.originalName,
      status: doc.status,
      chunkCount: doc.chunkCount,
      createdAt: doc.createdAt.toISOString(),
      errorMessage: doc.errorMessage ?? null,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to get document");
    res.status(500).json({ error: "Failed to get document" });
  }
});

router.post(
  "/documents",
  upload.single("file"),
  async (req, res) => {
    try {
      if (!req.file) {
        res.status(400).json({ error: "No PDF file provided" });
        return;
      }

      const originalName = req.file.originalname;
      const filename = `${Date.now()}-${originalName}`;

      // Insert with pending status
      const [doc] = await db
        .insert(documentsTable)
        .values({
          filename,
          originalName,
          status: "pending",
          chunkCount: 0,
        })
        .returning();

      // Respond immediately so UI can show "processing"
      res.status(201).json({
        id: doc.id,
        filename: doc.filename,
        originalName: doc.originalName,
        status: doc.status,
        chunkCount: doc.chunkCount,
        createdAt: doc.createdAt.toISOString(),
        errorMessage: doc.errorMessage ?? null,
      });

      // Process in the background
      setImmediate(() =>
        ingestDocument(doc.id, originalName, req.file!.buffer)
      );
    } catch (err) {
      req.log.error({ err }, "Failed to upload document");
      res.status(500).json({ error: "Failed to upload document" });
    }
  }
);

router.delete("/documents/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const [doc] = await db
      .select()
      .from(documentsTable)
      .where(eq(documentsTable.id, id));
    if (!doc) {
      res.status(404).json({ error: "Document not found" });
      return;
    }

    // Delete vectors from Pinecone
    try {
      await deleteDocumentChunks(id);
    } catch (_err) {
      // Best-effort — continue even if Pinecone delete fails
    }

    await db.delete(documentsTable).where(eq(documentsTable.id, id));
    res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, "Failed to delete document");
    res.status(500).json({ error: "Failed to delete document" });
  }
});

async function ingestDocument(
  docId: number,
  originalName: string,
  buffer: Buffer
): Promise<void> {
  try {
    // Mark as processing
    await db
      .update(documentsTable)
      .set({ status: "processing" })
      .where(eq(documentsTable.id, docId));

    // Ensure Pinecone index exists
    await ensureIndex();

    // Parse PDF
    const parsed = await pdfParse(buffer);
    const rawText = parsed.text;

    if (!rawText || rawText.trim().length === 0) {
      throw new Error("Could not extract text from PDF");
    }

    // Chunk the text
    const chunks = chunkText(rawText);

    if (chunks.length === 0) {
      throw new Error("No text chunks generated from PDF");
    }

    // Generate embeddings in batches of 50
    const batchSize = 50;
    const allEmbeddings: number[][] = [];
    for (let i = 0; i < chunks.length; i += batchSize) {
      const batch = chunks.slice(i, i + batchSize);
      const embeddings = await generateEmbeddings(batch);
      allEmbeddings.push(...embeddings);
    }

    // Build Pinecone vectors
    const vectors = chunks.map((text, i) => ({
      id: `doc-${docId}-chunk-${i}`,
      embedding: allEmbeddings[i],
      metadata: {
        documentId: docId,
        documentName: originalName,
        chunkIndex: i,
        text,
      },
    }));

    await upsertChunks(vectors);

    // Mark as ready
    await db
      .update(documentsTable)
      .set({ status: "ready", chunkCount: chunks.length })
      .where(eq(documentsTable.id, docId));
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    await db
      .update(documentsTable)
      .set({ status: "error", errorMessage: message })
      .where(eq(documentsTable.id, docId))
      .catch(() => undefined);
  }
}

export default router;
