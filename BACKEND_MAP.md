# Signal87 Core — Backend Map

> Checkpoint: **Signal87_Core_Durable_Storage_v1**
> Last updated: 2026-06-14

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

Uses `multer` with `memoryStorage` (20 MB limit). The raw file bytes never touch disk — see storage section below.

---

## 6. Where is text extraction handled?

**`artifacts/api-server/src/lib/text-extractor.ts`**

| Format | Library |
|--------|---------|
| PDF | `pdf-parse@1.1.1` (externalized from esbuild) |
| DOCX | `mammoth` (externalized from esbuild) |
| TXT / CSV | `Buffer.toString("utf-8")` — no library |

> **Known quirk:** `pdf-parse@1.1.1` runs a test-file read at module load time when `module.parent` is null (CJS-in-ESM via esbuild). Workaround: `node_modules/.pnpm/pdf-parse@1.1.1/node_modules/pdf-parse/index.js` is patched to remove that block, and both `pdf-parse` and `mammoth` are in `external[]` in `artifacts/api-server/build.mjs`. Re-apply if `pnpm install` reinstalls those packages.

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

> **Limitation:** Embeddings are **not persisted** — recomputed fresh on every query. See Known Limitations section.

---

## 9. Where are uploaded files stored?

### What IS stored (durable — PostgreSQL)

| Data | Table / Column | Notes |
|------|---------------|-------|
| Extracted text | `documents.extracted_text` (TEXT) | Full document text, survives restarts and deploys |
| Chunks | `chunks` table | All text segments with `chunk_index` and `document_id` FK |
| Chat history | `chat_messages` table | Includes citations + debug JSON per assistant message |

### What is NOT stored

| Data | Why not |
|------|---------|
| Original file bytes (PDF/DOCX/etc.) | Held in memory only (`multer.memoryStorage()`), discarded after extraction. Never written to disk or object storage. |
| Embeddings | Recomputed on every query from the stored chunk text. Not persisted. |

---

## 10. How does re-indexing work?

Full re-indexing (re-chunking + re-embedding) **does not require re-uploading** because the full extracted text is stored in `documents.extracted_text`.

Current state: there is no re-indexing endpoint. To re-index a document today you must delete it and re-upload the file.

Planned path for a future re-indexing endpoint:
1. `DELETE FROM chunks WHERE document_id = $id`
2. Read `documents.extracted_text`
3. Call `chunkText()` with new parameters
4. Insert new chunks into `chunks`
5. (Optionally persist new embeddings if vector storage is added)

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

## 12. How can the original file be retrieved or reprocessed?

**The original file binary cannot be retrieved** — it is discarded after extraction. However:

- The **full extracted text** is available in `documents.extracted_text` and can be used to re-chunk without re-uploading
- The **filename and file type** are preserved in `documents.file_name` and `documents.file_type`
- If the original file needs to be re-extracted with different logic, the user must re-upload the file

---

## 13. Is there a database?

**Yes — PostgreSQL** (Replit-managed).

---

## 14. What kind of storage is it?

**Replit-provisioned PostgreSQL**, accessed via `DATABASE_URL`.

- ORM: **Drizzle ORM** (`drizzle-orm/node-postgres`)
- Connection: `pg.Pool` with `DATABASE_URL`
- DB entry point: `lib/db/src/index.ts`
- Schema push (dev only): `pnpm --filter @workspace/db run push`

Not SQLite. Not in-memory. Not Replit Key-Value DB. Not object/file storage.

---

## 15. What environment variables are required?

| Variable | Required | Where used | Notes |
|----------|----------|-----------|-------|
| `DATABASE_URL` | ✅ Yes | `lib/db/src/index.ts` | Postgres connection string |
| `OPENAI_API_KEY` | ✅ Yes | `artifacts/api-server/src/lib/ai-provider.ts` | Chat completions + embeddings |
| `PORT` | ✅ Yes (workflow-injected) | `artifacts/api-server/src/index.ts` | 8080 in dev |
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
5. Secrets (`DATABASE_URL`, `OPENAI_API_KEY`) must be set in the Replit deployment secrets panel

---

## Known Limitations

| # | Limitation | Impact | Mitigation path |
|---|-----------|--------|----------------|
| 1 | Original file bytes not retained | Cannot re-extract with different parser logic without re-upload | Add object storage (e.g. Replit Object Storage) to persist raw files |
| 2 | Embeddings recomputed on every query | Extra OpenAI API cost and ~200–600ms latency per query | Add `embedding` vector column to `chunks` table; persist on upload |
| 3 | No re-indexing endpoint | Changing chunk size/overlap requires delete + re-upload | Implement `POST /api/documents/:id/reindex` using stored `extracted_text` |
| 4 | No pgvector | Cosine similarity computed in-memory over all chunks; degrades at scale | Add pgvector extension; store embeddings in DB; use `<=>` ANN operator |
| 5 | `pdf-parse` patch in node_modules | Patch is in VCS but could be wiped by clean install | Upstream fix or replace with a library that does not run test files at load time |
| 6 | Upload size limit | 20 MB cap on uploaded files | Configurable via multer `limits.fileSize` |
| 7 | `SESSION_SECRET` unused | Dead env var | Remove or wire into future auth layer |

---

## Active API Routes

```
GET    /api/healthz
GET    /api/documents
POST   /api/documents/upload
GET    /api/documents/:id
DELETE /api/documents/:id
GET    /api/documents/:id/chunks
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
      index.ts            ← combines health + documents + chat routers
      health/index.ts     ← GET /api/healthz
      documents/index.ts  ← document CRUD, upload, admin/stats, system/info
      chat/index.ts       ← POST chat, GET/DELETE history
    lib/
      ai-provider.ts      ← OpenAI singleton + PROVIDER_CONFIG
      chunker.ts          ← chunkText() — 500-word chunks, 50 overlap
      retriever.ts        ← cosine similarity retrieval via OpenAI embeddings
      text-extractor.ts   ← PDF / DOCX / TXT / CSV → plain text
      logger.ts           ← pino logger singleton
  build.mjs               ← esbuild config (pdf-parse + mammoth externalized)

lib/
  db/
    src/
      index.ts            ← drizzle + pg.Pool, exports db client
      schema/
        documents.ts      ← documents table (id, file_name, file_type, extracted_text, uploaded_at)
        chunks.ts         ← chunks table (id, document_id FK, chunk_index, content)
        chat_messages.ts  ← chat_messages table (id, document_id, role, content, debug JSON, created_at)

artifacts/signal87-core/  ← React + Vite frontend (separate process)
  src/
    pages/
      home.tsx            ← landing page
      documents.tsx       ← document list + upload trigger
      document-chat.tsx   ← chat interface with Verification Trace + citation chips
      admin.tsx           ← System Panel (stats + backend architecture)
```
