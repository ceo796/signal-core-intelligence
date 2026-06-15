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
}

/** Minimal shape needed to derive a document's status. */
export interface DocumentStatusInput {
  extractionStatus?: string | null;
  chunkCount: number;
  originalFileAvailable: boolean;
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
    };
  }

  // Extraction failed, or succeeded but produced no searchable text.
  if (status === "failed" || !hasChunks) {
    if (hasOriginal) {
      return {
        label: "Extraction failed",
        description:
          "No readable text could be extracted. This may be a scanned, image-only, blank, password-protected, or malformed PDF. Try a text-based PDF or an OCR-enabled version.",
        tone: "error",
        canReindex: true,
        needsReupload: false,
        isReady: false,
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
    };
  }

  return {
    label: "Ready",
    description: "Indexed and ready for questions.",
    tone: "ready",
    canReindex: false,
    needsReupload: false,
    isReady: true,
  };
}
