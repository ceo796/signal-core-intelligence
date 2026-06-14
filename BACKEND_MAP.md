# Signal87 Core — Backend Map

> Last updated: 2026-06-14. Source of truth: read the files below directly for the latest state.

---

## 1. What file starts the backend server?

**`artifacts/api-server/src/index.ts`**

Reads `PORT` from the environment, calls `app.listen(port)`, and logs startup via pino.
`app` is imported from `artifacts/api-server/src/app.ts`, which wires up middleware and routes.

---

## 2. What framework is being used?

**Express 5** (`express@^5.2.1`)

Middleware stack in `app.ts`:
- `pino-http` — structured request logging
- `cors` — permissive CORS (all origins in dev)
- `express.json()` / `express.urlencoded()` — body parsing
- All routes mounted at `/api`

---

## 3. Where is `POST /api/documents/:id/chat` defined?

**`artifacts/api-server/src/routes/chat/index.ts`** — `router.post("/documents/:id/chat", ...)`

Mounted via `artifacts/api-server/src/routes/index.ts` → `app.use("/api", router)` in `app.ts`.

---

## 4. Where is the OpenAI API call made?

Two places, both in the chat route handler (`artifacts/api-server/src/routes/chat/index.ts`):

| Call | File | Purpose |
|------|------|---------|
| Embeddings (question + all chunks) | `artifacts/api-server/src/lib/retriever.ts` — `getEmbedding()` + batch embed | Cosine similarity retrieval |
| Chat completion | `artifacts/api-server/src/routes/chat/index.ts` — `openai.chat.completions.create()` | Answer generation |

OpenAI client is a singleton defined in **`artifacts/api-server/src/lib/ai-provider.ts`**.

---

## 5. Where is the document upload route defined?

**`artifacts/api-server/src/routes/documents/index.ts`** — `router.post("/documents/upload", upload.single("file"), ...)`

Uses `multer` with `memoryStorage` (20 MB limit). The file never touches disk — it stays in RAM as `req.file.buffer` and is discarded after text extraction.

---

## 6. Where is text extraction handled?

**`artifacts/api-server/src/lib/text-extractor.ts`**

| Format | Library |
|--------|---------|
| PDF | `pdf-parse@1.1.1` (externalized from esbuild bundle — see note below) |
| DOCX | `mammoth` (externalized from esbuild bundle) |
| TXT / CSV | `Buffer.toString("utf-8")` — no library needed |

> **Known quirk:** `pdf-parse@1.1.1` runs a test file read at module load time when `module.parent` is null (CJS-in-ESM via esbuild). The file `node_modules/.pnpm/pdf-parse@1.1.1/node_modules/pdf-parse/index.js` is patched to remove that block, and `pdf-parse` + `mammoth` are listed in `external[]` in `artifacts/api-server/build.mjs`. If `pnpm install` reinstalls these packages, re-apply the patch.

---

## 7. Where is chunking handled?

**`artifacts/api-server/src/lib/chunker.ts`** — `chunkText(text: string): string[]`

- Splits on whitespace into words
- Chunk size: **500 words**
- Overlap: **50 words**
- Pure CPU — no external library or AI call

Called immediately after text extraction during upload, before inserting into the DB.

---

## 8. Where is retrieval handled?

**`artifacts/api-server/src/lib/retriever.ts`** — `retrieveRelevantChunks(question, chunks, topK=5)`

Algorithm:
1. Embed the user's question with `text-embedding-3-small`
2. Embed all chunks for the document (batch call)
3. Compute cosine similarity between question and each chunk
4. Return top-K chunks sorted by score

Embeddings are **not stored** — they are recomputed on every query. (Future improvement: persist embeddings in `chunks` table.)

---

## 9. Where are uploaded files stored?

**Nowhere.** Files are held in memory during the request (multer `memoryStorage`). Only the **extracted text** is persisted to the `documents` table. The original file bytes are discarded after extraction.

---

## 10. Where is document/chunk metadata stored?

In **PostgreSQL** via Drizzle ORM. Three tables:

| Table | Schema file | Contents |
|-------|-------------|----------|
| `documents` | `lib/db/src/schema/documents.ts` | id, file_name, file_type, extracted_text, uploaded_at |
| `chunks` | `lib/db/src/schema/chunks.ts` | id, document_id (FK), chunk_index, content |
| `chat_messages` | `lib/db/src/schema/chat_messages.ts` | id, document_id, role, content, debug (JSON), created_at |

The `debug` column on `chat_messages` stores `{ debug: DebugInfo, citations: Citation[] }` as a JSON string for every assistant message.

---

## 11. Is there a database?

**Yes — PostgreSQL.**

---

## 12. What kind of storage is it?

**Replit-provisioned PostgreSQL** (managed Postgres, accessed via `DATABASE_URL`).

- ORM: **Drizzle ORM** (`drizzle-orm/node-postgres`)
- Connection: `pg.Pool` with `DATABASE_URL`
- DB client entry point: `lib/db/src/index.ts`
- Schema push (dev only): `pnpm --filter @workspace/db run push`

Not SQLite. Not in-memory. Not Replit Key-Value DB.

---

## 13. What environment variables are required?

| Variable | Required | Where used | Notes |
|----------|----------|-----------|-------|
| `DATABASE_URL` | ✅ Yes | `lib/db/src/index.ts` | Postgres connection string |
| `OPENAI_API_KEY` | ✅ Yes | `artifacts/api-server/src/lib/ai-provider.ts` | Chat completions + embeddings |
| `PORT` | ✅ Yes (injected by workflow) | `artifacts/api-server/src/index.ts` | API server listens on this port (8080 in dev) |
| `SESSION_SECRET` | ⚠️ Set but unused | — | Present as a Replit secret; not used in current code |
| `NODE_ENV` | Injected | `app.ts` dev script | `development` in dev, `production` on deploy |

---

## 14. What command starts the backend?

**Development:**
```
pnpm --filter @workspace/api-server run dev
```
This runs: `export NODE_ENV=development && pnpm run build && pnpm run start`
- Build: `node ./build.mjs` (esbuild → `dist/index.mjs`)
- Start: `node --enable-source-maps ./dist/index.mjs`

**Production (deployed):**
```
node --enable-source-maps artifacts/api-server/dist/index.mjs
```
(Run directly after `pnpm --filter @workspace/api-server run build` with `NODE_ENV=production`.)

---

## 15. What command starts the frontend?

**Development:**
```
pnpm --filter @workspace/signal87-core run dev
```
Runs Vite dev server on port 23156.

**Production:**
Built as static files by `pnpm --filter @workspace/signal87-core run build` → served as static assets from `artifacts/signal87-core/dist/public`.

---

## 16. Are frontend and backend separate processes?

**Yes — fully separate processes.**

| Service | Process | Dev port | Prod |
|---------|---------|----------|------|
| API server | Node.js (Express 5) | 8080 | Node process |
| Frontend | Vite dev server | 23156 | Static file serving |

A **Replit reverse proxy** routes traffic:
- `/api/*` → API server (port 8080)
- `/*` → Frontend (port 23156 in dev, static in prod)

The frontend uses relative URLs — the proxy handles routing transparently.

---

## 17. What happens when the app is published?

On `Publish / Deploy`:

1. **API server** is built (`esbuild` → `dist/index.mjs`) and run as a Node.js process with `PORT=8080 NODE_ENV=production`.
2. **Frontend** is built (`vite build`) and served as static files from `artifacts/signal87-core/dist/public` with SPA rewrite (`/* → /index.html`).
3. The same Replit reverse proxy routes `/api/*` to the Express process and `/*` to the static files.
4. The health check polls `GET /api/healthz` to confirm the API is live before traffic is routed.
5. Secrets (`DATABASE_URL`, `OPENAI_API_KEY`) must be set in the Replit deployment secrets panel — they are not baked into the build.

---

## Key file index

```
artifacts/api-server/
  src/
    index.ts              ← entry point — reads PORT, calls app.listen()
    app.ts                ← Express app, middleware, mounts /api router
    routes/
      index.ts            ← combines health + documents + chat routers
      health/index.ts     ← GET /api/healthz
      documents/index.ts  ← document CRUD + upload + admin/stats + system/info
      chat/index.ts       ← POST chat, GET/DELETE history
    lib/
      ai-provider.ts      ← OpenAI singleton + PROVIDER_CONFIG
      chunker.ts          ← chunkText() — 500-word chunks, 50 overlap
      retriever.ts        ← cosine similarity retrieval via embeddings
      text-extractor.ts   ← PDF / DOCX / TXT / CSV → plain text
      logger.ts           ← pino logger singleton
  build.mjs               ← esbuild config (pdf-parse + mammoth externalized)

lib/
  db/
    src/
      index.ts            ← drizzle + pg.Pool, exports db client
      schema/
        documents.ts      ← documents table
        chunks.ts         ← chunks table
        chat_messages.ts  ← chat_messages table

artifacts/signal87-core/  ← React + Vite frontend (separate process)
```
