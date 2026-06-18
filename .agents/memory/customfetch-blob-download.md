---
name: customFetch blob downloads need explicit responseType
description: Why reusing the generated API client for a binary/file download silently breaks text/plain and text/csv files.
---

# Blob downloads via the generated client must force `responseType: "blob"`

**Rule:** When implementing an authenticated file download by reusing the Orval-generated client (`@workspace/api-client-react`), do NOT call the generated operation (e.g. `getDocumentOriginal`) and expect a `Blob`. Call `customFetch<Blob>(getGet<Op>Url(id), { method: "GET", responseType: "blob" })` directly so blob parsing is forced.

**Why:** the generated operation omits `responseType`, so `customFetch` falls back to auto-inference from the response `Content-Type`. Auto-inference treats `application/json` as json and **`text/*` (including `text/plain` and `text/csv`) as text**, returning a *string* — even though the operation's TypeScript signature claims `Promise<Blob>`. `URL.createObjectURL(string)` then throws, so TXT/CSV original downloads fail while PDF/DOCX/XLSX (non-text MIME ⇒ inferred blob) appear to work. This made a PDF-only e2e pass while real TXT/CSV downloads were broken.

**How to apply:** any "download the original/raw file" feature, or any endpoint that can return text-like binaries, needs the explicit `responseType: "blob"`. To use it, export `customFetch` (and `ApiError`, `CustomFetchOptions`) from the api-client-react barrel; `getGet<Op>Url` is already exported via the generated barrel. Always test a text/plain or text/csv file, not just a PDF.
