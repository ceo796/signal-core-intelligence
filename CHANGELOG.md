# Signal87 Core — Changelog

---

## [Signal87_Core_Document_Detail_Page_v1] — 2026-06-14

### Summary
Added a dedicated **tabbed document record page** at `/documents/:id` (Option 3). Clicking a document card now opens this detail page instead of jumping straight to Analyze. The page is a read/inspect surface with a header (metadata + primary actions) and five tabs: Preview, Extracted Text, Citations, History, System. The intelligence backend (retrieval, OpenAI routing, citation payloads, Verification Trace) is untouched; the only backend change is one additive, read-only field. No Gemini, no global search, no billing, no agents, no UI redesign, no Executive Briefs, no migration logic.

### Added
- **Frontend page** (`artifacts/signal87-core/src/pages/document-detail.tsx`): new route `/documents/:id` (added in `App.tsx` before `/documents/:id/chat`).
  - **Header:** Back to Documents, document name, file-type badge, file size, upload date, chunk count, and primary actions — Analyze Document (→ `/documents/:id/chat`), Compare (→ `/compare?preselect=:id`), Download Original (anchor to `/api/documents/:id/original`), Re-index (existing `useReindexDocument`), Delete (existing `useDeleteDocument`, returns to `/documents` on success).
  - **Preview tab:** PDFs render inline via an object-URL blob fetched from `GET /api/documents/:id/original` (avoids the `attachment` Content-Disposition forcing a download); non-PDF files show a readable extracted-text preview. No editor, annotations, or page controls beyond the browser's native viewer.
  - **Extracted Text tab:** full extracted text, copy button, chunk count, extraction-status badge, indexed timestamp.
  - **Citations tab:** the document's chunks as source blocks (chunk #, content, character length) — chunk inspection only, not a new AI feature.
  - **History tab:** prior chat messages paired into Q/A with timestamp and citations count (parsed from the stored `debug` JSON). Chat persistence behavior unchanged.
  - **System tab:** document ID, original stored (yes/no), storage provider, storage key, file size, file type, extraction status, extraction error (if any), chunks created, re-index available, download available.
- **Documents list** (`pages/documents.tsx`): the card body now links to `/documents/:id`; the Analyze quick-action and Delete control are preserved.
- **Compare preselect** (`pages/multi-document-chat.tsx`): reads an optional `?preselect=<id>` query param on mount to seed the selection. Additive; manual selection is unchanged.

### Changed (backend — minimal, additive, read-only)
- **OpenAPI** (`lib/api-spec/openapi.yaml`): added optional nullable `extractedText` to the `Document` schema.
- **Route** (`artifacts/api-server/src/routes/documents/index.ts`): `docToResponse` gained an `includeFullText` flag — `GET /documents/:id` returns the full `extractedText`; `GET /documents` (list) leaves it `null` to keep the list payload light. The 200-char `extractedTextPreview` is unchanged. No storage, routing, citation, trace, upload, download, delete, or reindex behavior changed.
  - **Why full text was needed:** chunks overlap by 50 words, so the full extracted text is not losslessly reconstructable from chunks; the existing preview is only 200 chars. A read-only response field is the clean way to power the Extracted Text and non-PDF Preview tabs.

### Not changed (explicitly preserved)
- Single-document chat and multi-document comparison (routes, prompts, citation payloads, Verification Trace, persistence).
- Upload / download (`/original`) / delete / reindex / object storage.
- OpenAI routing (embeddings + gpt-4o-mini); no fallback provider.

### Verification
- `pnpm --filter @workspace/api-server run typecheck` and `pnpm --filter @workspace/signal87-core run typecheck` — both pass.
- Backend curl: `GET /documents/:id` returns full `extractedText` (944 chars for the TXT doc); list stays light (`extractedText: null`); uploaded a test PDF (original stored, served as `application/pdf`), then deleted it (204 → 404). Chunks/history/original endpoints all 200.
- E2E browser: PDF detail page renders the embedded PDF viewer with the actual page content; TXT detail page renders full extracted text in Preview; Compare with `?preselect=2` opens with that document preselected (1/5) and prompts for one more. Test PDF cleaned up; library back to 4 documents.

---

## [Signal87_Core_Multi_Document_Comparison_v1] — 2026-06-14

### Summary
Added a narrow, controlled **Multi-Document Comparison** feature: select 2–5 indexed documents, ask one question, and get one synthesized answer with citations grouped by document and a full Verification Trace. The feature is additive and self-contained — single-document chat, upload/download/delete/reindex, storage, and retrieval are all untouched. No Gemini, no global search, no billing, no agents, no UI redesign, no fallback provider.

### Added
- **OpenAPI contract** (`lib/api-spec/openapi.yaml`): `POST /documents/multi-chat` (operationId `multiChat`) with schemas `MultiChatInput` (`documentIds` int[] min 2 / max 5, `question`), `MultiCitation`, `MultiChatDocumentStat`, `MultiDebugInfo` (includes `chunksRetrievedByDocument`), and response schema `MultiChatResult`. Codegen produces `MultiChatBody` zod (enforces 2–5), `useMultiChat` hook, and the model types.
  - **Naming note:** the response schema is named `MultiChatResult` (not `MultiChatResponse`) because Orval auto-generates a `<OperationIdPascal>Response` const for `multiChat`; a schema of the same name collides.
- **Retriever** (`artifacts/api-server/src/lib/retriever.ts`): new `retrieveAcrossDocuments(question, groups, perDocTopK=3)` + `DocumentGroup` / `DocumentRetrieval` interfaces. Embeds the question once, then takes top-K per document so every selected document is represented and reports `chunksSearched` per document. The single-doc `retrieveRelevantChunks` is unchanged.
- **Route** (`artifacts/api-server/src/routes/multi-chat/index.ts`): validates via `MultiChatBody` zod, dedupes ids, confirms all docs exist (404 with missing ids) and each has chunks (400 naming empty docs). Builds a multi-doc system prompt (compare ONLY selected docs, cite `[Source N]` global 1-based, identify agreements, identify differences/contradictions, say when info is insufficient, no outside knowledge), assigns global citation numbers, and returns `{ answer, citations, debug }`. Mounted in `routes/index.ts` before the single-doc chat router. Added to the `/api/system/info` route list.
- **Frontend** (`artifacts/signal87-core/src/pages/multi-document-chat.tsx`): self-contained page at `/compare` with 2–5 document selection (capped), one question box, synthesized answer with inline `[Source N]` pills (parser `/\[\s*sources?\s+(\d+)\s*\]/gi`), citations grouped by document, and a Verification Trace + collapsible Trace Detail (route, provider, model, fallback, docs searched, per-document chunk counts, latencies). Added route to `App.tsx` and "Compare Docs" nav item to `layout.tsx`.

### Design notes
- **Ephemeral:** multi-chat is not persisted — `chat_messages` is keyed per single `documentId`, so persisting multi-doc results would require storage changes. Avoided by design.
- **Global citation numbering:** sources are numbered 1-based across the combined retrieved set (document selection order, then relevance within each doc), each labeled with its source document.

### Not changed (explicitly preserved)
- Single-document chat route, prompt, citation payload, and persistence.
- Upload / download (`/original`) / delete / reindex / object storage.
- OpenAI routing (embeddings + gpt-4o-mini); no fallback provider added.

### Verification
- `pnpm --filter @workspace/api-server run typecheck` and `pnpm --filter @workspace/signal87-core run typecheck` — both pass.
- Backend curl: valid 2-doc compare (grouped citations + per-doc trace), <2 docs → 400, >5 docs → 400, nonexistent doc → 404, duplicate ids collapse to <2 distinct → 400, 3-doc isolation (no unselected doc leaks into citations), single-doc chat regression → 200.
- E2E browser test (`/compare`): select policy_a.txt + policy_b.txt, ask comparison question, synthesized answer with inline pills, Verification Trace, grouped citations, Trace Detail (provider openai / model gpt-4o-mini / docs searched 2 / per-document breakdown), and expandable source excerpt — all verified.

---

## [Signal87_Core_Verification_Trace_Polish_v1] — 2026-06-14

### Summary
Frontend-only polish of the chat citation and trust layer. The answer now renders inline citation pills instead of raw `[Chunk N]` text, and a single unified **Verification Trace** section presents both the cited sources and the technical trace. No backend, citation payload, storage, retrieval, or upload/delete behavior was changed.

### Changed (frontend only)
- **Inline citation pills:** raw `[Chunk N]` / `[Chunks N]` references the model emits in answer text are parsed (`/\[\s*chunks?\s+(\d+)\s*\]/gi`) and replaced with clean, clickable inline citation pills. Malformed tokens are left as-is (safe fallback).
- **Citation chips:** each source chip shows the chunk number, document name, relevance score (e.g. "58% match"), and expands to reveal the source excerpt.
- **Unified Verification Trace:** assistant messages now group everything under one "Verification Trace" header — the source citation chips plus a collapsible **Trace Detail** panel.
- **Trace Detail** (renamed from "AI Audit Trail") preserves full technical visibility: provider, model, route, document searched, chunks searched/retrieved, latency, and fallback yes/no.
- **Shared active-chunk state:** clicking an inline pill highlights and expands the matching source chip, and vice versa.
- **Home page:** "Full Debug Trace" feature label renamed to "Verification Trace" with an updated description.

### Not changed (explicitly preserved)
- Backend architecture — no route, prompt, or server logic changes.
- Citation payload shape — `chunkIndex`, `relevanceScore`, `content` consumed as-is; `chat_messages.debug` `{ debug, citations }` format unchanged.
- Object storage, re-indexing, OpenAI routing (embeddings + gpt-4o-mini), and upload/delete behavior — all unchanged.
- Legacy debug-only chat history still renders (backward compatible).

### Verification
- `pnpm --filter @workspace/signal87-core run typecheck` — passes.
- Live chat test confirmed inline `[Chunk 1]` → citation pill conversion; citation chip shows document name + relevance score + expandable excerpt; Trace Detail intact.

---

## [Signal87_Core_Durable_File_Storage_v2] — 2026-06-14

### Summary
Full durable file storage added. Original uploaded file bytes are now persisted in Replit Object Storage (GCS-backed). Documents can be downloaded as original files and re-indexed at any time without re-uploading. The previous checkpoint ("Durable_Storage_v1") is corrected: it stored extracted text and chunks durably, but not original file bytes. v2 completes both layers.

### Added
- **Replit Object Storage** provisioned (`DEFAULT_OBJECT_STORAGE_BUCKET_ID`, `PRIVATE_OBJECT_DIR`, `PUBLIC_OBJECT_SEARCH_PATHS` set as secrets).
- **`artifacts/api-server/src/lib/file-store.ts`** — server-side GCS upload, download, and delete using Replit sidecar auth. Functions: `uploadFile(buffer, name, contentType)`, `downloadFile(storageKey)`, `deleteFile(storageKey)`, `isConfigured()`, `getMimeType(fileType)`.
- **`artifacts/api-server/src/lib/objectStorage.ts`** — GCS client wrapper from Replit Object Storage skill (required peer for sidecar auth setup).
- **`artifacts/api-server/src/lib/objectAcl.ts`** — ACL framework (required companion to objectStorage.ts).
- **`GET /api/documents/:id/original`** — streams the original uploaded file from GCS with correct MIME type and `Content-Disposition: attachment` header.
- **`POST /api/documents/:id/reindex`** — re-downloads original from GCS, re-extracts text, deletes old chunks, creates new chunks, updates document record. Chat history is preserved.
- **New DB columns on `documents` table:** `file_size` (integer), `extraction_status` (text, default `"pending"`), `extraction_error` (text nullable), `storage_provider` (text nullable), `storage_key` (text nullable).
- **Updated upload flow (fail-closed):** if object storage is not configured the upload is rejected with 503 — durable storage is required, no non-durable uploads. File bytes saved to GCS before extraction; if GCS upload fails the request is rejected 500. If the DB write fails after the GCS save, the just-uploaded object is deleted (compensating cleanup) to avoid orphans. If extraction fails after a successful GCS save, the document is still recorded (status `"failed"`) and returns 207 so the user can re-index.
- **Delete cascade to GCS (reliable):** `DELETE /api/documents/:id` deletes the GCS object first (awaited, `ignoreNotFound`), then removes DB rows. If the GCS delete fails it returns 500 and leaves the DB record intact for retry — no silent orphaning.
- **Updated `GET /api/system/info`:** now returns `fileStorageConfig` object (`provider`, `bucketConfigured`, `originalFilesStored`, `embeddingsPersisted`) in addition to the string `fileStorage` description.
- **Updated System Panel** (`admin.tsx`): new "FILE STORAGE" card showing provider, bucket configured (yes/no), original files stored (yes/no), embeddings persisted (no), re-index available (yes/no).
- **Updated `Document` schema** in OpenAPI and generated Zod: adds `fileSize`, `extractionStatus`, `extractionError`, `storageProvider`, `storageKey`, `originalFileAvailable` fields.
- **`@google-cloud/storage` and `google-auth-library`** installed on `@workspace/api-server`. Already externalized in `build.mjs` (`@google-cloud/*` glob).

### Changed
- Upload route now returns 207 (not 422) when the file is saved to GCS but extraction fails — the document record is preserved so re-index can retry.
- `documents.extracted_text` column is now nullable (was NOT NULL). Existing data unaffected.
- System Panel replaces "File Storage: none (memory only)" row with a dedicated storage card.
- Route count: 11 → 13 (added `/original` and `/reindex`).

### Fixed
- n/a (no regression fixes in this release)

### Naming correction
The v1 checkpoint was called `Signal87_Core_Durable_Storage_v1` but only stored the extracted text and intelligence layer (chunks, chat history) durably. The original binary file was discarded. That checkpoint is now accurately described as a **Durable Text Index**. v2 adds **Durable File Storage** (original file bytes in object storage), making both layers complete.

### Known Limitations (v2)
| # | Limitation |
|---|-----------|
| 1 | Embeddings recomputed on every query — not persisted |
| 2 | No pgvector — cosine similarity computed in-memory |
| 3 | `pdf-parse` patch lives in `node_modules` — must be re-applied after clean install |
| 4 | 20 MB upload cap |
| 5 | `SESSION_SECRET` env var present but unused |
| 6 | Documents uploaded before v2 have no `storage_key` — original download / re-index not available |

---

## [Signal87_Core_Durable_Storage_v1] — 2026-06-14  *(Durable Text Index)*

> **Naming correction:** This checkpoint stored extracted text, chunks, and chat history durably in PostgreSQL, but did NOT store original file bytes. It is more accurately described as a **Durable Text Index** checkpoint, not Durable File Storage.

### Summary
First stable checkpoint. Full document intelligence flow operational end-to-end. All extracted content (text, chunks, chat history, citations) durably stored in PostgreSQL. Original file bytes were not retained.

### Added
- Document upload pipeline (PDF, DOCX, TXT, CSV — 20 MB limit)
- Text extraction (pdf-parse, mammoth, utf-8)
- 500-word chunking with 50-word overlap
- Embedding-based retrieval (text-embedding-3-small, cosine similarity, top-5)
- Chat completion (gpt-4o-mini, grounded in top-5 chunks)
- Citation storage (`chat_messages.debug` as `{ debug, citations }` JSON)
- Verification Trace citation chips in chat UI
- AI Audit Trail collapsible panel per assistant message
- Chat history persistence + clear
- Admin / System Panel with live stats + backend architecture cards
- `GET /api/system/info` endpoint (no secrets exposed)
- `BACKEND_MAP.md`, `CHANGELOG.md`, `QA_TEST_PLAN.md` documentation

### Fixed
- `pdf-parse@1.1.1` startup crash (patched `index.js`, externalized in esbuild)
- Port conflict on workflow restart (`fuser -k`)
- Citations lost on history reload (store `{ debug, citations }` together)
- Bad deep import path from `@workspace/api-client-react`

---

## [Pre-release] — 2026-06-13

### Added
- Monorepo scaffold: pnpm workspaces, TypeScript, Express 5, React + Vite
- PostgreSQL schema: `documents`, `chunks`, `chat_messages` via Drizzle ORM
- OpenAPI spec (`lib/api-spec/openapi.yaml`) with Orval codegen
- Initial frontend pages: landing, documents list, document chat, admin stats
- `GET /api/healthz` health check
