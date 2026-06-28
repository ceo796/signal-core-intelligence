import { customFetch, getGetDocumentOriginalUrl } from "@workspace/api-client-react";

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Fetch the stored original file with auth, cache-busting, and retries. */
export async function fetchDocumentOriginalBlob(documentId: number): Promise<Blob> {
  const baseUrl = getGetDocumentOriginalUrl(documentId);
  let lastError: unknown;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const separator = baseUrl.includes("?") ? "&" : "?";
      const blob = await customFetch<Blob>(`${baseUrl}${separator}inline=1&t=${Date.now()}`, {
        method: "GET",
        responseType: "blob",
        headers: { accept: "application/pdf,application/octet-stream,*/*" },
      });
      if (blob.size === 0) throw new Error("Original file response was empty.");
      return blob;
    } catch (err) {
      lastError = err;
      if (attempt < 2) await wait(attempt === 0 ? 350 : 900);
    }
  }

  throw lastError instanceof Error ? lastError : new Error("Original file could not be retrieved.");
}