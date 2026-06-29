import { Router, type IRouter, type Request, type Response } from "express";
import multer from "multer";
import { db, documentsTable, chunksTable } from "@workspace/db";
import { eq, and, count, inArray, sql, isNull } from "drizzle-orm";
import { getCurrentUserId } from "../../lib/ownership";
import {
  GetDocumentParams,
  DeleteDocumentParams,
  GetDocumentChunksParams,
  ListDocumentsResponse,
  GetDocumentResponse,
  GetDocumentChunksResponse,
} from "@workspace/api-zod";
import { extractAndChunk, getFileType, type SupportedFileType } from "../../lib/text-extractor";
import * as fileStore from "../../lib/file-store";
import { loadAiConfig } from "../../lib/ai";
import { getEmbeddingModelName } from "../../lib/ai/embedding";

const router: IRouter = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

function docToResponse(
  doc: typeof documentsTable.$inferSelect,
  chunkCount: number,
  includeFullText = false,
) {
  return {
    id: doc.id,
    fileName: doc.fileName,
    fileType: doc.fileType,
    fileSize: doc.fileSize ?? null,
    uploadedAt: doc.uploadedAt.toISOString(),
    chunkCount,
    extractedTextPreview: doc.extractedText?.slice(0, 200) ?? null,
    extractedText: includeFullText ? (doc.extractedText ?? null) : null,
    extractionStatus: doc.extractionStatus,
    extractionError: doc.extractionError ?? null,
    storageProvider: doc.storageProvider ?? null,
    storageKey: doc.storageKey ?? null,
    originalFileAvailable: Boolean(doc.storageKey),
  };
}

const STORAGE_FILE_MISSING_MESSAGE =
  "Original file is missing from storage — re-upload the document or attach the file again.";

function respondStorageFileMissing(
  req: Request,
  res: Response,
  context: { documentId: number; storageKey: string },
  logMessage: string,
): void {
  req.log.warn(
    { documentId: context.documentId, storageKey: context.storageKey },
    logMessage,
  );
  res.status(404).json({ error: STORAGE_FILE_MISSING_MESSAGE });
}

function isDatabaseConfigError(err: unknown): boolean {
  return err instanceof Error && err.message.includes("DATABASE_URL must be set");
}

function isDatabaseConnectionError(err: unknown): boolean {
  if (isDatabaseConfigError(err)) return true;
  if (!(err instanceof Error)) return false;
  const message = err.message.toLowerCase();
  return ["econnrefused", "enotfound", "timeout", "terminating connection", "database"].some((token) =>
    message.includes(token),
  );
}

router.get("/documents", async (req, res): Promise<void> => {
  const userId = getCurrentUserId(req);
  if (!userId) {
    res.status(401).json({ error: "Unauthorized." });
    return;
  }
  try {
    const limit = Math.min(Math.max(parseInt(req.query.limit as string, 10) || 50, 1), 200);
    const offset = Math.max(parseInt(req.query.offset as string, 10) || 0, 0);

    const totalResult = await db
      .select({ count: count(documentsTable.id) })
      .from(documentsTable)
      .where(and(eq(documentsTable.ownerUserId, userId), isNull(documentsTable.deletedAt)));
    const total = totalResult[0]?.count ?? 0;

    const docs = await db
      .select()
      .from(documentsTable)
      .where(and(eq(documentsTable.ownerUserId, userId), isNull(documentsTable.deletedAt)))
      .orderBy(documentsTable.uploadedAt)
      .limit(limit)
      .offset(offset);

    // Scope the chunk-count query to the returned documents.
    const docIds = docs.map((d) => d.id);
    const chunksCountResult = docIds.length
      ? await db
          .select({ documentId: chunksTable.documentId, cnt: count(chunksTable.id) })
          .from(chunksTable)
          .where(inArray(chunksTable.documentId, docIds))
          .groupBy(chunksTable.documentId)
      : [];

    const chunkMap = new Map(chunksCountResult.map((r) => [r.documentId, r.cnt]));
    const items = docs.map((doc) => docToResponse(doc, chunkMap.get(doc.id) ?? 0));

    res.json({ items, total, limit, offset });
  } catch (err) {
    req.log.error({ err }, "Failed to list documents");
    if (isDatabaseConnectionError(err)) {
      res.status(503).json({ error: "Documents are temporarily unavailable because the database is not reachable." });
      return;
    }
    res.status(500).json({ error: "Failed to list documents due to a server error." });
  }
});

router.post(
  "/documents/upload",
  upload.single("file"),
  async (req: Request, res: Response): Promise<void> => {
    const userId = getCurrentUserId(req);
    if (!userId) {
      res.status(401).json({ error: "Unauthorized." });
      return;
    }

    const file = (req as Request & { file?: Express.Multer.File }).file;
    if (!file) {
      res.status(400).json({ error: "No file uploaded" });
      return;
    }

    const fileType = getFileType(file.mimetype, file.originalname);
    if (!fileType) {
      res
        .status(400)
        .json({ error: "Unsupported file type. Allowed: PDF, DOCX, TXT, CSV, XLSX, XLS" });
      return;
    }

    // ── 1. Save original file to object storage (durable storage is required) ──
    if (!fileStore.isConfigured()) {
      req.log.error("Object storage is not configured — refusing non-durable upload");
      res.status(503).json({ error: "Durable file storage is not configured. Upload rejected." });
      return;
    }

    let storageKey: string;
    const storageProvider = fileStore.getStorageProviderName();
    try {
      const mimeType = fileStore.getMimeType(fileType);
      storageKey = await fileStore.uploadFile(file.buffer, file.originalname, mimeType);
    } catch (err) {
      req.log.error({ err }, "Failed to save original file to object storage");
      res.status(500).json({ error: "Failed to store uploaded file" });
      return;
    }

    // ── 2. Extract text + chunks ──────────────────────────────────────────────
    let extractedText: string | null = null;
    let extractedChunks: string[] = [];
    let extractionStatus = "failed";
    let extractionError: string | null = null;

    try {
      const extraction = await extractAndChunk(file.buffer, fileType, file.originalname);
      extractedText = extraction.text;
      extractedChunks = extraction.chunks;
      for (const warning of extraction.warnings) {
        req.log.warn({ fileName: file.originalname, fileType, warning }, "Extraction warning");
      }
      if (!extractedText.trim()) {
        extractionError = "No text could be extracted from the file";
      } else {
        extractionStatus = "success";
      }
    } catch (err) {
      req.log.error({ err }, "Failed to extract text");
      extractionError = (err as Error).message ?? "Extraction failed";
    }

    // ── 3 & 4. Persist document + chunks; clean up stored file on failure ──────
    let doc: typeof documentsTable.$inferSelect;
    let chunkCount = 0;
    try {
      [doc] = await db
        .insert(documentsTable)
        .values({
          ownerUserId: userId,
          fileName: file.originalname,
          fileType,
          fileSize: file.size,
          extractedText,
          extractionStatus,
          extractionError,
          storageProvider,
          storageKey,
        })
        .returning();

      if (extractionStatus === "success" && extractedChunks.length > 0) {
        await db.insert(chunksTable).values(
          extractedChunks.map((content, i) => ({ documentId: doc.id, chunkIndex: i, content }))
        );
        chunkCount = extractedChunks.length;
      }
    } catch (err) {
      req.log.error({ err }, "Failed to persist document — removing orphaned file from storage");
      try {
        await fileStore.deleteFile(storageKey);
      } catch (cleanupErr) {
        req.log.error({ err: cleanupErr, storageKey }, "Failed to clean up orphaned file after DB error");
      }
      res.status(500).json({ error: "Failed to save document" });
      return;
    }

    if (extractionStatus === "failed") {
      req.log.warn(
        { documentId: doc.id, fileName: file.originalname, fileType, fileSize: file.size, extractionError },
        "Upload stored but text extraction failed",
      );
      res.status(207).json({
        ...docToResponse(doc, chunkCount),
        warning: "Original file stored, but text extraction failed. Re-index to retry. " + (extractionError ?? ""),
      });
      return;
    }

    req.log.info(
      { documentId: doc.id, fileName: file.originalname, fileType, fileSize: file.size, chunkCount },
      "Upload succeeded",
    );
    res.status(201).json(docToResponse(doc, chunkCount));
  }
);

router.get("/documents/:id", async (req, res): Promise<void> => {
  const userId = getCurrentUserId(req);
  if (!userId) {
    res.status(401).json({ error: "Unauthorized." });
    return;
  }
  const params = GetDocumentParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [doc] = await db
    .select()
    .from(documentsTable)
    .where(and(eq(documentsTable.id, params.data.id), eq(documentsTable.ownerUserId, userId), isNull(documentsTable.deletedAt)));
  if (!doc) {
    res.status(404).json({ error: "Document not found" });
    return;
  }

  const [{ cnt }] = await db
    .select({ cnt: count(chunksTable.id) })
    .from(chunksTable)
    .where(eq(chunksTable.documentId, doc.id));

  res.json(GetDocumentResponse.parse(docToResponse(doc, cnt, true)));
});

router.delete("/documents/:id", async (req, res): Promise<void> => {
  const userId = getCurrentUserId(req);
  if (!userId) {
    res.status(401).json({ error: "Unauthorized." });
    return;
  }
  const params = DeleteDocumentParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [doc] = await db
    .select()
    .from(documentsTable)
    .where(and(eq(documentsTable.id, params.data.id), eq(documentsTable.ownerUserId, userId), isNull(documentsTable.deletedAt)));

  if (!doc) {
    res.status(404).json({ error: "Document not found" });
    return;
  }

  // Soft delete: set deletedAt and deletedBy instead of removing records
  await db
    .update(documentsTable)
    .set({ deletedAt: new Date(), deletedBy: userId })
    .where(eq(documentsTable.id, doc.id));

  res.sendStatus(204);
});

router.get("/documents/:id/chunks", async (req, res): Promise<void> => {
  const userId = getCurrentUserId(req);
  if (!userId) {
    res.status(401).json({ error: "Unauthorized." });
    return;
  }
  const params = GetDocumentChunksParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  // Verify the document belongs to the current user before exposing its chunks.
  const [doc] = await db
    .select({ id: documentsTable.id })
    .from(documentsTable)
    .where(and(eq(documentsTable.id, params.data.id), eq(documentsTable.ownerUserId, userId), isNull(documentsTable.deletedAt)));
  if (!doc) {
    res.status(404).json({ error: "Document not found" });
    return;
  }

  const chunks = await db
    .select()
    .from(chunksTable)
    .where(eq(chunksTable.documentId, params.data.id))
    .orderBy(chunksTable.chunkIndex);

  res.json(GetDocumentChunksResponse.parse(chunks));
});

// ── GET /documents/:id/original — download the stored original file ──────────
router.get("/documents/:id/original", async (req, res): Promise<void> => {
  const userId = getCurrentUserId(req);
  if (!userId) {
    res.status(401).json({ error: "Unauthorized." });
    return;
  }
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid document ID" });
    return;
  }

  const [doc] = await db
    .select()
    .from(documentsTable)
    .where(and(eq(documentsTable.id, id), eq(documentsTable.ownerUserId, userId), isNull(documentsTable.deletedAt)));
  if (!doc) {
    res.status(404).json({ error: "Document not found" });
    return;
  }
  if (!doc.storageKey) {
    res.status(404).json({ error: "Original file is not available — this document was uploaded before durable file storage was enabled" });
    return;
  }

  let buffer: Buffer;
  try {
    buffer = await fileStore.downloadFile(doc.storageKey);
  } catch (err) {
    if (fileStore.isStorageFileNotFoundError(err)) {
      respondStorageFileMissing(req, res, { documentId: id, storageKey: doc.storageKey }, "Stored original file missing from disk");
      return;
    }
    req.log.error({ err }, "Failed to retrieve original file from storage");
    res.status(500).json({ error: "Failed to retrieve original file from storage" });
    return;
  }

  const mimeType = fileStore.getMimeType(doc.fileType);
  res.set({
    "Content-Type": mimeType,
    "Content-Disposition": `attachment; filename="${doc.fileName}"`,
    "Content-Length": String(buffer.length),
  });
  res.send(buffer);
});

// ── PUT /documents/:id/original — attach or replace the stored original file ─
router.put(
  "/documents/:id/original",
  upload.single("file"),
  async (req: Request, res: Response): Promise<void> => {
    const userId = getCurrentUserId(req);
    if (!userId) {
      res.status(401).json({ error: "Unauthorized." });
      return;
    }
    const id = parseInt(req.params.id as string, 10);
    if (isNaN(id)) {
      res.status(400).json({ error: "Invalid document ID" });
      return;
    }

    const file = (req as Request & { file?: Express.Multer.File }).file;
    if (!file) {
      res.status(400).json({ error: "No file uploaded" });
      return;
    }

    const [doc] = await db
      .select()
      .from(documentsTable)
      .where(and(eq(documentsTable.id, id), eq(documentsTable.ownerUserId, userId), isNull(documentsTable.deletedAt)));
    if (!doc) {
      res.status(404).json({ error: "Document not found" });
      return;
    }

    // Validate file type matches the document's stored type.
    const fileType = getFileType(file.mimetype, file.originalname);
    if (!fileType || fileType.toLowerCase() !== doc.fileType.toLowerCase()) {
      res.status(400).json({
        error: `File type mismatch: this document is ${doc.fileType.toUpperCase()}. Please upload a ${doc.fileType.toUpperCase()} file.`,
      });
      return;
    }

    if (!fileStore.isConfigured()) {
      res.status(400).json({ error: "Durable file storage is not configured." });
      return;
    }

    // Delete the existing stored file to avoid orphaned objects.
    if (doc.storageKey) {
      try {
        await fileStore.deleteFile(doc.storageKey);
      } catch (err) {
        req.log.warn({ err, storageKey: doc.storageKey }, "Could not delete previous stored file before replacement");
      }
    }

    let storageKey: string;
    const storageProvider = fileStore.getStorageProviderName();
    try {
      const mimeType = fileStore.getMimeType(fileType);
      storageKey = await fileStore.uploadFile(file.buffer, file.originalname, mimeType);
    } catch (err) {
      req.log.error({ err }, "Failed to store replacement original file");
      res.status(500).json({ error: "Failed to store file" });
      return;
    }

    const [updated] = await db
      .update(documentsTable)
      .set({ storageKey, storageProvider })
      .where(eq(documentsTable.id, id))
      .returning();

    res.json({
      id: updated.id,
      originalFileAvailable: Boolean(updated.storageKey),
      storageProvider: updated.storageProvider ?? null,
      storageKey: updated.storageKey ?? null,
    });
  },
);

// ── POST /documents/:id/reindex — re-extract and re-chunk from stored file ───
router.post("/documents/:id/reindex", async (req, res): Promise<void> => {
  const userId = getCurrentUserId(req);
  if (!userId) {
    res.status(401).json({ error: "Unauthorized." });
    return;
  }
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid document ID" });
    return;
  }

  const [doc] = await db
    .select()
    .from(documentsTable)
    .where(and(eq(documentsTable.id, id), eq(documentsTable.ownerUserId, userId), isNull(documentsTable.deletedAt)));
  if (!doc) {
    res.status(404).json({ error: "Document not found" });
    return;
  }
  if (!doc.storageKey) {
    res.status(404).json({ error: "Original file not available — cannot re-index without the stored original file" });
    return;
  }

  // Download original file
  let fileBuffer: Buffer;
  try {
    fileBuffer = await fileStore.downloadFile(doc.storageKey);
  } catch (err) {
    if (fileStore.isStorageFileNotFoundError(err)) {
      respondStorageFileMissing(req, res, { documentId: id, storageKey: doc.storageKey }, "Stored original file missing from disk during re-index");
      return;
    }
    req.log.error({ err }, "Failed to download original file for re-indexing");
    res.status(500).json({ error: "Failed to retrieve original file from storage" });
    return;
  }

  // Re-extract text + chunks
  let extractedText: string;
  let chunks: string[];
  try {
    const extraction = await extractAndChunk(
      fileBuffer,
      doc.fileType as SupportedFileType,
      doc.fileName,
    );
    extractedText = extraction.text;
    chunks = extraction.chunks;
    for (const warning of extraction.warnings) {
      req.log.warn({ documentId: id, fileType: doc.fileType, warning }, "Extraction warning");
    }
  } catch (err) {
    req.log.error({ err }, "Re-extraction failed");
    await db
      .update(documentsTable)
      .set({ extractionStatus: "failed", extractionError: (err as Error).message })
      .where(eq(documentsTable.id, id));
    res.status(422).json({ error: `Text extraction failed: ${(err as Error).message}` });
    return;
  }

  if (!extractedText.trim()) {
    const noTextError = "No text could be extracted from the stored file";
    await db
      .update(documentsTable)
      .set({ extractionStatus: "failed", extractionError: noTextError })
      .where(eq(documentsTable.id, id));
    req.log.warn({ documentId: id, fileType: doc.fileType }, "Re-index produced no readable text");
    res.status(422).json({ error: noTextError });
    return;
  }

  // Delete old chunks, replace, and update document atomically
  await db.transaction(async (tx) => {
    await tx.delete(chunksTable).where(eq(chunksTable.documentId, id));
    if (chunks.length > 0) {
      await tx.insert(chunksTable).values(
        chunks.map((content, i) => ({ documentId: id, chunkIndex: i, content }))
      );
    }
    await tx
      .update(documentsTable)
      .set({
        extractedText,
        extractionStatus: "success",
        extractionError: null,
      })
      .where(eq(documentsTable.id, id));
  });

  req.log.info({ documentId: id, fileType: doc.fileType, chunkCount: chunks.length }, "Re-index succeeded");

  res.json({
    id,
    fileName: doc.fileName,
    fileType: doc.fileType,
    chunkCount: chunks.length,
    extractionStatus: "success",
    extractedTextPreview: extractedText.slice(0, 200),
  });
});

router.get("/system/info", (_req, res): void => {
  const envStatus = (key: string) => (process.env[key] ? "set" : "missing");
  const aiConfig = loadAiConfig();

  res.json({
    framework: "Express 5",
    nodeVersion: process.version,
    nodeEnv: process.env["NODE_ENV"] ?? "unknown",
    routes: [
      "GET  /api/healthz",
      "GET  /api/documents",
      "POST /api/documents/upload",
      "GET  /api/documents/:id",
      "DELETE /api/documents/:id",
      "GET  /api/documents/:id/chunks",
      "GET  /api/documents/:id/original",
      "POST /api/documents/:id/reindex",
      "POST /api/documents/multi-chat",
      "POST /api/documents/:id/chat",
      "GET  /api/documents/:id/history",
      "DELETE /api/documents/:id/history",
      "GET  /api/admin/stats",
      "GET  /api/system/info",
    ],
    database: {
      type: "PostgreSQL",
      orm: "Drizzle ORM",
      tables: ["documents", "chunks", "chat_messages"],
    },
    ai: {
      router: "aiRouter",
      routingEnabled: aiConfig.routingEnabled,
      primaryReasoningProvider: aiConfig.primaryReasoningProvider,
      embeddingProvider: aiConfig.embeddingProvider,
      models: aiConfig.models,
      embeddingModel: getEmbeddingModelName(),
      maxTokens: aiConfig.maxTokens,
    },
    env: {
      DATABASE_URL: envStatus("DATABASE_URL"),
      OPENAI_API_KEY: envStatus("OPENAI_API_KEY"),
      PORT: envStatus("PORT"),
      STORAGE_PROVIDER: envStatus("STORAGE_PROVIDER"),
      FILE_STORAGE_DIR: envStatus("FILE_STORAGE_DIR"),
      NODE_ENV: process.env["NODE_ENV"] ?? "not set",
    },
    fileStorage: fileStore.isConfigured()
      ? `${fileStore.getStorageProviderName()} durable storage`
      : "none — durable file storage not configured",
    fileStorageConfig: {
      provider: fileStore.getStorageProviderName(),
      bucketConfigured: fileStore.isConfigured(),
      originalFilesStored: fileStore.isConfigured(),
      embeddingsPersisted: false,
    },
    chunkConfig: {
      chunkSizeWords: 500,
      overlapWords: 50,
    },
  });
});

router.get("/admin/stats", async (_req, res): Promise<void> => {
  const [docCount] = await db.select({ cnt: count(documentsTable.id) }).from(documentsTable);
  const [chunkCount] = await db.select({ cnt: count(chunksTable.id) }).from(chunksTable);

  const byType = await db
    .select({ fileType: documentsTable.fileType, count: count(documentsTable.id) })
    .from(documentsTable)
    .groupBy(documentsTable.fileType);

  const msgResult = await db.execute(sql`SELECT COUNT(*) as cnt FROM chat_messages`);
  const totalMessages = parseInt((msgResult.rows[0] as { cnt: string }).cnt, 10);

  res.json({
    totalDocuments: docCount.cnt,
    totalChunks: chunkCount.cnt,
    totalMessages,
    documentsByType: byType.map((r) => ({ fileType: r.fileType, count: r.count })),
  });
});

export default router;
