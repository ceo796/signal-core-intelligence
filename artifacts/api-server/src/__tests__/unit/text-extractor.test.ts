import { describe, it, expect } from "vitest";
import { getFileType, extractText, extractAndChunk } from "../../lib/text-extractor.js";

describe("getFileType", () => {
  describe("by MIME type", () => {
    it("detects pdf by mime", () => {
      expect(getFileType("application/pdf", "doc.pdf")).toBe("pdf");
    });

    it("detects docx by mime", () => {
      expect(
        getFileType(
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          "doc.docx"
        )
      ).toBe("docx");
    });

    it("detects txt by mime", () => {
      expect(getFileType("text/plain", "doc.txt")).toBe("txt");
    });

    it("detects csv by mime", () => {
      expect(getFileType("text/csv", "data.csv")).toBe("csv");
    });

    it("detects xlsx by mime", () => {
      expect(
        getFileType(
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "data.xlsx"
        )
      ).toBe("xlsx");
    });

    it("detects xls by mime", () => {
      expect(getFileType("application/vnd.ms-excel", "data.xls")).toBe("xls");
    });
  });

  describe("by file extension (fallback)", () => {
    it("detects pdf by extension when mime is generic", () => {
      expect(getFileType("application/octet-stream", "report.pdf")).toBe("pdf");
    });

    it("detects docx by extension", () => {
      expect(getFileType("application/octet-stream", "doc.docx")).toBe("docx");
    });

    it("detects xlsx by extension", () => {
      expect(getFileType("application/octet-stream", "data.xlsx")).toBe("xlsx");
    });

    it("detects xls by extension", () => {
      expect(getFileType("application/octet-stream", "data.xls")).toBe("xls");
    });

    it("detects csv by extension even with Excel mime type", () => {
      expect(getFileType("application/vnd.ms-excel", "data.csv")).toBe("csv");
    });

    it("returns null for unknown type", () => {
      expect(getFileType("image/png", "photo.png")).toBeNull();
    });

    it("returns null for unknown extension", () => {
      expect(getFileType("application/octet-stream", "file.unknown")).toBeNull();
    });

    it("is case-insensitive on extension", () => {
      expect(getFileType("application/octet-stream", "DATA.XLSX")).toBe("xlsx");
    });
  });
});

describe("extractText", () => {
  describe("txt", () => {
    it("extracts UTF-8 text from a buffer", async () => {
      const content = "Hello, Signal87 platform.";
      const buf = Buffer.from(content, "utf-8");
      const result = await extractText(buf, "txt");
      expect(result).toBe(content);
    });

    it("preserves newlines", async () => {
      const content = "Line one\nLine two\nLine three";
      const buf = Buffer.from(content, "utf-8");
      const result = await extractText(buf, "txt");
      expect(result).toBe(content);
    });
  });

  describe("csv", () => {
    it("extracts CSV as raw text", async () => {
      const csv = "name,age\nAlice,30\nBob,25";
      const buf = Buffer.from(csv, "utf-8");
      const result = await extractText(buf, "csv");
      expect(result).toBe(csv);
    });
  });
});

describe("extractAndChunk", () => {
  describe("txt", () => {
    it("produces text and chunks for a plain text file", async () => {
      const content = "word ".repeat(600).trim();
      const buf = Buffer.from(content, "utf-8");
      const result = await extractAndChunk(buf, "txt", "test.txt");
      expect(result.text).toContain("word");
      expect(result.chunks.length).toBeGreaterThan(0);
      expect(result.warnings).toHaveLength(0);
    });

    it("returns empty chunks array for empty file", async () => {
      const buf = Buffer.from("", "utf-8");
      const result = await extractAndChunk(buf, "txt", "empty.txt");
      expect(result.chunks).toHaveLength(0);
    });

    it("returns empty chunks for whitespace-only file", async () => {
      const buf = Buffer.from("   \n\t  ", "utf-8");
      const result = await extractAndChunk(buf, "txt", "blank.txt");
      expect(result.chunks).toHaveLength(0);
    });
  });

  describe("csv", () => {
    it("produces chunks from CSV content", async () => {
      const csv = "product,price\n" + "Widget,10\n".repeat(20);
      const buf = Buffer.from(csv, "utf-8");
      const result = await extractAndChunk(buf, "csv", "products.csv");
      expect(result.text).toContain("product");
      expect(result.chunks.length).toBeGreaterThan(0);
    });
  });
});
