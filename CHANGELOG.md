# Signal87 Core — Changelog

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
- **Updated upload flow:** file bytes saved to GCS before extraction; if GCS upload fails the request is rejected 500; if extraction fails after GCS save, the document is still recorded (status `"failed"`) and returns 207 so the user can re-index.
- **Delete cascade to GCS:** `DELETE /api/documents/:id` now also deletes the GCS object (best-effort, non-fatal).
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
