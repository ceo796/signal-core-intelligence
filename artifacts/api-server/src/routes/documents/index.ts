import { Router, type IRouter, type Request, type Response } from "express";
import multer from "multer";
import { db, documentsTable, chunksTable } from "@workspace/db";
import { eq, count, sql } from "drizzle-orm";
import {
  GetDocumentParams,
  DeleteDocumentParams,
  GetDocumentChunksParams,
  ListDocumentsResponse,
  GetDocumentResponse,
  GetDocumentChunksResponse,
} from "@workspace/api-zod";
import { extractText, getFileType } from "../../lib/text-extractor";
import { chunkText } from "../../lib/chunker";

const router: IRouter = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

router.get("/documents", async (_req, res): Promise<void> => {
  const docs = await db.select().from(documentsTable).orderBy(documentsTable.uploadedAt);

  const chunksCountResult = await db
    .select({ documentId: chunksTable.documentId, cnt: count(chunksTable.id) })
    .from(chunksTable)
    .groupBy(chunksTable.documentId);

  const chunkMap = new Map(chunksCountResult.map((r) => [r.documentId, r.cnt]));

  const result = docs.map((doc) => ({
    id: doc.id,
    fileName: doc.fileName,
    fileType: doc.fileType,
    uploadedAt: doc.uploadedAt.toISOString(),
    chunkCount: chunkMap.get(doc.id) ?? 0,
    extractedTextPreview: doc.extractedText.slice(0, 200),
  }));

  res.json(ListDocumentsResponse.parse(result));
});

router.post(
  "/documents/upload",
  upload.single("file"),
  async (req: Request, res: Response): Promise<void> => {
    const file = (req as Request & { file?: Express.Multer.File }).file;
    if (!file) {
      res.status(400).json({ error: "No file uploaded" });
      return;
    }

    const fileType = getFileType(file.mimetype, file.originalname);
    if (!fileType) {
      res.status(400).json({ error: "Unsupported file type. Allowed: PDF, DOCX, TXT, CSV" });
      return;
    }

    let extractedText: string;
    try {
      extractedText = await extractText(file.buffer, fileType);
    } catch (err) {
      req.log.error({ err }, "Failed to extract text");
      res.status(422).json({ error: "Failed to extract text from file" });
      return;
    }

    if (!extractedText.trim()) {
      res.status(422).json({ error: "No text could be extracted from the file" });
      return;
    }

    const [doc] = await db
      .insert(documentsTable)
      .values({ fileName: file.originalname, fileType, extractedText })
      .returning();

    const chunks = chunkText(extractedText);
    if (chunks.length > 0) {
      await db.insert(chunksTable).values(
        chunks.map((content, i) => ({ documentId: doc.id, chunkIndex: i, content }))
      );
    }

    res.status(201).json({
      id: doc.id,
      fileName: doc.fileName,
      fileType: doc.fileType,
      uploadedAt: doc.uploadedAt.toISOString(),
      chunkCount: chunks.length,
      extractedTextPreview: extractedText.slice(0, 200),
    });
  }
);

router.get("/documents/:id", async (req, res): Promise<void> => {
  const params = GetDocumentParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [doc] = await db.select().from(documentsTable).where(eq(documentsTable.id, params.data.id));
  if (!doc) {
    res.status(404).json({ error: "Document not found" });
    return;
  }

  const [{ cnt }] = await db
    .select({ cnt: count(chunksTable.id) })
    .from(chunksTable)
    .where(eq(chunksTable.documentId, doc.id));

  res.json(
    GetDocumentResponse.parse({
      id: doc.id,
      fileName: doc.fileName,
      fileType: doc.fileType,
      uploadedAt: doc.uploadedAt.toISOString(),
      chunkCount: cnt,
      extractedTextPreview: doc.extractedText.slice(0, 200),
    })
  );
});

router.delete("/documents/:id", async (req, res): Promise<void> => {
  const params = DeleteDocumentParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  await db.delete(chunksTable).where(eq(chunksTable.documentId, params.data.id));
  const [doc] = await db
    .delete(documentsTable)
    .where(eq(documentsTable.id, params.data.id))
    .returning();

  if (!doc) {
    res.status(404).json({ error: "Document not found" });
    return;
  }

  res.sendStatus(204);
});

router.get("/documents/:id/chunks", async (req, res): Promise<void> => {
  const params = GetDocumentChunksParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const chunks = await db
    .select()
    .from(chunksTable)
    .where(eq(chunksTable.documentId, params.data.id))
    .orderBy(chunksTable.chunkIndex);

  res.json(GetDocumentChunksResponse.parse(chunks));
});

router.get("/system/info", (_req, res): void => {
  const envStatus = (key: string) =>
    process.env[key] ? "set" : "missing";

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
      SESSION_SECRET: envStatus("SESSION_SECRET"),
      NODE_ENV: process.env["NODE_ENV"] ?? "not set",
    },
    fileStorage: "none — files are held in memory (multer memoryStorage) and discarded after text extraction",
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
