import {
  customFetch,
  getDocument,
  getGetDocumentOriginalUrl,
  type Document,
} from "@workspace/api-client-react";

/**
 * Minimal shape needed to decide how to print a document. Both the document
 * list rows and the detail page already expose these fields, so the same
 * `PrintDocumentButton` can be reused everywhere.
 */
export interface PrintableDocument {
  id: number;
  fileName: string;
  fileType: string;
  originalFileAvailable: boolean;
  extractionStatus?: string | null;
}

function isPdf(fileType: string): boolean {
  return fileType.toLowerCase() === "pdf";
}

/**
 * Whether printing can produce anything for this document:
 * - PDFs print the stored original, or fall back to extracted text.
 * - Everything else prints the extracted text view.
 * A failed extraction with no stored original has nothing to print.
 */
export function canPrintDocument(doc: PrintableDocument): boolean {
  const extractionOk = doc.extractionStatus?.toLowerCase() === "success";
  return isPdf(doc.fileType) ? doc.originalFileAvailable || extractionOk : extractionOk;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatBytes(bytes?: number | null): string {
  if (bytes == null) return "—";
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB"];
  let value = bytes / 1024;
  let i = 0;
  while (value >= 1024 && i < units.length - 1) {
    value /= 1024;
    i++;
  }
  return `${value.toFixed(1)} ${units[i]}`;
}

function formatDate(value?: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Mount a hidden iframe, let `assignSource` point it at the printable content,
 * then trigger the browser print dialog once it loads. The iframe (and any
 * caller-owned resources via `onCleanup`) are torn down after printing.
 */
function runPrintFrame(
  assignSource: (iframe: HTMLIFrameElement) => void,
  onCleanup?: () => void,
): void {
  const iframe = window.document.createElement("iframe");
  iframe.setAttribute("aria-hidden", "true");
  iframe.style.position = "fixed";
  iframe.style.right = "0";
  iframe.style.bottom = "0";
  iframe.style.width = "0";
  iframe.style.height = "0";
  iframe.style.border = "0";
  iframe.style.visibility = "hidden";

  let cleaned = false;
  const cleanup = () => {
    if (cleaned) return;
    cleaned = true;
    try {
      onCleanup?.();
    } finally {
      iframe.remove();
    }
  };

  iframe.onload = () => {
    const win = iframe.contentWindow;
    if (!win) {
      cleanup();
      return;
    }
    win.onafterprint = () => cleanup();
    // Defer so the PDF plugin / text content has painted before printing.
    window.setTimeout(() => {
      try {
        win.focus();
        win.print();
      } catch {
        // Some browsers can throw here; the fallback timeout still cleans up.
      }
    }, 60);
    // Fallback cleanup in case `onafterprint` never fires (e.g. PDF plugin).
    window.setTimeout(cleanup, 60_000);
  };

  window.document.body.appendChild(iframe);
  assignSource(iframe);
}

/**
 * Print the stored original PDF. Fetches the file through the authenticated,
 * owner-scoped original endpoint (so unauth = 401, unowned = 404), renders it
 * in a hidden iframe, prints, then revokes the object URL.
 */
async function printPdfOriginal(id: number): Promise<void> {
  const blob = await customFetch<Blob>(getGetDocumentOriginalUrl(id), {
    method: "GET",
    responseType: "blob",
  });
  const url = URL.createObjectURL(blob);
  runPrintFrame(
    (iframe) => {
      iframe.src = url;
    },
    () => URL.revokeObjectURL(url),
  );
}

function buildExtractedTextHtml(doc: Document): string {
  const meta = [
    doc.fileType.toUpperCase(),
    formatBytes(doc.fileSize),
    `Uploaded ${formatDate(doc.uploadedAt)}`,
    `${doc.chunkCount} chunks`,
  ].join(" \u00b7 ");

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>${escapeHtml(doc.fileName)}</title>
<style>
  @page { margin: 18mm; }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; }
  body {
    font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    color: #111827;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  header {
    border-bottom: 2px solid #111827;
    padding-bottom: 12px;
    margin-bottom: 18px;
  }
  h1 {
    font-size: 18pt;
    line-height: 1.25;
    margin: 0 0 6px;
    word-break: break-word;
  }
  .meta {
    font-family: ui-monospace, "SF Mono", "SFMono-Regular", Menlo, Consolas, monospace;
    font-size: 9pt;
    color: #6b7280;
  }
  pre {
    white-space: pre-wrap;
    word-wrap: break-word;
    overflow-wrap: anywhere;
    font-family: ui-monospace, "SF Mono", "SFMono-Regular", Menlo, Consolas, monospace;
    font-size: 10.5pt;
    line-height: 1.5;
    margin: 0;
    color: #1f2937;
  }
  footer {
    margin-top: 24px;
    padding-top: 10px;
    border-top: 1px solid #d1d5db;
    font-family: ui-monospace, "SF Mono", "SFMono-Regular", Menlo, Consolas, monospace;
    font-size: 8pt;
    color: #9ca3af;
  }
</style>
</head>
<body>
  <header>
    <h1>${escapeHtml(doc.fileName)}</h1>
    <div class="meta">${escapeHtml(meta)}</div>
  </header>
  <pre>${escapeHtml(doc.extractedText ?? "")}</pre>
  <footer>Printed from Signal87 \u00b7 ${escapeHtml(formatDate(new Date().toISOString()))}</footer>
</body>
</html>`;
}

/**
 * Print the readable extracted-text view for a document. Used for TXT / DOCX /
 * CSV / XLSX (spreadsheet sheet + row context is already encoded in the
 * extracted text) and as the PDF fallback when no original is stored.
 */
function printExtractedText(doc: Document): void {
  const html = buildExtractedTextHtml(doc);
  runPrintFrame((iframe) => {
    iframe.srcdoc = html;
  });
}

/**
 * Prepare and print a document.
 *
 * - Real PDFs with a stored original print the original file.
 * - Everything else (and PDFs without a stored original) prints the extracted
 *   text view, fetched fresh through the authenticated, owner-scoped detail
 *   endpoint so the full text and owner checks are always enforced.
 *
 * Throws on failure (incl. nothing printable) so callers can show a toast.
 */
export async function printDocument(doc: PrintableDocument): Promise<void> {
  if (isPdf(doc.fileType) && doc.originalFileAvailable) {
    await printPdfOriginal(doc.id);
    return;
  }

  const full = await getDocument(doc.id);
  if (!full.extractedText || !full.extractedText.trim()) {
    throw new Error("No printable content available for this document.");
  }
  printExtractedText(full);
}
