import * as XLSX from "xlsx";

export interface SheetRow {
  [key: string]: string | number;
}

/**
 * Build an in-memory XLSX buffer from a simple sheet definition.
 * This avoids committing binary fixtures to git while still exercising
 * the real XLSX extraction / chunking pipeline.
 */
export function makeXlsxBuffer(
  sheetName: string,
  rows: SheetRow[]
): Buffer {
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
  return Buffer.from(buf);
}
