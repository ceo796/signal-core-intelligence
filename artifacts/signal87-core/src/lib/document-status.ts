export type DocumentStatusTone = "ready" | "processing" | "warning" | "error";

export interface DocumentStatus {
  label: string;
  description: string;
  tone: DocumentStatusTone;
  /** Original file is stored and re-indexing can be attempted. */
  canReindex: boolean;
  /** Original file is missing, so the user must upload the file again. */
  needsReupload: boolean;
  /** Document is indexed and can answer questions. */
  isReady: boolean;
  /**
   * True when extraction ran but found no machine-readable text (e.g. a
   * scanned/image-only PDF). Distinct from a hard extraction error so the UI
   * can display honest copy ("re-indexing may not help without OCR") and use
   * an amber warning tone instead of a red error tone.
   */
  isNoExtractableText: boolean;
}

/** Minimal shape needed to derive a document's status. */
export interface DocumentStatusInput {
  extractionStatus?: string | null;
  extractionError?: string | null;
  chunkCount: number;
  originalFileAvailable: boolean;
}

/**
 * Returns true when the extraction error string matches the backend's
 * "no text found" case, as opposed to a hard parse/IO failure.
 */
function isNoTextError(extractionError?: string | null): boolean {
  return (extractionError ?? "").toLowerCase().includes("no text");
}

/**
 * Derives a single, user-facing status for a document from the fields the API
 * already returns. Centralized so the list, detail, and chat views always agree.
 */
export function getDocumentStatus(doc: DocumentStatusInput): DocumentStatus {
  const status = (doc.extractionStatus ?? "").toLowerCase();
  const hasChunks = doc.chunkCount > 0;
  const hasOriginal = doc.originalFileAvailable;

  // Still processing — upload is synchronous today, but defensive for the future.
  if (status === "pending") {
    return {
      label: "Processing",
      description: "This document is still being processed. Check back in a moment.",
      tone: "processing",
      canReindex: false,
      needsReupload: false,
      isReady: false,
      isNoExtractableText: false,
    };
  }

  // Extraction failed, or succeeded but produced no searchable chunks.
  if (status === "failed" || !hasChunks) {
    if (hasOriginal) {
      // Distinguish "no text found" (scanned/image PDF) from a hard parse error.
      if (isNoTextError(doc.extractionError)) {
        return {
          label: "No searchable text",
          description:
            "This file is stored and downloadable, but Signal87 could not find machine-readable text. It may be a scanned or image-only PDF. Re-indexing will not help without OCR.",
          tone: "warning",
          canReindex: true,
          needsReupload: false,
          isReady: false,
          isNoExtractableText: true,
        };
      }
      return {
        label: "Extraction error",
        description:
          "Text extraction failed. The original file is stored — try re-indexing. If the problem persists, the file may be malformed or password-protected.",
        tone: "error",
        canReindex: true,
        needsReupload: false,
        isReady: false,
        isNoExtractableText: false,
      };
    }
    return {
      label: "Needs re-upload",
      description:
        "We couldn't read this file and the original isn't stored, so it can't be re-indexed. Delete it and upload the file again.",
      tone: "error",
      canReindex: false,
      needsReupload: true,
      isReady: false,
      isNoExtractableText: false,
    };
  }

  // Indexed and answerable, but the original file is missing (legacy upload):
  // preview and download are unavailable until the file is re-uploaded.
  if (!hasOriginal) {
    return {
      label: "Original file missing",
      description:
        "Indexed and ready for questions, but the original file isn't stored — preview and download aren't available. Upload the file again to restore them.",
      tone: "warning",
      canReindex: false,
      needsReupload: false,
      isReady: true,
      isNoExtractableText: false,
    };
  }

  return {
    label: "Ready",
    description: "Indexed and ready for questions.",
    tone: "ready",
    canReindex: false,
    needsReupload: false,
    isReady: true,
    isNoExtractableText: false,
  };
}
