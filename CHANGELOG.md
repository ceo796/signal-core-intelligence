# Signal87 Core — Changelog

---

## [Signal87_Core_Durable_Storage_v1] — 2026-06-14

### Summary
First stable checkpoint. Full document intelligence flow is operational end-to-end. All core data (extracted text, chunks, chat history, citations) is durably stored in PostgreSQL. Original file bytes are not retained; see Known Limitations.

### Added
- **Document upload pipeline** — multipart `POST /api/documents/upload` accepts PDF, DOCX, TXT, CSV (20 MB limit). Extracts text, chunks it, writes document + chunk rows to PostgreSQL.
- **Text chunking** — 500-word chunks with 50-word overlap (`lib/chunker.ts`). No external AI call.
- **Embedding-based retrieval** — on each chat query, all chunk texts are embedded with `text-embedding-3-small` and ranked by cosine similarity against the question embedding. Top 5 returned.
- **Chat completion** — `gpt-4o-mini` answers questions grounded only in the top-5 retrieved chunks. Cites chunks by number.
- **Citation storage** — assistant messages persist `{ debug, citations }` as JSON in `chat_messages.debug`, so citations are available when reloading history.
- **Verification Trace panel** — expandable citation chips in the chat UI showing document name, chunk number, relevance %, and expandable source excerpt.
- **AI Audit Trail panel** — collapsible panel per assistant message showing provider, model, route, fallback status, chunk counts, retrieval/LLM/total latency, errors.
- **Chat history** — `GET /api/documents/:id/history` returns full conversation. `DELETE /api/documents/:id/history` clears it.
- **Admin / System Panel** — live stats (document, chunk, message counts + format breakdown) plus full backend architecture panel (runtime, AI config, DB, env var status, all active routes).
- **`GET /api/system/info`** — machine-readable backend metadata; no secret values exposed.
- **`BACKEND_MAP.md`** — complete written record of backend architecture, storage behaviour, and known limitations.
- **`QA_TEST_PLAN.md`** — manual test plan covering all flows.

### Changed
- Admin page renamed "System Panel"; upgraded with architecture cards pulled from `/api/system/info`.
- `DEBUG_TRACE` panel renamed "AI Audit Trail" in chat UI.

### Fixed
- `pdf-parse@1.1.1` crashes at startup when bundled with esbuild (module.parent = null triggers a test-file read). Fix: patch `index.js` to remove the debug block; externalize `pdf-parse` and `mammoth` in `build.mjs`.
- Port-conflict (`EADDRINUSE`) on workflow restart after checkpoint restore. Fix: `fuser -k` stale processes before restarting workflows.
- Citations missing from chat history on reload. Fix: store `{ debug, citations }` together in `chat_messages.debug` (previously only `debug` was stored, citations were lost).
- Bad deep import path `@workspace/api-client-react/src/generated/api.schemas`. Fix: import from package root.

### Known Limitations (v1)
| # | Limitation |
|---|-----------|
| 1 | Original file bytes not retained — cannot re-extract without re-upload |
| 2 | Embeddings recomputed on every query — not persisted |
| 3 | No re-indexing endpoint — changing chunk params requires delete + re-upload |
| 4 | No pgvector — cosine similarity computed in-memory; degrades at scale |
| 5 | `pdf-parse` patch lives in `node_modules` — must be re-applied after clean install |
| 6 | 20 MB upload cap |
| 7 | `SESSION_SECRET` env var present but unused |

---

## [Pre-release] — 2026-06-13

### Added
- Monorepo scaffold: pnpm workspaces, TypeScript, Express 5 API server, React + Vite frontend.
- PostgreSQL schema: `documents`, `chunks`, `chat_messages` tables via Drizzle ORM.
- OpenAPI spec (`lib/api-spec/openapi.yaml`) with Orval codegen generating React Query hooks and Zod validators.
- Initial frontend pages: landing, documents list, document chat, admin stats.
- `GET /api/healthz` health check.
