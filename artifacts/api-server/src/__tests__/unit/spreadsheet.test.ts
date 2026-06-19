import { describe, it, expect } from "vitest";
import { extractSpreadsheet } from "../../lib/spreadsheet.js";
import { makeXlsxBuffer } from "../helpers/make-xlsx.js";

describe("extractSpreadsheet", () => {
  describe("basic extraction", () => {
    it("includes workbook header with file name", () => {
      const buf = makeXlsxBuffer("Sales", [
        { product: "Widget A", price: 29.99 },
        { product: "Widget B", price: 49.99 },
      ]);
      const result = extractSpreadsheet(buf, "xlsx", "sales-report.xlsx");
      expect(result.text).toContain("sales-report.xlsx");
      expect(result.warnings).toHaveLength(0);
    });

    it("includes sheet name in extracted text", () => {
      const buf = makeXlsxBuffer("Inventory", [
        { item: "Part A", qty: 100 },
      ]);
      const result = extractSpreadsheet(buf, "xlsx", "inventory.xlsx");
      expect(result.text).toContain("Inventory");
    });

    it("includes column headers in chunks", () => {
      const buf = makeXlsxBuffer("Products", [
        { product: "Widget", category: "Electronics", price: 29.99 },
        { product: "Gadget", category: "Hardware", price: 89.99 },
      ]);
      const result = extractSpreadsheet(buf, "xlsx", "products.xlsx");
      expect(result.chunks.length).toBeGreaterThan(0);
      const combinedChunks = result.chunks.join(" ");
      expect(combinedChunks).toContain("product");
      expect(combinedChunks).toContain("category");
      expect(combinedChunks).toContain("price");
    });

    it("includes row data values in chunks", () => {
      const buf = makeXlsxBuffer("Items", [
        { name: "Alpha Item", value: 42 },
        { name: "Beta Item", value: 99 },
      ]);
      const result = extractSpreadsheet(buf, "xlsx", "items.xlsx");
      const combinedChunks = result.chunks.join(" ");
      expect(combinedChunks).toContain("Alpha Item");
      expect(combinedChunks).toContain("Beta Item");
    });

    it("produces at least one chunk for non-empty data", () => {
      const buf = makeXlsxBuffer("Data", [
        { a: 1, b: 2 },
        { a: 3, b: 4 },
      ]);
      const result = extractSpreadsheet(buf, "xlsx", "data.xlsx");
      expect(result.chunks.length).toBeGreaterThan(0);
    });

    it("returns empty text and chunks for a fully empty sheet", () => {
      const buf = makeXlsxBuffer("Empty", []);
      const result = extractSpreadsheet(buf, "xlsx", "empty.xlsx");
      expect(result.text).toBe("");
      expect(result.chunks).toHaveLength(0);
    });
  });

  describe("chunk format — sheet and row context", () => {
    it("each chunk includes the sheet name prefix for provenance", () => {
      const buf = makeXlsxBuffer("Revenue", [
        { quarter: "Q1", amount: 10000 },
        { quarter: "Q2", amount: 12000 },
      ]);
      const result = extractSpreadsheet(buf, "xlsx", "revenue.xlsx");
      for (const chunk of result.chunks) {
        expect(chunk).toContain("Sheet: Revenue");
      }
    });

    it("each chunk includes a row range label", () => {
      const rows = Array.from({ length: 10 }, (_, i) => ({
        id: i + 1,
        val: `row-${i + 1}`,
      }));
      const buf = makeXlsxBuffer("TestSheet", rows);
      const result = extractSpreadsheet(buf, "xlsx", "test.xlsx");
      expect(result.chunks.length).toBeGreaterThan(0);
      for (const chunk of result.chunks) {
        expect(chunk).toMatch(/Rows \d+[–-]\d+|Header row/);
      }
    });

    it("chunks include column context for retrieval", () => {
      const buf = makeXlsxBuffer("Finance", [
        { revenue: 1000, cost: 500, profit: 500 },
        { revenue: 2000, cost: 800, profit: 1200 },
      ]);
      const result = extractSpreadsheet(buf, "xlsx", "finance.xlsx");
      expect(result.chunks.join(" ")).toContain("Columns:");
    });
  });

  describe("warnings", () => {
    it("produces no warnings for a normal-sized sheet", () => {
      const buf = makeXlsxBuffer("Normal", [
        { a: 1, b: 2 },
        { a: 3, b: 4 },
      ]);
      const result = extractSpreadsheet(buf, "xlsx", "normal.xlsx");
      expect(result.warnings).toHaveLength(0);
    });
  });

  describe("xls type pass-through", () => {
    it("accepts xls fileType parameter without error", () => {
      const buf = makeXlsxBuffer("Sheet1", [{ x: 1 }, { x: 2 }]);
      expect(() => extractSpreadsheet(buf, "xls", "legacy.xls")).not.toThrow();
    });
  });

  describe("unrecognised / non-spreadsheet input", () => {
    it("treats plain ASCII text as a single-column CSV (SheetJS CSV fallback)", () => {
      // SheetJS recognises ZIP (PK) and OLE (D0CF) magic bytes for XLSX/XLS;
      // anything else is parsed as CSV.  Plain ASCII produces a single-column
      // header-only workbook rather than throwing.  The caller's existing
      // empty-extraction path (no data rows → no retrieval chunks, or a minimal
      // header-only chunk) handles this gracefully.
      const plainText = Buffer.from("this is not a spreadsheet at all");
      const result = extractSpreadsheet(plainText, "xlsx", "bad.xlsx");
      // The text includes the workbook header — extraction did not hard-fail
      expect(result.text).toContain("Sheet");
      // Warnings is always an array (never null/undefined)
      expect(Array.isArray(result.warnings)).toBe(true);
    });

    it("throws for a truncated XLSX (corrupt ZIP magic)", () => {
      // A buffer that starts with the ZIP PK signature but has no valid content
      // forces SheetJS into the XLSX parser which then fails on the corrupt ZIP.
      const truncatedZip = Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x00, 0x00]);
      expect(() =>
        extractSpreadsheet(truncatedZip, "xlsx", "corrupt.xlsx")
      ).toThrow(/Failed to parse spreadsheet/);
    });
  });
});
