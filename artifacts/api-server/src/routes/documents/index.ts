import { Router, type IRouter, type Request, type Response } from "express";
import multer from "multer";
import { db, documentsTable, chunksTable } from "@workspace/db";
import { eq, count, sql, and, inArray } from "drizzle-orm";
import { getAuth } from "@clerk/express";
import { checkActiveSubscription } from "../../stripe/storage";
import {
  GetDocumentParams,
  DeleteDocumentParams,
  GetDocumentChunksParams,
  ListDocumentsResponse,
  GetDocumentResponse,
  GetDocumentChunksResponse,
} from "@workspace/api-zod";
import { extractText, getFileType, type SupportedFileType } from "../../lib/text-extractor";
import { chunkText } from "../../lib/chunker";
import * as fileStore from "../../lib/file-store";

const FREE_DOC_LIMIT = 3;

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

router.get("/documents", async (req, res): Promise<void> => {
  // userId is guaranteed non-null by requireAuth middleware
  const { userId } = getAuth(req);

  try {
    const docs = await db
      .select()
      .from(documentsTable)
      .where(eq(documentsTable.ownerUserId, userId!))
      .orderBy(documentsTable.uploadedAt);

    const docIds = docs.map((d) => d.id);
    let chunkMap = new Map<number, number>();

    if (docIds.length > 0) {
      const chunksCountResult = await db
        .select({ documentId: chunksTable.documentId, cnt: count(chunksTable.id) })
        .from(chunksTable)
        .where(inArray(chunksTable.documentId, docIds))
        .groupBy(chunksTable.documentId);
      chunkMap = new Map(chunksCountResult.map((r) => [r.documentId, r.cnt]));
    }

    const result = docs.map((doc) => docToResponse(doc, chunkMap.get(doc.id) ?? 0));

    res.json(ListDocumentsResponse.parse(result));
  } catch (err) {
    req.log.error({ err }, "Failed to list documents");
    res.status(500).json({ error: "Failed to list documents" });
  }
});

router.post(
  "/documents/upload",
  upload.array("files", 10),
  async (req: Request, res: Response): Promise<void> => {
    // userId is guaranteed non-null by requireAuth middleware
    const { userId } = getAuth(req);

    const files = (req as Request & { files?: Express.Multer.File[] }).files;
    if (!files || files.length === 0) {
      res.status(400).json({ error: "No files uploaded" });
      return;
    }

    // ── 0. Validate all files before beginning ──────────────────────────────────
    const validatedFiles: { file: Express.Multer.File; fileType: SupportedFileType }[] = [];
    const validationErrors: { fileName: string; error: string }[] = [];
    for (const file of files) {
      const fileType = getFileType(file.mimetype, file.originalname);
      if (!fileType) {
        validationErrors.push({ fileName: file.originalname, error: "Unsupported file type. Allowed: PDF, DOCX, TXT, CSV" });
        continue;
      }
      validatedFiles.push({ file, fileType });
    }

    if (validatedFiles.length === 0) {
      res.status(400).json({
        error: "No valid files to upload",
        results: validationErrors.map((v) => ({ fileName: v.fileName, success: false, error: v.error })),
        summary: { uploaded: 0, failed: validationErrors.length, total: files.length },
      });
      return;
    }

    // ── 1. Enforce free-tier document limit ───────────────────────────────────
    const [limitRow] = await db
      .select({ docCount: count(documentsTable.id) })
      .from(documentsTable)
      .where(eq(documentsTable.ownerUserId, userId!));
    const currentDocCount = Number(limitRow?.docCount ?? 0);
    const newDocCount = currentDocCount + validatedFiles.length;
    if (newDocCount > FREE_DOC_LIMIT) {
      const hasActiveSub = await checkActiveSubscription(userId!);
      if (!hasActiveSub) {
        res.status(402).json({
          error: "upgrade_required",
          message: "Free plan limit reached. Upgrade to upload more documents.",
          documentCount: currentDocCount,
          limit: FREE_DOC_LIMIT,
          upgradeRequired: true,
        });
        return;
      }
    }

    // ── 2. Process each file: store, extract, persist ───────────────────────
    if (!fileStore.isConfigured()) {
      req.log.error("Object storage is not configured — refusing non-durable upload");
      res.status(503).json({ error: "Durable file storage is not configured. Upload rejected." });
      return;
    }

    const results: {
      fileName: string;
      success: boolean;
      document?: ReturnType<typeof docToResponse>;
      warning?: string;
      error?: string;
      statusCode: number;
    }[] = [];
    let uploaded = 0;
    let failed = 0;

    for (const { file, fileType } of validatedFiles) {
      const storageProvider = "replit-object-storage";
      let storageKey: string;
      try {
        const mimeType = fileStore.getMimeType(fileType);
        storageKey = await fileStore.uploadFile(file.buffer, file.originalname, mimeType);
      } catch (err) {
        req.log.error({ err }, "Failed to save original file to object storage");
        results.push({ fileName: file.originalname, success: false, error: "Failed to store uploaded file", statusCode: 500 });
        failed++;
        continue;
      }

      let extractedText: string | null = null;
      let extractionStatus = "failed" as "failed" | "success";
      let extractionError: string | null = null;

      try {
        extractedText = await extractText(file.buffer, fileType);
        if (!extractedText.trim()) {
          extractionError = "No text could be extracted from the file";
        } else {
          extractionStatus = "success";
        }
      } catch (err) {
        req.log.error({ err }, "Failed to extract text");
        extractionError = (err as Error).message ?? "Extraction failed";
      }

      let doc: typeof documentsTable.$inferSelect;
      let chunkCount = 0;
      try {
        [doc] = await db
          .insert(documentsTable)
          .values({
            ownerUserId: userId!,
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

        if (extractionStatus === "success" && extractedText) {
          const chunks = chunkText(extractedText);
          if (chunks.length > 0) {
            await db.insert(chunksTable).values(
              chunks.map((content, i) => ({ documentId: doc.id, chunkIndex: i, content }))
            );
            chunkCount = chunks.length;
          }
        }
      } catch (err) {
        req.log.error({ err }, "Failed to persist document — removing orphaned file from storage");
        try {
          await fileStore.deleteFile(storageKey);
        } catch (cleanupErr) {
          req.log.error({ err: cleanupErr, storageKey }, "Failed to clean up orphaned file after DB error");
        }
        results.push({ fileName: file.originalname, success: false, error: "Failed to save document", statusCode: 500 });
        failed++;
        continue;
      }

      if (extractionStatus === "failed") {
        req.log.warn(
          { documentId: doc.id, fileName: file.originalname, fileType, fileSize: file.size, extractionError },
          "Upload stored but text extraction failed",
        );
        const docResponse = docToResponse(doc, chunkCount);
        results.push({
          fileName: file.originalname,
          success: true,
          document: docResponse,
          warning: "Original file stored, but text extraction failed. Re-index to retry. " + (extractionError ?? ""),
          statusCode: 207,
        });
        uploaded++;
      } else {
        req.log.info(
          { documentId: doc.id, fileName: file.originalname, fileType, fileSize: file.size, chunkCount },
          "Upload succeeded",
        );
        results.push({
          fileName: file.originalname,
          success: true,
          document: docToResponse(doc, chunkCount),
          statusCode: 201,
        });
        uploaded++;
      }
    }

    // Also include any validation failures
    for (const v of validationErrors) {
      results.push({ fileName: v.fileName, success: false, error: v.error, statusCode: 400 });
      failed++;
    }

    res.status(200).json({
      results,
      summary: { uploaded, failed, total: files.length },
    });
  }
);

router.get("/documents/:id", async (req, res): Promise<void> => {
  const { userId } = getAuth(req);

  const params = GetDocumentParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [doc] = await db
    .select()
    .from(documentsTable)
    .where(and(eq(documentsTable.id, params.data.id), eq(documentsTable.ownerUserId, userId!)));

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
  const { userId } = getAuth(req);

  const params = DeleteDocumentParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [doc] = await db
    .select()
    .from(documentsTable)
    .where(and(eq(documentsTable.id, params.data.id), eq(documentsTable.ownerUserId, userId!)));

  if (!doc) {
    res.status(404).json({ error: "Document not found" });
    return;
  }

  // Delete original file from object storage before removing the DB record,
  // so a failure leaves storage_key intact for a retry rather than orphaning.
  if (doc.storageKey) {
    try {
      await fileStore.deleteFile(doc.storageKey);
    } catch (err) {
      req.log.error({ err, storageKey: doc.storageKey }, "Failed to delete original file from storage");
      res.status(500).json({ error: "Failed to delete original file from storage" });
      return;
    }
  }

  await db.delete(chunksTable).where(eq(chunksTable.documentId, doc.id));
  await db.delete(documentsTable).where(eq(documentsTable.id, doc.id));

  res.sendStatus(204);
});

router.get("/documents/:id/chunks", async (req, res): Promise<void> => {
  const { userId } = getAuth(req);

  const params = GetDocumentChunksParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [doc] = await db
    .select()
    .from(documentsTable)
    .where(and(eq(documentsTable.id, params.data.id), eq(documentsTable.ownerUserId, userId!)));

  if (!doc) {
    res.status(404).json({ error: "Document not found" });
    return;
  }

  const chunks = await db
    .select()
    .from(chunksTable)
    .where(eq(chunksTable.documentId, doc.id))
    .orderBy(chunksTable.chunkIndex);

  res.json(GetDocumentChunksResponse.parse(chunks));
});

// ── GET /documents/:id/original — download the stored original file ──────────
router.get("/documents/:id/original", async (req, res): Promise<void> => {
  const { userId } = getAuth(req);

  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid document ID" });
    return;
  }

  const [doc] = await db
    .select()
    .from(documentsTable)
    .where(and(eq(documentsTable.id, id), eq(documentsTable.ownerUserId, userId!)));

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
    const { userId } = getAuth(req);

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
      .where(and(eq(documentsTable.id, id), eq(documentsTable.ownerUserId, userId!)));

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
    const storageProvider = "replit-object-storage";
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
      .where(and(eq(documentsTable.id, id), eq(documentsTable.ownerUserId, userId!)))
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
  const { userId } = getAuth(req);

  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid document ID" });
    return;
  }

  const [doc] = await db
    .select()
    .from(documentsTable)
    .where(and(eq(documentsTable.id, id), eq(documentsTable.ownerUserId, userId!)));

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
    req.log.error({ err }, "Failed to download original file for re-indexing");
    res.status(500).json({ error: "Failed to retrieve original file from storage" });
    return;
  }

  // Re-extract text
  let extractedText: string;
  try {
    extractedText = await extractText(fileBuffer, doc.fileType as SupportedFileType);
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

  // Delete old chunks, re-chunk, and update document atomically
  const chunks = chunkText(extractedText);
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
      provider: "OpenAI",
      chatModel: "gpt-4o-mini",
      embeddingModel: "text-embedding-3-small",
      maxTokens: 2048,
    },
    env: {
      DATABASE_URL: envStatus("DATABASE_URL"),
      OPENAI_API_KEY: envStatus("OPENAI_API_KEY"),
      PORT: envStatus("PORT"),
      DEFAULT_OBJECT_STORAGE_BUCKET_ID: envStatus("DEFAULT_OBJECT_STORAGE_BUCKET_ID"),
      PRIVATE_OBJECT_DIR: envStatus("PRIVATE_OBJECT_DIR"),
      NODE_ENV: process.env["NODE_ENV"] ?? "not set",
    },
    fileStorage: fileStore.isConfigured()
      ? "replit-object-storage (GCS-backed)"
      : "none — PRIVATE_OBJECT_DIR not configured",
    fileStorageConfig: {
      provider: fileStore.isConfigured() ? "replit-object-storage" : "none",
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
