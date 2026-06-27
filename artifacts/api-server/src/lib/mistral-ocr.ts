import { chunkText } from "./chunker";
import type { SupportedFileType } from "./text-extractor";

const MISTRAL_OCR_ENDPOINT = "https://api.mistral.ai/v1/ocr";
const DEFAULT_MISTRAL_OCR_MODEL = "mistral-ocr-latest";
const DEFAULT_TIMEOUT_MS = 60_000;

export type ExtractionProvider = "local" | "mistral" | "auto";

interface MistralOcrPage {
  index?: number;
  markdown?: string;
  text?: string;
  blocks?: Array<{
    type?: string;
    text?: string;
    markdown?: string;
    content?: string;
  }>;
}

interface MistralOcrResponse {
  pages?: MistralOcrPage[];
  markdown?: string;
  text?: string;
  usage_info?: {
    pages_processed?: number;
    doc_size_bytes?: number;
  };
}

export interface OcrExtractionResult {
  text: string;
  chunks: string[];
  warnings: string[];
  provider: "mistral";
  model: string;
  pagesProcessed: number | null;
}

export function getExtractionProvider(): ExtractionProvider {
  const configured = process.env.EXTRACTION_PROVIDER?.trim().toLowerCase();
  if (configured === "mistral" || configured === "auto" || configured === "local") {
    return configured;
  }
  return process.env.MISTRAL_API_KEY ? "auto" : "local";
}

export function getMistralOcrStatus() {
  const provider = getExtractionProvider();
  const configured = Boolean(process.env.MISTRAL_API_KEY);
  return {
    provider,
    configured,
    ready: provider === "local" || configured,
    model: process.env.MISTRAL_OCR_MODEL || DEFAULT_MISTRAL_OCR_MODEL,
    includeBlocks: process.env.MISTRAL_OCR_INCLUDE_BLOCKS === "true",
    tableFormat: getTableFormat(),
    extractHeader: getBooleanEnv("MISTRAL_OCR_EXTRACT_HEADER"),
    extractFooter: getBooleanEnv("MISTRAL_OCR_EXTRACT_FOOTER"),
    confidenceScoresGranularity: getConfidenceScoresGranularity(),
    localMinChars: parsePositiveInt(process.env.OCR_LOCAL_MIN_CHARS, 500),
    timeoutMs: parsePositiveInt(process.env.MISTRAL_OCR_TIMEOUT_MS, DEFAULT_TIMEOUT_MS),
  };
}

export function supportsMistralOcr(fileType: SupportedFileType): boolean {
  return fileType === "pdf";
}

export function shouldEscalateToOcr(fileType: SupportedFileType, text: string): boolean {
  if (!supportsMistralOcr(fileType)) return false;

  const minChars = parsePositiveInt(process.env.OCR_LOCAL_MIN_CHARS, 500);
  const normalized = text.replace(/\s+/g, "");
  return normalized.length < minChars;
}

export async function extractWithMistralOcr(
  buffer: Buffer,
  fileType: SupportedFileType,
  fileName: string,
): Promise<OcrExtractionResult> {
  if (!supportsMistralOcr(fileType)) {
    throw new Error(`Mistral OCR is not enabled for ${fileType.toUpperCase()} files.`);
  }

  const apiKey = process.env.MISTRAL_API_KEY;
  if (!apiKey) {
    throw new Error("MISTRAL_API_KEY is not configured.");
  }

  const model = process.env.MISTRAL_OCR_MODEL || DEFAULT_MISTRAL_OCR_MODEL;
  const timeoutMs = parsePositiveInt(process.env.MISTRAL_OCR_TIMEOUT_MS, DEFAULT_TIMEOUT_MS);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(MISTRAL_OCR_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(buildMistralOcrRequest(buffer, model)),
      signal: controller.signal,
    });

    const bodyText = await response.text();
    if (!response.ok) {
      throw new Error(`Mistral OCR failed with ${response.status}: ${summarizeErrorBody(bodyText)}`);
    }

    const body = parseOcrResponse(bodyText);
    const text = mistralResponseToText(body);
    const pagesProcessed = body.usage_info?.pages_processed ?? body.pages?.length ?? null;

    return {
      text,
      chunks: text.trim() ? chunkText(text) : [],
      warnings: [
        `Mistral OCR extracted ${pagesProcessed ?? "unknown"} page(s) from ${fileName}.`,
      ],
      provider: "mistral",
      model,
      pagesProcessed,
    };
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new Error(`Mistral OCR timed out after ${timeoutMs}ms.`);
    }
    throw err;
  } finally {
    clearTimeout(timeout);
  }
}

function buildMistralOcrRequest(buffer: Buffer, model: string) {
  const request: Record<string, unknown> = {
    model,
    document: {
      type: "document_url",
      document_url: `data:application/pdf;base64,${buffer.toString("base64")}`,
    },
    include_image_base64: false,
  };

  const tableFormat = getTableFormat();
  if (tableFormat) {
    request.table_format = tableFormat;
  }

  if (process.env.MISTRAL_OCR_INCLUDE_BLOCKS === "true") {
    request.include_blocks = true;
  }

  if (getBooleanEnv("MISTRAL_OCR_EXTRACT_HEADER")) {
    request.extract_header = true;
  }

  if (getBooleanEnv("MISTRAL_OCR_EXTRACT_FOOTER")) {
    request.extract_footer = true;
  }

  const confidenceScoresGranularity = getConfidenceScoresGranularity();
  if (confidenceScoresGranularity) {
    request.confidence_scores_granularity = confidenceScoresGranularity;
  }

  return request;
}

function parseOcrResponse(bodyText: string): MistralOcrResponse {
  try {
    return JSON.parse(bodyText) as MistralOcrResponse;
  } catch {
    throw new Error("Mistral OCR returned an invalid JSON response.");
  }
}

function mistralResponseToText(response: MistralOcrResponse): string {
  if (Array.isArray(response.pages) && response.pages.length > 0) {
    return response.pages
      .map((page, pageIndex) => {
        const pageText = page.markdown ?? page.text ?? blocksToText(page.blocks);
        if (!pageText?.trim()) return "";
        const pageNumber = page.index === undefined ? pageIndex + 1 : page.index + 1;
        return `\n\n[Page ${pageNumber}]\n${pageText.trim()}`;
      })
      .filter(Boolean)
      .join("\n")
      .trim();
  }

  return (response.markdown ?? response.text ?? "").trim();
}

function blocksToText(blocks: MistralOcrPage["blocks"]): string {
  if (!Array.isArray(blocks)) return "";
  return blocks
    .map((block) => block.markdown ?? block.text ?? block.content ?? "")
    .filter((text) => text.trim().length > 0)
    .join("\n\n");
}

function summarizeErrorBody(bodyText: string): string {
  if (!bodyText.trim()) return "empty response body";
  try {
    const parsed = JSON.parse(bodyText) as { message?: unknown; error?: unknown; detail?: unknown };
    const candidate = parsed.message ?? parsed.error ?? parsed.detail;
    if (typeof candidate === "string") return candidate.slice(0, 300);
    return JSON.stringify(candidate ?? parsed).slice(0, 300);
  } catch {
    return bodyText.slice(0, 300);
  }
}

function parsePositiveInt(value: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function getTableFormat(): "markdown" | "html" | null {
  const value = process.env.MISTRAL_OCR_TABLE_FORMAT?.trim().toLowerCase();
  if (value === "html" || value === "markdown") return value;
  return null;
}

function getConfidenceScoresGranularity(): "page" | "word" | null {
  const value = process.env.MISTRAL_OCR_CONFIDENCE_SCORES?.trim().toLowerCase();
  if (value === "page" || value === "word") return value;
  return null;
}

function getBooleanEnv(key: string): boolean {
  return process.env[key]?.trim().toLowerCase() === "true";
}
