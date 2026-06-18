import { getDocumentOriginal } from "@workspace/api-client-react";

/**
 * Download a document's original file through the authenticated API client.
 *
 * Goes through the shared `customFetch` transport (which attaches the Clerk
 * bearer token) and triggers a blob download. This is required so downloads
 * work inside the embedded preview iframe, where a cookie-based
 * `<a href download>` anchor would 401.
 *
 * Throws on failure so callers can surface an error toast.
 */
export async function downloadOriginal(id: number, fileName: string): Promise<void> {
  const blob = await getDocumentOriginal(id);
  const url = URL.createObjectURL(blob);
  try {
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = fileName;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
  } finally {
    // Defer revocation so the browser can start the download first.
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }
}
