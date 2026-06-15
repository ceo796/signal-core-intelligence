# Signal87 Core

A document-intelligence PoC: upload documents, then query them with an LLM that answers with grounded, per-source citations and a full Verification Trace.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- Auth: Clerk (Replit-managed) — `@clerk/express` (server), `@clerk/react` (frontend)
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- **API contract (source of truth):** `lib/api-spec/openapi.yaml` → codegen produces Zod (`@workspace/api-zod`) and React Query hooks (`@workspace/api-client-react`).
- **Backend:** `artifacts/api-server/src/` — routes in `routes/<name>/index.ts`, shared logic in `lib/`. See `BACKEND_MAP.md` for the full route + file index.
- **Frontend:** `artifacts/signal87-core/src/` — pages in `pages/`, routes in `App.tsx`, nav in `components/layout.tsx`.
- **DB schema:** `@workspace/db` (Drizzle).
- **Project docs:** `CHANGELOG.md` (per-checkpoint history), `BACKEND_MAP.md`, `QA_TEST_PLAN.md`.

## Architecture decisions

- **Contract-first:** every endpoint is defined in OpenAPI first; never hand-write client hooks or Zod schemas. Avoid naming a schema `<OperationIdPascal>Response`/`Body` (collides with Orval auto-symbols).
- **Retrieval:** cosine similarity over OpenAI `text-embedding-3-small` chunks; chat uses `gpt-4o-mini`. Single-doc and multi-doc retrieval live in `lib/retriever.ts`.
- **Citations + Verification Trace:** every LLM answer returns global `[Source N]` citations plus a debug trace (provider/model/chunk stats/latencies). This is a core product invariant — preserve it on any new LLM feature.
- **Ephemeral LLM features:** multi-chat and brief results are not persisted (only single-doc chat history is).
- **Feature duplication over coupling:** the Executive Brief duplicates the multi-chat retrieval/citation pattern rather than refactoring multi-chat, to avoid regressing it.

## Product

- **Document library:** upload (PDF/DOCX/TXT/CSV), list, detail page with tabbed Preview (in-platform PDF viewer) / Extracted Text / Citations / History / System, download original, re-index, delete.
- **Single-document chat:** ask questions about one document; persisted history; grounded citations + trace.
- **Multi-document comparison** (`/compare`): one question across 2–5 documents with grouped citations.
- **Executive Brief** (`/brief`): generate a structured brief (Executive Summary / Risk / Diligence / Contract Review / Comparison) over 1–5 documents, with an optional focus instruction, citations, and a trace. Comparison requires ≥2 documents.
- **Admin stats** (`/admin`).
- **Navigation tabs:** Documents | **Ask** (`/ask`, pick one ready document and jump into the existing single-doc chat) | **Activity** (`/activity`, read-only upload/extraction feed derived from existing document data — no separate activity store).

## User preferences

- Each feature is shipped as a named checkpoint with a `CHANGELOG.md` entry and updates to `BACKEND_MAP.md` / `QA_TEST_PLAN.md`.
- Scope discipline: no Gemini, global search, billing, or agents. Don't redesign existing UI or change durable storage / upload / download / delete / reindex / PDF viewer unless asked.

## Gotchas

- Always regenerate the client after editing `openapi.yaml`: `pnpm --filter @workspace/api-spec run codegen`.
- New backend routes require an API server restart to be picked up (dev server does not always hot-reload new route files).
- Verify with `pnpm run typecheck`, not `build` (build needs workflow-provided `PORT`/`BASE_PATH`).
- **Clerk approved-user gate:** set `VITE_APPROVED_EMAILS` in Replit Secrets to a comma-separated list of email addresses to restrict who can use the app. Leave it unset to admit all authenticated users (safe default for team launch). Changing it requires a frontend redeploy.
- **Clerk dev vs prod user stores:** accounts created during development do not carry over to the published (production) domain — team members must register again on the live URL.
- **Shared document library:** all approved users see the same documents (no per-user isolation). This is by design for the PoC; a future migration would add `user_id` to `documentsTable`.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
