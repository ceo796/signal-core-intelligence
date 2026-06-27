import mammoth from "mammoth";
import pdfParse from "pdf-parse/lib/pdf-parse.js";
import { chunkText } from "./chunker";
import { extractSpreadsheet } from "./spreadsheet";
import {
  extractWithMistralOcr,
  getExtractionProvider,
  shouldEscalateToOcr,
  supportsMistralOcr,
} from "./mistral-ocr";

export type SupportedFileType = "pdf" | "docx" | "txt" | "csv" | "xlsx" | "xls";

const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
const XLS_MIME = "application/vnd.ms-excel";

export function getFileType(mimetype: string, originalname: string): SupportedFileType | null {
  const ext = originalname.split(".").pop()?.toLowerCase();
  if (mimetype === "application/pdf" || ext === "pdf") return "pdf";
  if (
    mimetype === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    ext === "docx"
  )
    return "docx";
  if (mimetype === "text/plain" || ext === "txt") return "txt";
  // CSV is checked before the legacy Excel mime, since Excel sometimes labels .csv
  // files as application/vnd.ms-excel — the extension keeps CSV on its existing path.
  if (mimetype === "text/csv" || ext === "csv") return "csv";
  if (mimetype === XLSX_MIME || ext === "xlsx") return "xlsx";
  if (mimetype === XLS_MIME || ext === "xls") return "xls";
  return null;
}

export async function extractText(buffer: Buffer, fileType: SupportedFileType): Promise<string> {
  switch (fileType) {
    case "pdf": {
      const data = await pdfParse(buffer);
      return data.text;
    }
    case "docx": {
      const result = await mammoth.extractRawText({ buffer });
      return result.value;
    }
    case "txt":
    case "csv": {
      return buffer.toString("utf-8");
    }
    case "xlsx":
    case "xls": {
      return extractSpreadsheet(buffer, fileType, "spreadsheet").text;
    }
  }
}

export interface ExtractionResult {
  text: string;
  chunks: string[];
  warnings: string[];
  provider: "local" | "mistral";
}

/**
 * Single entry point used by upload + reindex: produces both the readable text and
 * the retrieval chunks. Spreadsheets use sheet/row-aware extraction; every other
 * type keeps its existing extract-then-chunk behavior unchanged.
 */
export async function extractAndChunk(
  buffer: Buffer,
  fileType: SupportedFileType,
  fileName: string,
): Promise<ExtractionResult> {
  if (fileType === "xlsx" || fileType === "xls") {
    const result = extractSpreadsheet(buffer, fileType, fileName);
    return { ...result, provider: "local" };
  }

  const provider = getExtractionProvider();
  const warnings: string[] = [];

  if (provider === "mistral" && supportsMistralOcr(fileType)) {
    try {
      return await extractWithMistralOcr(buffer, fileType, fileName);
    } catch (err) {
      warnings.push(`Mistral OCR unavailable; used local extraction. ${(err as Error).message}`);
    }
  }

  const text = await extractText(buffer, fileType);
  if (provider === "auto" && shouldEscalateToOcr(fileType, text)) {
    try {
      const ocr = await extractWithMistralOcr(buffer, fileType, fileName);
      return {
        ...ocr,
        warnings: [
          `Local PDF extraction produced limited text; escalated to OCR.`,
          ...ocr.warnings,
        ],
      };
    } catch (err) {
      warnings.push(`OCR fallback unavailable; kept local extraction. ${(err as Error).message}`);
    }
  }

  const chunks = text.trim() ? chunkText(text) : [];
  return { text, chunks, warnings, provider: "local" };
}
