import * as XLSX from "xlsx";

export interface SpreadsheetExtraction {
  /** Full, human-readable rendering of the workbook (for extracted_text + preview). */
  text: string;
  /** Self-contained retrieval chunks, each prefixed with its sheet name + row range. */
  chunks: string[];
  /** Non-fatal truncation/limit notices for the caller to log (never silently dropped). */
  warnings: string[];
}

// Sensible limits to prevent runaway extraction on very large workbooks.
const MAX_SHEETS = 30;
const MAX_ROWS_PER_SHEET = 2000;
const MAX_COLS = 200;
const MAX_CELL_CHARS = 500;
const ROWS_PER_CHUNK = 40;
const MAX_CHUNK_CHARS = 4000;

// Prefer the formatted text SheetJS computes (handles dates / number formats),
// falling back to the raw value. Trims and caps very long cell values.
function formatCell(cell: XLSX.CellObject | undefined): string {
  if (!cell) return "";
  const raw = cell.w != null ? cell.w : cell.v;
  if (raw == null) return "";
  let s = String(raw).trim();
  if (s.length > MAX_CELL_CHARS) {
    s = `${s.slice(0, MAX_CELL_CHARS)}…`;
  }
  return s;
}

/**
 * Parse an .xlsx/.xls workbook into a readable text rendering plus sheet/row-aware
 * retrieval chunks. Every chunk embeds its sheet name and row range so downstream
 * citations carry spreadsheet provenance without any schema change.
 */
export function extractSpreadsheet(
  buffer: Buffer,
  _fileType: "xlsx" | "xls",
  fileName: string,
): SpreadsheetExtraction {
  const warnings: string[] = [];

  let workbook: XLSX.WorkBook;
  try {
    workbook = XLSX.read(buffer, { type: "buffer" });
  } catch (err) {
    throw new Error(
      `Failed to parse spreadsheet: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  const sheetNames = workbook.SheetNames;
  const sheetsToProcess = sheetNames.slice(0, MAX_SHEETS);
  if (sheetNames.length > MAX_SHEETS) {
    warnings.push(
      `Workbook has ${sheetNames.length} sheets; only the first ${MAX_SHEETS} were indexed.`,
    );
  }

  const textParts: string[] = [
    `Workbook: ${fileName} — ${sheetNames.length} sheet(s): ${sheetNames.join(", ")}`,
  ];
  const chunks: string[] = [];

  for (const sheetName of sheetsToProcess) {
    const ws = workbook.Sheets[sheetName];
    if (!ws || !ws["!ref"]) {
      textParts.push(`\nSheet: ${sheetName} (empty)`);
      continue;
    }

    const range = XLSX.utils.decode_range(ws["!ref"]);
    const startRow = range.s.r;
    const endRowRaw = range.e.r;
    const startCol = range.s.c;
    const endColRaw = range.e.c;

    const endCol = Math.min(endColRaw, startCol + MAX_COLS - 1);
    if (endColRaw - startCol + 1 > MAX_COLS) {
      warnings.push(
        `Sheet "${sheetName}" has more than ${MAX_COLS} columns; the extra columns were skipped.`,
      );
    }

    // First row is treated as the header row.
    const headerCells: string[] = [];
    for (let c = startCol; c <= endCol; c++) {
      const cell = ws[XLSX.utils.encode_cell({ r: startRow, c })] as XLSX.CellObject | undefined;
      headerCells.push(formatCell(cell));
    }
    const colLetters = headerCells.map((_, i) => XLSX.utils.encode_col(startCol + i));
    const headerKeys = headerCells.map((h, i) => h || colLetters[i]);
    const columnsLine = `Columns: ${headerKeys
      .map((h, i) => `${colLetters[i]}=${h}`)
      .join(", ")}`;

    const totalDataRows = endRowRaw - startRow;
    const lastDataRow = Math.min(endRowRaw, startRow + MAX_ROWS_PER_SHEET);
    if (totalDataRows > MAX_ROWS_PER_SHEET) {
      warnings.push(
        `Sheet "${sheetName}" has ${totalDataRows} data rows; only the first ${MAX_ROWS_PER_SHEET} were indexed.`,
      );
    }

    const indexedRows = Math.max(0, Math.min(totalDataRows, MAX_ROWS_PER_SHEET));
    const sheetLines: string[] = [
      `Sheet: ${sheetName} (${indexedRows} data rows × ${headerKeys.length} columns)`,
      columnsLine,
    ];

    // Accumulate row lines into chunks, flushing on row-count or char-size limits.
    const sheetChunkStart = chunks.length;
    let chunkRowLines: string[] = [];
    let chunkFirstRow = -1;
    let chunkLastRow = -1;
    let chunkCharCount = 0;

    const flushChunk = () => {
      if (chunkRowLines.length === 0) return;
      const prefix = `Sheet: ${sheetName} | Rows ${chunkFirstRow}–${chunkLastRow}\n${columnsLine}`;
      chunks.push(`${prefix}\n${chunkRowLines.join("\n")}`);
      chunkRowLines = [];
      chunkFirstRow = -1;
      chunkLastRow = -1;
      chunkCharCount = 0;
    };

    for (let r = startRow + 1; r <= lastDataRow; r++) {
      const rowNum = r + 1; // 1-based spreadsheet row number (matches Excel)
      const pairs: string[] = [];
      for (let c = startCol; c <= endCol; c++) {
        const cell = ws[XLSX.utils.encode_cell({ r, c })] as XLSX.CellObject | undefined;
        const val = formatCell(cell);
        if (val === "") continue;
        pairs.push(`${headerKeys[c - startCol]}=${val}`);
      }
      if (pairs.length === 0) continue; // skip blank rows (row number is preserved)

      const rowLine = `Row ${rowNum}: ${pairs.join("; ")}`;
      sheetLines.push(rowLine);

      // Cap an individual row line for chunking so a single very wide row
      // (many columns / long cells) cannot push a chunk past MAX_CHUNK_CHARS.
      const chunkRowLine =
        rowLine.length > MAX_CHUNK_CHARS ? `${rowLine.slice(0, MAX_CHUNK_CHARS - 1)}…` : rowLine;

      if (
        chunkRowLines.length >= ROWS_PER_CHUNK ||
        (chunkRowLines.length > 0 && chunkCharCount + chunkRowLine.length > MAX_CHUNK_CHARS)
      ) {
        flushChunk();
      }
      if (chunkFirstRow === -1) chunkFirstRow = rowNum;
      chunkLastRow = rowNum;
      chunkRowLines.push(chunkRowLine);
      chunkCharCount += chunkRowLine.length + 1;
    }
    flushChunk();

    // A header-only sheet (columns but no data) still gets one chunk so column-level
    // questions remain answerable.
    if (chunks.length === sheetChunkStart && headerCells.some((h) => h !== "")) {
      chunks.push(`Sheet: ${sheetName} | Header row\n${columnsLine}`);
    }

    if (sheetLines.length === 2) {
      sheetLines.push("(no data rows)");
    }
    if (totalDataRows > MAX_ROWS_PER_SHEET) {
      sheetLines.push(`… (showing first ${MAX_ROWS_PER_SHEET} of ${totalDataRows} data rows)`);
    }
    textParts.push(`\n${sheetLines.join("\n")}`);
  }

  // No usable content anywhere → return empty text so the caller's existing
  // empty-extraction path marks the document as failed.
  if (chunks.length === 0) {
    return { text: "", chunks: [], warnings };
  }

  return { text: textParts.join("\n"), chunks, warnings };
}
