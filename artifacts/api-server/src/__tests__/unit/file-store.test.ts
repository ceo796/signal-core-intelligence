import { mkdtemp, rm } from "fs/promises";
import os from "os";
import path from "path";
import { describe, it, expect, beforeEach, afterEach } from "vitest";

describe("file-store (pure functions)", () => {
  function restoreEnv(key: string, value: string | undefined) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }

  describe("isConfigured", () => {
    const origProvider = process.env.STORAGE_PROVIDER;
    const origDir = process.env.FILE_STORAGE_DIR;

    afterEach(() => {
      restoreEnv("STORAGE_PROVIDER", origProvider);
      restoreEnv("FILE_STORAGE_DIR", origDir);
    });

    it("returns false when durable storage env vars are missing", async () => {
      delete process.env.STORAGE_PROVIDER;
      delete process.env.FILE_STORAGE_DIR;
      const { isConfigured } = await import("../../lib/file-store.js");
      expect(isConfigured()).toBe(false);
    });

    it("returns false when STORAGE_PROVIDER is local but FILE_STORAGE_DIR is missing", async () => {
      process.env.STORAGE_PROVIDER = "local";
      delete process.env.FILE_STORAGE_DIR;
      const { isConfigured } = await import("../../lib/file-store.js");
      expect(isConfigured()).toBe(false);
    });

    it("returns true when FILE_STORAGE_DIR is set", async () => {
      delete process.env.STORAGE_PROVIDER;
      process.env.FILE_STORAGE_DIR = "/tmp/signal87-test-uploads";
      const { isConfigured } = await import("../../lib/file-store.js");
      expect(isConfigured()).toBe(true);
    });

    it("returns true when STORAGE_PROVIDER is render-disk and FILE_STORAGE_DIR is set", async () => {
      process.env.STORAGE_PROVIDER = "render-disk";
      process.env.FILE_STORAGE_DIR = "/tmp/signal87-test-uploads";
      const { isConfigured } = await import("../../lib/file-store.js");
      expect(isConfigured()).toBe(true);
    });
  });

  describe("getRuntimeStorageStatus", () => {
    const origProvider = process.env.STORAGE_PROVIDER;
    const origDir = process.env.FILE_STORAGE_DIR;

    afterEach(() => {
      restoreEnv("STORAGE_PROVIDER", origProvider);
      restoreEnv("FILE_STORAGE_DIR", origDir);
    });

    it("reports uploads disabled when FILE_STORAGE_DIR is missing", async () => {
      process.env.STORAGE_PROVIDER = "local";
      delete process.env.FILE_STORAGE_DIR;
      const { getRuntimeStorageStatus } = await import("../../lib/file-store.js");
      expect(getRuntimeStorageStatus()).toMatchObject({
        configured: false,
        uploadsEnabled: false,
        fileStorageDir: "missing",
        productionSafe: false,
      });
    });

    it("reports uploads enabled when durable storage is configured", async () => {
      process.env.STORAGE_PROVIDER = "local";
      process.env.FILE_STORAGE_DIR = "/tmp/signal87-test-uploads";
      const { getRuntimeStorageStatus } = await import("../../lib/file-store.js");
      expect(getRuntimeStorageStatus()).toMatchObject({
        configured: true,
        uploadsEnabled: true,
        fileStorageDir: "set",
        productionSafe: true,
        storageProviderEnv: "local",
      });
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

  describe("local upload/download", () => {
    const origDir = process.env.FILE_STORAGE_DIR;
    let tempDir = "";

    beforeEach(async () => {
      tempDir = await mkdtemp(path.join(os.tmpdir(), "signal87-file-store-"));
      process.env.FILE_STORAGE_DIR = tempDir;
    });

    afterEach(async () => {
      restoreEnv("FILE_STORAGE_DIR", origDir);
      if (tempDir) {
        await rm(tempDir, { recursive: true, force: true });
        tempDir = "";
      }
    });

    it("round-trips a stored file", async () => {
      const { uploadFile, downloadFile } = await import("../../lib/file-store.js");
      const payload = Buffer.from("hello durable storage");
      const storageKey = await uploadFile(payload, "sample.txt", "text/plain");
      const downloaded = await downloadFile(storageKey);
      expect(downloaded.equals(payload)).toBe(true);
    });

    it("throws StorageFileNotFoundError when the file is missing on disk", async () => {
      const {
        StorageFileNotFoundError,
        isStorageFileNotFoundError,
        downloadFile,
      } = await import("../../lib/file-store.js");
      const missingKey = "local://documents/does-not-exist.pdf";

      await expect(downloadFile(missingKey)).rejects.toBeInstanceOf(StorageFileNotFoundError);
      try {
        await downloadFile(missingKey);
      } catch (err) {
        expect(isStorageFileNotFoundError(err)).toBe(true);
        if (isStorageFileNotFoundError(err)) {
          expect(err.storageKey).toBe(missingKey);
        }
      }
    });
  });
});
