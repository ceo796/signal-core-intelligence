import { describe, it, expect, vi, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { randomUUID } from "crypto";

vi.mock("@clerk/express", () => ({
  clerkMiddleware: () => (_req: unknown, _res: unknown, next: () => void) => next(),
  getAuth: () => ({ userId: null, sessionClaims: {} }),
  clerkClient: { users: { getUser: vi.fn() } },
}));
vi.mock("@clerk/shared/keys", () => ({
  publishableKeyFromHost: () => "pk_test_placeholder",
}));

vi.mock("../../lib/file-store.js", () => ({
  isConfigured: vi.fn(() => true),
  getStorageProviderName: vi.fn(() => "local"),
  getMimeType: vi.fn((type: string) => {
    const m: Record<string, string> = {
      pdf: "application/pdf",
      txt: "text/plain",
      csv: "text/csv",
      docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      xls: "application/vnd.ms-excel",
    };
    return m[type.toLowerCase()] ?? "text/plain";
  }),
  uploadFile: vi.fn(async () => `/test-bucket/documents/${randomUUID()}`),
  downloadFile: vi.fn(async (_key: string) => Buffer.from("test file content")),
  deleteFile: vi.fn(async () => undefined),
}));

import app from "../../app.js";
import { db, documentsTable, chunksTable } from "@workspace/db";
import { eq, inArray } from "drizzle-orm";

// ownership.ts reads DEV_USER_ID as a module-level constant at load time, so
// the effective user ID for bypass-auth integration tests is always the value
// that was in the env when the module first loaded — which is 'test-user-bypass'.
const TEST_USER_ID = "test-user-bypass";
const createdDocIds: number[] = [];

function txtBuffer(content: string): Buffer {
  return Buffer.from(content, "utf-8");
}

describe("Document CRUD integration (auth bypassed, file-store mocked)", () => {
  afterAll(async () => {
    // Clean up only the specific document IDs this test suite created
    if (createdDocIds.length > 0) {
      await db.delete(chunksTable).where(inArray(chunksTable.documentId, createdDocIds));
      await db.delete(documentsTable).where(inArray(documentsTable.id, createdDocIds));
    }
  });

  // ─── Upload ───────────────────────────────────────────────────────────────

  describe("POST /api/documents/upload", () => {
    it("uploads a TXT file and returns 201 with document fields", async () => {
      const content = "word ".repeat(120);
      const res = await request(app)
        .post("/api/documents/upload")
        .attach("file", txtBuffer(content), {
          filename: "test-upload.txt",
          contentType: "text/plain",
        });

      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({
        fileName: "test-upload.txt",
        fileType: "txt",
        extractionStatus: "success",
      });
      expect(res.body.id).toBeTypeOf("number");
      expect(res.body.chunkCount).toBeGreaterThan(0);
      createdDocIds.push(res.body.id);
    });

    it("uploads a CSV file and returns 201", async () => {
      const csv = "name,score\nAlice,95\nBob,88\nCarol,72\n";
      const res = await request(app)
        .post("/api/documents/upload")
        .attach("file", Buffer.from(csv), {
          filename: "scores.csv",
          contentType: "text/csv",
        });

      expect(res.status).toBe(201);
      expect(res.body.fileType).toBe("csv");
      expect(res.body.extractionStatus).toBe("success");
      createdDocIds.push(res.body.id);
    });

    it("rejects an unsupported file type with 400", async () => {
      const res = await request(app)
        .post("/api/documents/upload")
        .attach("file", Buffer.from("data"), {
          filename: "image.png",
          contentType: "image/png",
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/unsupported file type/i);
    });

    it("rejects a request with no file attached with 400", async () => {
      const res = await request(app).post("/api/documents/upload");
      expect(res.status).toBe(400);
    });
  });

  // ─── List ─────────────────────────────────────────────────────────────────

  describe("GET /api/documents", () => {
    it("returns 200 with an array of documents for the current user", async () => {
      const content = "Some document content for listing test.";
      const upload = await request(app)
        .post("/api/documents/upload")
        .attach("file", txtBuffer(content), {
          filename: "listing-test.txt",
          contentType: "text/plain",
        });
      createdDocIds.push(upload.body.id);

      const res = await request(app).get("/api/documents");
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.items)).toBe(true);
      const found = (res.body.items as Array<{ id: number; fileName: string }>).find(
        (d) => d.id === upload.body.id
      );
      expect(found).toBeDefined();
      expect(found!.fileName).toBe("listing-test.txt");
    });

    it("returns only documents owned by the current user", async () => {
      const res = await request(app).get("/api/documents");
      expect(res.status).toBe(200);
      for (const doc of res.body.items as Array<{ id: number }>) {
        const [dbDoc] = await db
          .select({ ownerUserId: documentsTable.ownerUserId })
          .from(documentsTable)
          .where(eq(documentsTable.id, doc.id));
        if (dbDoc) {
          expect(dbDoc.ownerUserId).toBe(TEST_USER_ID);
        }
      }
    });
  });

  // ─── Detail ───────────────────────────────────────────────────────────────

  describe("GET /api/documents/:id", () => {
    it("returns full document detail including extracted text", async () => {
      const content = "Detailed document text for retrieval test.";
      const upload = await request(app)
        .post("/api/documents/upload")
        .attach("file", txtBuffer(content), {
          filename: "detail-test.txt",
          contentType: "text/plain",
        });
      createdDocIds.push(upload.body.id);

      const res = await request(app).get(`/api/documents/${upload.body.id}`);
      expect(res.status).toBe(200);
      expect(res.body.id).toBe(upload.body.id);
      expect(res.body.fileName).toBe("detail-test.txt");
      expect(res.body.extractedText).toContain("Detailed document");
      expect(res.body.chunkCount).toBeGreaterThan(0);
    });

    it("returns 404 for a non-existent document", async () => {
      const res = await request(app).get("/api/documents/999999999");
      expect(res.status).toBe(404);
    });
  });

  // ─── Delete ───────────────────────────────────────────────────────────────

  describe("DELETE /api/documents/:id", () => {
    it("soft-deletes a document (hidden from API, moved to trash), returns 204", async () => {
      const content = "Document to be deleted.";
      const upload = await request(app)
        .post("/api/documents/upload")
        .attach("file", txtBuffer(content), {
          filename: "delete-me.txt",
          contentType: "text/plain",
        });
      const docId = upload.body.id as number;

      const del = await request(app).delete(`/api/documents/${docId}`);
      expect(del.status).toBe(204);

      const check = await request(app).get(`/api/documents/${docId}`);
      expect(check.status).toBe(404);

      const [deleted] = await db
        .select({ deletedAt: documentsTable.deletedAt })
        .from(documentsTable)
        .where(eq(documentsTable.id, docId));
      expect(deleted?.deletedAt).toBeTruthy();
    });

    it("returns 404 when deleting a non-existent document", async () => {
      const res = await request(app).delete("/api/documents/999999999");
      expect(res.status).toBe(404);
    });
  });

  // ─── Spreadsheet upload ───────────────────────────────────────────────────

  describe("POST /api/documents/upload (spreadsheet)", () => {
    it("produces sheet and row context in chunks for an XLSX file", async () => {
      const { makeXlsxBuffer } = await import("../helpers/make-xlsx.js");
      const xlsxBuf = makeXlsxBuffer("Revenue", [
        { quarter: "Q1", revenue: 10000, cost: 6000 },
        { quarter: "Q2", revenue: 12000, cost: 7000 },
        { quarter: "Q3", revenue: 11500, cost: 6500 },
        { quarter: "Q4", revenue: 15000, cost: 8000 },
      ]);

      const upload = await request(app)
        .post("/api/documents/upload")
        .attach("file", xlsxBuf, {
          filename: "revenue.xlsx",
          contentType:
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        });

      expect(upload.status).toBe(201);
      expect(upload.body.fileType).toBe("xlsx");
      expect(upload.body.extractionStatus).toBe("success");
      expect(upload.body.chunkCount).toBeGreaterThan(0);
      createdDocIds.push(upload.body.id);

      const chunksRes = await request(app).get(
        `/api/documents/${upload.body.id}/chunks`
      );
      expect(chunksRes.status).toBe(200);
      expect(Array.isArray(chunksRes.body)).toBe(true);
      const allChunkText = (chunksRes.body as Array<{ content: string }>)
        .map((c) => c.content)
        .join(" ");
      expect(allChunkText).toContain("Sheet: Revenue");
      expect(allChunkText).toContain("quarter");
    });
  });

  // ─── Re-index ─────────────────────────────────────────────────────────────

  describe("POST /api/documents/:id/reindex", () => {
    it("re-indexes a document and preserves ownership", async () => {
      const { downloadFile } = await import("../../lib/file-store.js");
      const content = "word ".repeat(200);
      vi.mocked(downloadFile).mockResolvedValue(Buffer.from(content, "utf-8"));

      const upload = await request(app)
        .post("/api/documents/upload")
        .attach("file", txtBuffer(content), {
          filename: "reindex-me.txt",
          contentType: "text/plain",
        });
      createdDocIds.push(upload.body.id);
      const docId = upload.body.id as number;

      const reindex = await request(app).post(`/api/documents/${docId}/reindex`);
      expect(reindex.status).toBe(200);
      expect(reindex.body.extractionStatus).toBe("success");
      expect(reindex.body.chunkCount).toBeGreaterThan(0);

      const [dbDoc] = await db
        .select({ ownerUserId: documentsTable.ownerUserId })
        .from(documentsTable)
        .where(eq(documentsTable.id, docId));
      expect(dbDoc?.ownerUserId).toBe(TEST_USER_ID);
    });

    it("returns 404 when re-indexing a non-existent document", async () => {
      const res = await request(app).post("/api/documents/999999999/reindex");
      expect(res.status).toBe(404);
    });
  });
});
