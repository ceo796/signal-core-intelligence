import { describe, it, expect, vi, afterAll } from "vitest";
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

const { uploadFileMock, isConfiguredMock } = vi.hoisted(() => ({
  uploadFileMock: vi.fn(async () => `local://documents/${randomUUID()}.bin`),
  isConfiguredMock: vi.fn(() => true),
}));

vi.mock("../../lib/file-store.js", () => ({
  isConfigured: isConfiguredMock,
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
  uploadFile: uploadFileMock,
  downloadFile: vi.fn(async () => Buffer.from("stored")),
  deleteFile: vi.fn(async () => undefined),
}));

import app from "../../app.js";
import { db, documentsTable, chunksTable } from "@workspace/db";
import { inArray } from "drizzle-orm";
import { makePdfBuffer } from "../helpers/make-pdf.js";
import { makeDocxBuffer } from "../helpers/make-docx.js";
import { makeXlsxBuffer } from "../helpers/make-xlsx.js";
import { UPLOAD_MAX_BYTES } from "../../middlewares/multer-upload.js";

const createdDocIds: number[] = [];

describe("Upload stability (structured errors + file types)", () => {
  afterAll(async () => {
    if (createdDocIds.length > 0) {
      await db.delete(chunksTable).where(inArray(chunksTable.documentId, createdDocIds));
      await db.delete(documentsTable).where(inArray(documentsTable.id, createdDocIds));
    }
  });

  it("returns structured JSON when no file is attached", async () => {
    const res = await request(app).post("/api/documents/upload");
    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({
      stage: "validation",
      message: expect.stringContaining("No file uploaded"),
      fileName: null,
      requestId: expect.any(String),
    });
  });

  it("returns structured JSON for unsupported file types", async () => {
    const res = await request(app)
      .post("/api/documents/upload")
      .attach("file", Buffer.from("fake"), {
        filename: "photo.png",
        contentType: "image/png",
      });

    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({
      stage: "validation",
      fileName: "photo.png",
      code: "unsupported_file_type",
      message: expect.stringMatching(/unsupported file type/i),
    });
  });

  it("returns structured JSON when durable storage is not configured", async () => {
    isConfiguredMock.mockReturnValueOnce(false);
    const res = await request(app)
      .post("/api/documents/upload")
      .attach("file", Buffer.from("hello"), {
        filename: "notes.txt",
        contentType: "text/plain",
      });

    expect(res.status).toBe(503);
    expect(res.body).toMatchObject({
      stage: "storage",
      fileName: "notes.txt",
      code: "storage_not_configured",
    });
  });

  it("returns structured JSON when file exceeds the upload limit", async () => {
    const oversized = Buffer.alloc(UPLOAD_MAX_BYTES + 1, 1);
    const res = await request(app)
      .post("/api/documents/upload")
      .attach("file", oversized, {
        filename: "huge.pdf",
        contentType: "application/pdf",
      });

    expect(res.status).toBe(413);
    expect(res.body).toMatchObject({
      stage: "validation",
      code: "file_too_large",
      message: expect.stringMatching(/20 MB/i),
    });
  });

  it("uploads a PDF and returns 201 with chunks", async () => {
    const res = await request(app)
      .post("/api/documents/upload")
      .attach("file", makePdfBuffer(), {
        filename: "report.pdf",
        contentType: "application/pdf",
      });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      fileName: "report.pdf",
      fileType: "pdf",
      extractionStatus: "success",
      stage: "complete",
    });
    expect(res.body.chunkCount).toBeGreaterThan(0);
    createdDocIds.push(res.body.id);
  });

  it("uploads a DOCX and returns 201 with chunks", async () => {
    const res = await request(app)
      .post("/api/documents/upload")
      .attach("file", makeDocxBuffer(), {
        filename: "memo.docx",
        contentType:
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      fileName: "memo.docx",
      fileType: "docx",
      extractionStatus: "success",
      stage: "complete",
    });
    expect(res.body.chunkCount).toBeGreaterThan(0);
    createdDocIds.push(res.body.id);
  });

  it("uploads an XLSX and returns 201 with chunks", async () => {
    const xlsxBuf = makeXlsxBuffer("Pipeline", [{ sku: "A1", qty: 3 }]);
    const res = await request(app)
      .post("/api/documents/upload")
      .attach("file", xlsxBuf, {
        filename: "pipeline.xlsx",
        contentType:
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      fileName: "pipeline.xlsx",
      fileType: "xlsx",
      extractionStatus: "success",
      stage: "complete",
    });
    expect(res.body.chunkCount).toBeGreaterThan(0);
    createdDocIds.push(res.body.id);
  });

  it("stores the file and returns 207 when extraction produces no text", async () => {
    const res = await request(app)
      .post("/api/documents/upload")
      .attach("file", makePdfBuffer("   "), {
        filename: "blank.pdf",
        contentType: "application/pdf",
      });

    expect(res.status).toBe(207);
    expect(res.body).toMatchObject({
      fileName: "blank.pdf",
      extractionStatus: "failed",
      originalFileAvailable: true,
      warning: expect.stringMatching(/extraction failed/i),
    });
    expect(uploadFileMock).toHaveBeenCalled();
    createdDocIds.push(res.body.id);
  });
});