import { Router, type IRouter, type Request, type Response } from "express";
import { db, documentsTable, chunksTable } from "@workspace/db";
import { eq, and, count, inArray, isNull, isNotNull } from "drizzle-orm";
import { getCurrentUserId } from "../../lib/ownership";
import * as fileStore from "../../lib/file-store";

const router: IRouter = Router();

router.get("/trash", async (req, res): Promise<void> => {
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
      .where(and(eq(documentsTable.ownerUserId, userId), isNotNull(documentsTable.deletedAt)));
    const total = totalResult[0]?.count ?? 0;

    const docs = await db
      .select()
      .from(documentsTable)
      .where(and(eq(documentsTable.ownerUserId, userId), isNotNull(documentsTable.deletedAt)))
      .orderBy(documentsTable.deletedAt)
      .limit(limit)
      .offset(offset);

    const docIds = docs.map((d) => d.id);
    const chunksCountResult = docIds.length
      ? await db
          .select({ documentId: chunksTable.documentId, cnt: count(chunksTable.id) })
          .from(chunksTable)
          .where(inArray(chunksTable.documentId, docIds))
          .groupBy(chunksTable.documentId)
      : [];

    const chunkMap = new Map(chunksCountResult.map((r) => [r.documentId, r.cnt]));

    const items = docs.map((doc) => ({
      id: doc.id,
      fileName: doc.fileName,
      fileType: doc.fileType,
      fileSize: doc.fileSize ?? null,
      uploadedAt: doc.uploadedAt.toISOString(),
      deletedAt: doc.deletedAt?.toISOString() ?? null,
      extractionStatus: doc.extractionStatus,
      chunkCount: chunkMap.get(doc.id) ?? 0,
      originalFileAvailable: Boolean(doc.storageKey),
    }));

    res.json({ items, total, limit, offset });
  } catch (err) {
    req.log.error({ err }, "Failed to list trash");
    res.status(500).json({ error: "Failed to list trash" });
  }
});

router.post("/trash/:id/restore", async (req, res): Promise<void> => {
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
    .where(and(eq(documentsTable.id, id), eq(documentsTable.ownerUserId, userId), isNotNull(documentsTable.deletedAt)));

  if (!doc) {
    res.status(404).json({ error: "Document not found in trash" });
    return;
  }

  await db
    .update(documentsTable)
    .set({ deletedAt: null, deletedBy: null })
    .where(eq(documentsTable.id, id));

  res.json({
    id: doc.id,
    fileName: doc.fileName,
    fileType: doc.fileType,
    restored: true,
  });
});

router.delete("/trash/:id", async (req, res): Promise<void> => {
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
    .where(and(eq(documentsTable.id, id), eq(documentsTable.ownerUserId, userId), isNotNull(documentsTable.deletedAt)));

  if (!doc) {
    res.status(404).json({ error: "Document not found in trash" });
    return;
  }

  if (doc.storageKey) {
    try {
      await fileStore.deleteFile(doc.storageKey);
    } catch (err) {
      req.log.error({ err, storageKey: doc.storageKey }, "Failed to delete original file from storage during permanent delete");
      res.status(500).json({ error: "Failed to delete original file from storage" });
      return;
    }
  }

  await db.delete(chunksTable).where(eq(chunksTable.documentId, doc.id));
  await db.delete(documentsTable).where(eq(documentsTable.id, doc.id));

  res.sendStatus(204);
});

router.post("/trash/empty", async (req, res): Promise<void> => {
  const userId = getCurrentUserId(req);
  if (!userId) {
    res.status(401).json({ error: "Unauthorized." });
    return;
  }

  const trashed = await db
    .select()
    .from(documentsTable)
    .where(and(eq(documentsTable.ownerUserId, userId), isNotNull(documentsTable.deletedAt)));

  for (const doc of trashed) {
    if (doc.storageKey) {
      try {
        await fileStore.deleteFile(doc.storageKey);
      } catch (err) {
        req.log.error({ err, storageKey: doc.storageKey, documentId: doc.id }, "Failed to delete original file during empty trash");
      }
    }
    await db.delete(chunksTable).where(eq(chunksTable.documentId, doc.id));
    await db.delete(documentsTable).where(eq(documentsTable.id, doc.id));
  }

  res.json({ deletedCount: trashed.length });
});

export default router;
