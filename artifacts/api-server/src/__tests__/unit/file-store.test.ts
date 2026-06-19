import { describe, it, expect, beforeEach, afterEach } from "vitest";

describe("file-store (pure functions)", () => {
  describe("isConfigured", () => {
    const origPrivate = process.env.PRIVATE_OBJECT_DIR;
    const origBucket = process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID;

    afterEach(() => {
      process.env.PRIVATE_OBJECT_DIR = origPrivate;
      process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID = origBucket;
    });

    it("returns false when both env vars are missing", async () => {
      delete process.env.PRIVATE_OBJECT_DIR;
      delete process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID;
      const { isConfigured } = await import("../../lib/file-store.js");
      expect(isConfigured()).toBe(false);
    });

    it("returns false when only PRIVATE_OBJECT_DIR is set", async () => {
      process.env.PRIVATE_OBJECT_DIR = "/buckets/test";
      delete process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID;
      const { isConfigured } = await import("../../lib/file-store.js");
      expect(isConfigured()).toBe(false);
    });

    it("returns false when only DEFAULT_OBJECT_STORAGE_BUCKET_ID is set", async () => {
      delete process.env.PRIVATE_OBJECT_DIR;
      process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID = "my-bucket";
      const { isConfigured } = await import("../../lib/file-store.js");
      expect(isConfigured()).toBe(false);
    });

    it("returns true when both env vars are set", async () => {
      process.env.PRIVATE_OBJECT_DIR = "/buckets/test";
      process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID = "my-bucket";
      const { isConfigured } = await import("../../lib/file-store.js");
      expect(isConfigured()).toBe(true);
    });
  });

  describe("getMimeType", () => {
    it("maps pdf", async () => {
      const { getMimeType } = await import("../../lib/file-store.js");
      expect(getMimeType("pdf")).toBe("application/pdf");
    });

    it("maps docx", async () => {
      const { getMimeType } = await import("../../lib/file-store.js");
      expect(getMimeType("docx")).toBe(
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
      );
    });

    it("maps xlsx", async () => {
      const { getMimeType } = await import("../../lib/file-store.js");
      expect(getMimeType("xlsx")).toBe(
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      );
    });

    it("maps xls", async () => {
      const { getMimeType } = await import("../../lib/file-store.js");
      expect(getMimeType("xls")).toBe("application/vnd.ms-excel");
    });

    it("maps csv", async () => {
      const { getMimeType } = await import("../../lib/file-store.js");
      expect(getMimeType("csv")).toBe("text/csv");
    });

    it("maps txt", async () => {
      const { getMimeType } = await import("../../lib/file-store.js");
      expect(getMimeType("txt")).toBe("text/plain");
    });

    it("defaults unknown types to text/plain", async () => {
      const { getMimeType } = await import("../../lib/file-store.js");
      expect(getMimeType("unknown")).toBe("text/plain");
    });

    it("is case-insensitive", async () => {
      const { getMimeType } = await import("../../lib/file-store.js");
      expect(getMimeType("PDF")).toBe("application/pdf");
      expect(getMimeType("DOCX")).toBe(
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
      );
    });
  });
});
