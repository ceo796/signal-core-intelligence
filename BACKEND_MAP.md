# Signal87 Core — Backend Map

> Checkpoint: **Signal87_Core_Executive_Brief_Generator_v1**
> Last updated: 2026-06-14
> Note: `Signal87_Core_Executive_Brief_Generator_v1` adds one additive route (`POST /api/documents/brief`, in `routes/brief/index.ts`) plus a brief-template lib (`lib/brief.ts`). It reuses `retrieveAcrossDocuments` and the multi-chat citation/trace pattern (duplicated, not refactored into multi-chat). Brief results are ephemeral (not persisted). The brief LLM call uses `response_format: json_object` to return structured `{title, sections}`. Single-doc chat, multi-chat, prompts, citation payload, storage, upload/download/delete/reindex, and OpenAI routing are unchanged.
> Prior: `Signal87_Core_Multi_Document_Comparison_v1` added `POST /api/documents/multi-chat` and `retrieveAcrossDocuments`. The earlier `Verification_Trace_Polish_v1` checkpoint was frontend-only.

---

## 1. What file starts the backend server?

**`artifacts/api-server/src/index.ts`**

Reads `PORT` from the environment, calls `app.listen(port)`, logs startup via pino.
`app` is imported from `artifacts/api-server/src/app.ts`, which wires up middleware and mounts routes.

---

## 2. What framework is being used?

**Express 5** (`express@^5.2.1`)

Middleware stack in `app.ts`:
- `pino-http` — structured JSON request logging
- `cors` — permissive (all origins, dev and prod)
- `express.json()` / `express.urlencoded()` — body parsing
- All routes mounted at `/api`

---

## 3. Where is `POST /api/documents/:id/chat` defined?

**`artifacts/api-server/src/routes/chat/index.ts`** — `router.post("/documents/:id/chat", ...)`

Mounted via `artifacts/api-server/src/routes/index.ts` → `app.use("/api", router)` in `app.ts`.

---

## 4. Where is the OpenAI API call made?

Two calls per chat request:

| Call | File | Purpose |
|------|------|---------|
| Embeddings — question + all chunks | `artifacts/api-server/src/lib/retriever.ts` — `getEmbedding()` + batch embed | Cosine similarity ranking |
| Chat completion | `artifacts/api-server/src/routes/chat/index.ts` | Answer generation |

OpenAI client singleton: **`artifacts/api-server/src/lib/ai-provider.ts`**

---

## 5. Where is the document upload route defined?

**`artifacts/api-server/src/routes/documents/index.ts`** — `router.post("/documents/upload", upload.single("file"), ...)`

Uses `multer` with `memoryStorage` (20 MB limit). The upload flow is:
1. Receive file bytes in memory
2. **Fail-closed:** if object storage is not configured, reject the upload with 503 (durable storage is required for this checkpoint)
3. Upload original bytes to Replit Object Storage (GCS-backed)
4. Extract text
5. Chunk text
6. Write document + chunks to PostgreSQL. **If this DB step fails, the just-uploaded GCS object is deleted (compensating cleanup) to avoid orphans.**

---

## 6. Where is text extraction handled?

**`artifacts/api-server/src/lib/text-extractor.ts`**

| Format | Library |
|--------|---------|
| PDF | `pdf-parse@1.1.1` (externalized from esbuild) |
| DOCX | `mammoth` (externalized from esbuild) |
| TXT / CSV | `Buffer.toString("utf-8")` — no library |

> **Known quirk:** `pdf-parse@1.1.1` runs a test-file read at module load time when `module.parent` is null (CJS-in-ESM via esbuild). Workaround: `node_modules/.pnpm/pdf-parse@1.1.1/node_modules/pdf-parse/index.js` is patched to remove that block, and both `pdf-parse` and `mammoth` are in `external[]` in `artifacts/api-server/build.mjs`. Re-apply after any clean install.

---

## 7. Where is chunking handled?

**`artifacts/api-server/src/lib/chunker.ts`** — `chunkText(text: string): string[]`

- Splits on whitespace into words
- Chunk size: **500 words**
- Overlap: **50 words**
- Pure CPU — no AI call

Called immediately after text extraction during upload, before writing to the DB.

---

## 8. Where is retrieval handled?

**`artifacts/api-server/src/lib/retriever.ts`** — `retrieveRelevantChunks(question, chunks, topK=5)`

Algorithm:
1. Embed the user question with `text-embedding-3-small`
2. Embed all chunks for the document (batch call)
3. Compute cosine similarity between question embedding and each chunk embedding
4. Return top-K chunks sorted by score descending

> **Limitation:** Embeddings are **not persisted** — recomputed fresh on every query.

---

## 9. Where are files stored?

### What IS stored (durable)

| Data | Storage | Notes |
|------|---------|-------|
| **Original file bytes** | Replit Object Storage (GCS-backed) | Stored on every upload (required — upload is rejected with 503 if storage is unconfigured). Key saved in `documents.storage_key`. Provider: `replit-object-storage`. |
| Extracted text | `documents.extracted_text` (PostgreSQL TEXT) | Full document text, survives restarts and deploys |
| Chunks | `chunks` table (PostgreSQL) | All text segments with `chunk_index` and `document_id` FK |
| Chat history + citations | `chat_messages` table (PostgreSQL) | Citations + debug JSON per assistant message |
| File metadata | `documents` table — `file_name`, `file_type`, `file_size`, `storage_provider`, `storage_key`, `extraction_status`, `extraction_error` | All persisted on upload |

### What is NOT stored

| Data | Why not |
|------|---------|
| Embeddings | Recomputed on every query from stored chunk text — not persisted |

### Object storage key format

Storage key format: `{PRIVATE_OBJECT_DIR}/documents/{uuid}`

Where `PRIVATE_OBJECT_DIR` is the Replit-provisioned GCS path (e.g. `replit-objstore-xxx/private`).
Stored in `documents.storage_key`. Used by file-store.ts to reconstruct bucket/object names for download and delete.

---

## 10. How does re-indexing work?

**Re-indexing is fully available** because the original file is stored in object storage.

Endpoint: **`POST /api/documents/:id/reindex`**

Flow:
1. Look up document; verify `storage_key` is set
2. Download original file bytes from GCS (`file-store.ts:downloadFile`)
3. Re-extract text (`text-extractor.ts:extractText`)
4. `DELETE FROM chunks WHERE document_id = $id`
5. Call `chunkText()` with current parameters
6. Insert new chunks
7. Update `documents.extracted_text`, `extraction_status`, `extraction_error`
8. Chat history is **preserved** — not deleted on re-index

### Delete cascade (reliable)

`DELETE /api/documents/:id` deletes the GCS object **first** (awaited; uses `ignoreNotFound`), then removes the DB rows. If the GCS delete fails, the request returns 500 and the DB record is left intact (with `storage_key`) so the delete can be safely retried — no silent orphaning.

---

## 11. How do citations connect back to chunks?

Each `Citation` object stored in `chat_messages.debug` (as JSON) contains:

| Field | Source | Purpose |
|-------|--------|---------|
| `chunkIndex` | `chunks.chunk_index` | Maps back to the exact chunk row |
| `content` | `chunk.content.slice(0, 300)` | Source excerpt shown in the UI |
| `relevanceScore` | cosine similarity (0–1) | Ranking confidence |

To resolve a citation to its full chunk: `SELECT content FROM chunks WHERE document_id = $docId AND chunk_index = $chunkIndex`.

The frontend Verification Trace panel uses `chunkIndex + 1` for 1-based display (Chunk 1, Chunk 2…) and shows the excerpt inline as an expandable chip.

---

## 12. How can the original file be retrieved?

**`GET /api/documents/:id/original`** — returns the original file bytes from GCS.

- Response headers: `Content-Type` (correct MIME type), `Content-Disposition: attachment; filename="..."`, `Content-Length`
- Returns 404 if no `storage_key` (document was uploaded before durable storage was enabled)
- Downloads from `{PRIVATE_OBJECT_DIR}/documents/{uuid}` via `@google-cloud/storage`

---

## 13. Is there a database?

**Yes — PostgreSQL** (Replit-managed).

---

## 14. What kind of storage is it?

**Two storage layers:**

| Layer | Technology | Used for |
|-------|-----------|---------|
| PostgreSQL | Replit-managed Postgres, accessed via `DATABASE_URL`, Drizzle ORM | Document metadata, extracted text, chunks, chat history |
| Object Storage | Replit Object Storage (GCS-backed), auth via sidecar at `127.0.0.1:1106` | Original file bytes |

---

## 15. What environment variables are required?

| Variable | Required | Where used | Notes |
|----------|----------|-----------|-------|
| `DATABASE_URL` | ✅ Yes | `lib/db/src/index.ts` | Postgres connection string |
| `OPENAI_API_KEY` | ✅ Yes | `artifacts/api-server/src/lib/ai-provider.ts` | Chat completions + embeddings |
| `PORT` | ✅ Yes (workflow-injected) | `artifacts/api-server/src/index.ts` | 8080 in dev |
| `DEFAULT_OBJECT_STORAGE_BUCKET_ID` | ✅ Yes (object storage) | Replit sidecar | GCS bucket ID |
| `PRIVATE_OBJECT_DIR` | ✅ Yes (object storage) | `artifacts/api-server/src/lib/file-store.ts` | Base path for private object uploads |
| `PUBLIC_OBJECT_SEARCH_PATHS` | ✅ Yes (object storage) | `objectStorage.ts` | Not used by document upload, provisioned alongside the bucket |
| `SESSION_SECRET` | ⚠️ Present, unused | — | Replit secret, not referenced in current code |
| `NODE_ENV` | Injected | app startup | `development` in dev, `production` on deploy |

---

## 16. What command starts the backend?

**Development:**
```bash
pnpm --filter @workspace/api-server run dev
```
This runs: `export NODE_ENV=development && pnpm run build && pnpm run start`
- Build: `node ./build.mjs` (esbuild → `dist/index.mjs`)
- Start: `node --enable-source-maps ./dist/index.mjs`

**Production:**
```bash
node --enable-source-maps artifacts/api-server/dist/index.mjs
```

---

## 17. What command starts the frontend?

**Development:**
```bash
pnpm --filter @workspace/signal87-core run dev
```
Vite dev server on port 23156.

**Production:** Built as static files from `artifacts/signal87-core/dist/public`, served statically.

---

## 18. Are frontend and backend separate processes?

**Yes — fully separate.**

| Service | Process | Dev port |
|---------|---------|----------|
| API server | Node.js (Express 5) | 8080 |
| Frontend | Vite dev server | 23156 |

A Replit reverse proxy routes `/api/*` → API server and `/*` → frontend.

---

## 19. What happens when the app is published?

1. API server built (`esbuild` → `dist/index.mjs`) and run as a Node.js process with `PORT=8080 NODE_ENV=production`
2. Frontend built (`vite build`) and served as static files with SPA rewrite (`/* → /index.html`)
3. Same reverse proxy routes requests
4. Health check polls `GET /api/healthz` before traffic is routed
5. Secrets (`DATABASE_URL`, `OPENAI_API_KEY`, `DEFAULT_OBJECT_STORAGE_BUCKET_ID`, `PRIVATE_OBJECT_DIR`, `PUBLIC_OBJECT_SEARCH_PATHS`) must be set in the Replit deployment secrets panel — object storage secrets are auto-provisioned by Replit and carry over to production

---

## Known Limitations

| # | Limitation | Impact | Mitigation path |
|---|-----------|--------|----------------|
| 1 | Embeddings recomputed on every query | Extra OpenAI API cost and ~200–600ms latency per query | Add `embedding` vector column to `chunks` table; persist on upload |
| 2 | No re-indexing endpoint updates chunk params via UI | User must call API directly to adjust chunk size/overlap | Add a settings panel |
| 3 | No pgvector | Cosine similarity computed in-memory over all chunks; degrades at scale | Add pgvector extension; store embeddings in DB; use `<=>` ANN operator |
| 4 | `pdf-parse` patch in node_modules | Patch wiped by clean install | Upstream fix or replace with a library that does not run test files at load time |
| 5 | Upload size limit | 20 MB cap on uploaded files | Configurable via multer `limits.fileSize` |
| 6 | `SESSION_SECRET` unused | Dead env var | Remove or wire into future auth layer |
| 7 | Documents uploaded before v2 have no `storage_key` | Original download / re-index not available for pre-v2 documents | Re-upload to get durable storage |

---

## Active API Routes

```
GET    /api/healthz
GET    /api/documents                  ← list (extractedText omitted/null; light payload)
POST   /api/documents/upload
GET    /api/documents/:id               ← single (adds full extractedText — additive, read-only)
DELETE /api/documents/:id
GET    /api/documents/:id/chunks
GET    /api/documents/:id/original     ← NEW v2 (also feeds the in-platform PDF viewer; unchanged)
POST   /api/documents/:id/reindex      ← NEW v2
POST   /api/documents/multi-chat       ← NEW multi-doc comparison
POST   /api/documents/brief            ← NEW executive brief (5 types, 1–5 docs, structured JSON)
POST   /api/documents/:id/chat
GET    /api/documents/:id/history
DELETE /api/documents/:id/history
GET    /api/admin/stats
GET    /api/system/info
```

---

## Key File Index

```
artifacts/api-server/
  src/
    index.ts              ← entry point — reads PORT, calls app.listen()
    app.ts                ← Express app, middleware, mounts /api router
    routes/
      index.ts            ← combines health + documents + multi-chat + brief + chat routers
      health/index.ts     ← GET /api/healthz
      documents/index.ts  ← document CRUD, upload, original, reindex, admin/stats, system/info
      chat/index.ts       ← POST chat, GET/DELETE history (single-doc)
      multi-chat/index.ts ← POST /documents/multi-chat (2–5 doc comparison, ephemeral)
      brief/index.ts      ← POST /documents/brief (executive brief, 1–5 docs, ephemeral)
    lib/
      ai-provider.ts      ← OpenAI singleton + PROVIDER_CONFIG
      brief.ts            ← BRIEF_TEMPLATES (5 types) + buildBriefRetrievalQuery + COMPARISON_MIN_DOCS_MESSAGE
      chunker.ts          ← chunkText() — 500-word chunks, 50 overlap
      retriever.ts        ← cosine similarity retrieval (single-doc + retrieveAcrossDocuments)
      text-extractor.ts   ← PDF / DOCX / TXT / CSV → plain text
      file-store.ts       ← GCS upload / download / delete for original files (NEW v2)
      objectStorage.ts    ← GCS client wrapper (Replit sidecar auth)
      objectAcl.ts        ← ACL framework (required by objectStorage.ts)
      logger.ts           ← pino logger singleton
  build.mjs               ← esbuild config (@google-cloud/* already externalized)

lib/
  db/
    src/
      index.ts            ← drizzle + pg.Pool, exports db client
      schema/
        documents.ts      ← documents table — id, file_name, file_type, file_size,
                             extracted_text, extraction_status, extraction_error,
                             storage_provider, storage_key, uploaded_at
        chunks.ts         ← chunks table (id, document_id FK, chunk_index, content)
        chat_messages.ts  ← chat_messages table (id, document_id, role, content, debug JSON, created_at)

artifacts/signal87-core/  ← React + Vite frontend (separate process)
  src/
    pages/
      home.tsx            ← landing page
      documents.tsx       ← document list + upload trigger
      document-chat.tsx   ← single-doc chat with Verification Trace + citation chips
      multi-document-chat.tsx ← /compare — 2–5 doc comparison, grouped citations + trace
      admin.tsx           ← System Panel (stats + backend architecture + storage config)
```
