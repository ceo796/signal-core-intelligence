# Signal87 Core — Changelog

---

## [Signal87_Landing_Trust_Section_v1] — 2026-06-18  *(New "Trusted AI, grounded in your documents." trust section on the public landing page; frontend-only, content/UI only)*

### Summary
Adds a dedicated **trust** section to the public landing page (`/`), placed directly **after the hero** and **before "How it works."** It leads with the heading **"Trusted AI, grounded in your documents."**, a supporting paragraph, and **three cards** — **Grounded Responses**, **Verification Trace**, and **Model Transparency** — reusing the existing card styling (rounded border, `bg-white/70`, blue icon chip). **Frontend-only, additive content:** no backend, auth, DB, OpenAPI/codegen, or routing changes; the existing hero ("Turn documents into decisions.") and all other sections are untouched.

### Changed — frontend
- **`artifacts/signal87-core/src/pages/home.tsx`** — added a `TRUST` data array and a new `{/* Trust */}` `<section>` between the hero and the "How it works" section; imported `Anchor`, `Fingerprint`, and `Eye` icons (lucide) for the three cards. No other sections modified.

### Verification
- `pnpm --filter @workspace/signal87-core run typecheck` — clean.
- Visual check at `/` (public, no auth): the trust section renders below the hero with all three cards and correct copy/icons; hero and downstream sections unchanged; no new console errors.

---

## [Signal87_Print_Documents_v1] — 2026-06-18  *(Print any document — the stored PDF original, or a clean extracted-text view for everything else — from the detail page and the documents dashboard; frontend-only)*

### Summary
Adds a **Print** action so a signed-in owner can print any of their documents. Two surfaces share one reusable `PrintDocumentButton`: a clearly visible **labelled Print button** in the Document Detail action bar (between **Download Original** and **Re-Index**), and a **compact printer-icon button** in every Documents dashboard **list row** and **grid card** (just before Delete). **Real PDFs with a stored original print the original file**; **everything else (TXT / DOCX / CSV / XLSX, and PDFs with no stored original) prints a clean, readable extracted-text view** with the document name + metadata. **Frontend-only:** no backend, auth/Clerk, owner, DB schema, OpenAPI/codegen, upload, storage, extraction, chat, brief, agent, or routing changes; **no new public URLs**. Both print paths go through the **existing authenticated, owner-scoped** API transport, so unauthenticated still **401**s and cross-owner still **404**s, and **Download Original is untouched**.

### Added — frontend
- **`artifacts/signal87-core/src/lib/print-document.ts`** *(new)* — the print engine:
  - `PrintableDocument` (minimal `{ id, fileName, fileType, originalFileAvailable, extractionStatus? }`) + `canPrintDocument(doc)` gate: a PDF is printable if it has a **stored original or** a **successful extraction**; a non-PDF is printable only on **successful extraction**.
  - `printDocument(doc)` — PDF-with-original → fetch `GET /api/documents/:id/original` as an **authenticated blob** via `customFetch(..., { responseType: "blob" })` → object URL → hidden iframe → browser print → **revoke**. Otherwise → fetch `GET /api/documents/:id` (full `extractedText` from the owner-scoped detail endpoint) → hidden iframe `srcdoc` with a print-optimized HTML view → print. Throws on failure (incl. "nothing printable") so callers can toast.
  - All user-controlled content (`fileName`, metadata, `extractedText`) is **HTML-escaped** before it enters `srcdoc` (no injection). The hidden-iframe lifecycle is **idempotently** cleaned up (revoke object URL + remove iframe) on `onafterprint`, with a 60s fallback if it never fires.
- **`artifacts/signal87-core/src/components/print-document-button.tsx`** *(new)* — reusable `PrintDocumentButton`: `variant="button"` (labelled outline, detail page) and `variant="icon"` (compact ghost printer icon, dashboard rows/cards). Printer icon, `Loader2` spinner while preparing, `sonner` error toast on failure, **auto-disabled** via `canPrintDocument`, and `preventDefault()/stopPropagation()` so clicking inside a clickable row/card never navigates.

### Changed — frontend (additive wiring only)
- **`artifacts/signal87-core/src/pages/document-detail.tsx`** — `<PrintDocumentButton document={doc} />` added to the header action bar **after Download Original** (Download Original / Re-Index / Delete / Ask all unchanged).
- **`artifacts/signal87-core/src/pages/documents.tsx`** — `<PrintDocumentButton variant="icon" />` added to the grid-card actions and the list-row actions (`h-7 w-7` in the list), placed **just before Delete**; existing Ask/Re-Index/Delete and the list⇄grid view toggle unchanged.

### Verification
- `pnpm --filter @workspace/signal87-core run typecheck` — clean.
- **e2e (signed-in, approved `ceo@signal87.ai`):** list view + grid view show the compact Print button before Delete; the PDF detail page shows the labelled **Print** alongside Download Original / Re-Index / Ask / Delete. Clicking Print on a PDF fires `GET /api/documents/:id/original` (**200/304**) with **no error toast**; clicking Print on a Ready **TXT** document fires `GET /api/documents/:id` (**200/304**) with **no error toast**; **Download Original** still works (no regression).
- **Security:** both print paths reuse the existing authenticated transport — unauth → **401**, cross-owner → **404**; approved-email gate unchanged; **no new public URLs**.
- **Architecture review:** passed — correctness, iframe print lifecycle / leak, `srcdoc` XSS escaping, `canPrintDocument` gating, and Download-Original regression all clear.

---

## [Signal87_Embedded_Preview_Auth_Transport_v1] — 2026-06-18  *(Authenticated `/api/*` calls now work inside the embedded preview iframe — attach Clerk's verified session token as a Bearer header, centralized in the API fetch layer)*

### Summary
Inside the Replit **embedded preview iframe**, the Clerk dev **session cookie can't be established** (browser third-party-cookie limitation), so every authenticated `GET /api/*` returned **401** even though the UI showed a signed-in user. This **supersedes** the prior `Signal87_Document_Load_Lag_Fix_v1` workaround note ("open in a standalone tab") — the embedded preview now works. **Root cause:** the frontend relied solely on the session cookie for transport. The backend already accepted **either** a cookie **or** `Authorization: Bearer <token>` (standard `@clerk/express` `clerkMiddleware`), so the fix is **frontend-only and centralized**: attach Clerk's verified session token as a Bearer header on every request through the shared API fetch layer. **No backend change. No weakening of Clerk auth, the approved-email gate, or `owner_user_id` ownership filtering. Cookies still work in a standalone tab and in production (the bearer header is added only when no Authorization header is already set).**

### Changed — frontend (centralized transport only)
- **`lib/api-client-react/src/custom-fetch.ts`** — already attaches `Authorization: Bearer <token>` for every generated operation when a token getter is registered and returns a token (cookie fallback otherwise; no header when signed out). Only the doc comment was updated to reflect the legitimate embedded-iframe web use case.
- **`lib/api-client-react/src/index.ts`** — additionally export `customFetch`, `ApiError`, and `CustomFetchOptions` so the two non-generated request surfaces (upload, download) share the same authenticated transport.
- **`artifacts/signal87-core/src/App.tsx`** — new `<ApiAuthBridge/>` (mounted inside `QueryClientProvider`, within `ClerkProvider`) registers `setAuthTokenGetter(() => getToken())` from Clerk's `useAuth()` via a ref (latest getter always used), clearing it on unmount. This is the **single** place auth transport is wired — no per-page patches.
- **`artifacts/signal87-core/src/components/file-upload.tsx`** — multipart upload now goes through `customFetch` (was a raw `fetch()` that bypassed the token). The 207 "stored but extraction failed" warning UX is preserved via the response `warning` field; server errors surface via `ApiError.data.error`.
- **`artifacts/signal87-core/src/lib/download-original.ts`** *(new)* — downloads the original as an **authenticated blob** via `customFetch(getGetDocumentOriginalUrl(id), { responseType: "blob" })` → object URL → anchor click → deferred revoke, replacing cookie-based `<a href download>` anchors that 401 in the iframe. Forces `responseType: "blob"` (the generated `getDocumentOriginal` omits it, which would mis-parse `text/plain`/`text/csv` originals as a string and break TXT/CSV downloads).
- **`artifacts/signal87-core/src/pages/document-detail.tsx`** — the two "Download Original" anchors are now buttons calling the authenticated `downloadOriginal` helper.
- **`artifacts/signal87-core/src/components/pdf-viewer.tsx`** — the viewer's "Download Original" control takes an `onDownload` callback (was a `downloadUrl` anchor), routing through the same authenticated path.

### Verification
- `pnpm run typecheck` — clean (all packages).
- **Embedded preview logs:** `GET /api/documents` now returns **200/304** (previously **401** on every call).
- **e2e (signed-in, approved `ceo@signal87.ai`):** `/documents` loads with no 401; open document; **Download Original** triggers with no error; single-doc chat returns a grounded answer with **citations + Verification Trace**; **Re-index** succeeds (200).
- **Security:** unauthenticated `GET /api/documents` returns **401**; approved-email gate (**403**) and `owner_user_id` filtering (**404** cross-user) unchanged (no backend change).

---

## [Signal87_Document_Load_Lag_Fix_v1] — 2026-06-18  *(Kill the multi-second "loading" lag before a failed document fetch surfaces; clearer fast failure)*

### Summary
Fixes the **significant lag** before the Documents/Ask pages showed "Could not load your documents." The React Query client was created with `new QueryClient()` (defaults), so any failed `GET /api/documents` was retried **3× with exponential backoff (~7s)** before the error finally rendered — most visibly a `401` when the Clerk dev **session cookie can't establish inside the embedded preview iframe** (a browser third-party-cookie limitation, not a code bug; the app loads normally in a standalone tab / production). **Frontend-only change; no auth, API, or backend change.**

### Changed — frontend
- **`artifacts/signal87-core/src/App.tsx`** — `QueryClient` now sets `defaultOptions.queries`:
  - `retry`: never retry `4xx` (a `401`/`403`/`404` won't succeed on retry); retry transient errors (5xx/network) at most twice. Errors now surface **immediately** instead of after the default backoff.
  - `refetchOnWindowFocus: false` and `staleTime: 30_000` to cut refetch churn so navigating between Documents/Ask reuses cached data. Upload/delete/reindex still call `invalidateQueries`, which refetches regardless of `staleTime`, so lists stay correct.

### Note (environment, not a code bug)
- "Could not load documents" inside the **embedded preview/canvas iframe** is the known Clerk dev session-cookie staleness (`401`, `userId: null` despite `isSignedIn`). Open the app in a **standalone browser tab** to use it in dev; production is unaffected (first-party cookies, top-level origin).

### Verification
- `pnpm --filter @workspace/signal87-core run typecheck` — clean.

---

## [Signal87_Spreadsheet_Excel_Readability_v1] — 2026-06-18  *(Excel spreadsheet ingestion — upload, preview, chat, hybrid-agent, and brief over .xlsx/.xls with sheet/row-aware citations)*

### Summary
Extends the existing ingestion pipeline so Excel workbooks (`.xlsx` — required; `.xls` — also supported) are first-class documents: they upload, store, extract to readable text, chunk, preview, and flow through single-doc chat, the hybrid agent, and the executive brief — each chunk carrying **sheet name + row range** provenance so citations are spreadsheet-aware. CSV ingestion is **unchanged** (still parsed as plain text). **No DB schema change, no OpenAPI/codegen change, no auth/ownership/storage change, no UI redesign** — `fileType` is already a free string and `chunks.content` is free text, so all sheet/row context lives inside the chunk text.

### Added — spreadsheet module (`artifacts/api-server/src/lib/spreadsheet.ts`)
- `extractSpreadsheet(buffer, fileType, fileName)` → `{ text, chunks, warnings }` using SheetJS (`xlsx`).
  - **`text`** (for `extracted_text` + preview): a workbook header (`Workbook: <name> — N sheet(s): ...`) followed by, per sheet, a `Sheet: <name> (R data rows × C columns)` line, a `Columns: A=<header>, B=<header>, …` line, and one `Row <n>: Col=val; Col=val` line per non-empty row (1-based row numbers matching Excel; blank cells and fully blank rows skipped, but row numbers preserved).
  - **`chunks`** (for retrieval): self-contained, each prefixed `Sheet: <name> | Rows a–b` + the `Columns:` line so every retrieved chunk carries its own sheet/row provenance. Header-only sheets still emit one `… | Header row` chunk so column-level questions stay answerable.
  - **`warnings`**: non-fatal truncation notices (never silently dropped) — surfaced to the caller and logged via `req.log.warn`.
  - Limits: `MAX_SHEETS=30`, `MAX_ROWS_PER_SHEET=2000`, `MAX_COLS=200`, `MAX_CELL_CHARS=500`, `ROWS_PER_CHUNK=40`, `MAX_CHUNK_CHARS=4000`. Prefers SheetJS formatted text (`cell.w`, handles dates/number formats), falling back to raw value. A workbook with no usable content returns `text: ""` so the caller's existing empty-extraction path marks the document `failed`.

### Added — dependency / build
- `xlsx` (SheetJS) added to `artifacts/api-server` deps and to `build.mjs` `external[]` so it is **not** inlined into the esbuild bundle (loaded from `node_modules` at runtime, same pattern as `pdf-parse` / `mammoth`).

### Changed — backend ingestion (behavior identical for existing types)
- **`lib/text-extractor.ts`** — `xlsx`/`xls` added to `SupportedFileType` and `getFileType` (extension + MIME; CSV is matched **before** `.xls` so `text/csv` never mis-routes). New `extractAndChunk()` orchestrator routes spreadsheets to `extractSpreadsheet` and everything else through the existing extract-then-`chunkText` path, returning a uniform `{ text, chunks, warnings }`.
- **`lib/file-store.ts`** — `getMimeType` now returns the correct content types for `.xlsx`/`.xls` (so download/preview of the original serves the right MIME).
- **`routes/documents/index.ts`** — `POST /documents/upload` and `POST /documents/:id/reindex` now call `extractAndChunk`; any extraction warnings are logged via `req.log.warn`; the unsupported-file-type message now lists `XLSX`/`XLS`. Ownership, storage, transaction mechanics, and the `success`/`failed` (`207`) bookkeeping are unchanged.

### Changed — citation prompts (one sentence each; `[Chunk N]`/`[Source N]` preserved)
- **`routes/chat/index.ts`**, **`routes/agent/index.ts`** (hybrid), **`routes/brief/index.ts`** — each system prompt gains a single instruction: when a source is a spreadsheet excerpt, reference the **sheet name and row range** shown in the chunk. No other prompt or retrieval change.

### Changed — frontend (no redesign)
- **`components/file-upload.tsx`** — `accept=".pdf,.docx,.txt,.csv,.xlsx,.xls"`, allowed-extensions list, validation message, and dialog copy now include Excel.
- **`pages/documents.tsx`**, **`pages/about.tsx`** — supported-format copy mentions Excel.
- **`pages/document-detail.tsx`** — spreadsheets use the non-PDF text preview with a sheet-aware label (the readable sheet-by-sheet rendering).

### Unchanged
- DB schema, OpenAPI spec + generated Zod/React-Query client, auth/approved-email gate, per-user ownership, durable storage, download/delete/reindex mechanics, the PDF viewer, CSV ingestion, and the citations + Verification Trace payload shape.

### Verification
- `pnpm run typecheck` — clean.
- End-to-end with a real 2-sheet `.xlsx` (Sales + Risks) via the documented dev auth bypass (reverted after): **upload** → `fileType: "xlsx"`, chunks > 0, `extractionStatus: "success"`, preview renders sheet-by-sheet; **single-doc chat**, **hybrid agent**, and **executive brief** all returned grounded answers whose citations show `Sheet: <name> | Rows a–b` and preserved `[Chunk N]`/`[Source N]`. Test document deleted and bypass env vars removed afterward (`GET /api/documents` back to `401`).

---

## [Signal87_Per_User_Document_Ownership_v1] — 2026-06-18  *(Per-user document ownership — every document read/write is now scoped to the signed-in user)*

### Summary
Closes a multi-tenant data-isolation gap: until now any **approved** user could read/modify **every** document (the only trust boundary was the approved-email gate). Adds a per-document owner and enforces it on every document read and write so a user can only ever see and act on documents they uploaded. Documents that exist but belong to another user are indistinguishable from documents that do not exist (both return `404` — no existence disclosure). **No UI, no API contract, and no codegen changes** (owner is never exposed in any response and no request shape changed).

### Added — DB schema (`lib/db/src/schema/documents.ts`)
- `documents.owner_user_id text` (nullable). Holds the Clerk user id of the uploader. Chunks and chat messages inherit ownership transitively via `document_id` (no new column on those tables). Applied with `pnpm --filter @workspace/db run push`.

### Added — backend helper (`artifacts/api-server/src/lib/ownership.ts`)
- `getCurrentUserId(req)` → the Clerk `userId` (`getAuth(req).userId`). When `CLERK_BYPASS_AUTH=true` (dev only, no Clerk session) it falls back to `DEV_USER_ID` if set, else `null`. Returning `null` makes every caller **fail closed** with `401` rather than leak across users.

### Changed — backend (ownership enforced; all behavior otherwise identical)
- **`routes/documents/index.ts`** — `GET /documents` lists only the caller's docs; `POST /documents/upload` stamps `ownerUserId`; `GET/DELETE /documents/:id`, `GET /documents/:id/original`, `PUT /documents/:id/original`, `POST /documents/:id/reindex` all add `owner_user_id = caller` to the lookup → `404` when not owned; `GET /documents/:id/chunks` now does an owner-checked document lookup first (previously fetched chunks with **no** document/ownership check) → `404` when not owned.
- **`routes/chat/index.ts`** — `POST /documents/:id/chat` owner-scopes the document lookup; `GET` and `DELETE /documents/:id/history` now verify document ownership first (previously read/deleted chat messages by `document_id` with **no** ownership check) → `404` when not owned.
- **`routes/multi-chat/index.ts`**, **`routes/brief/index.ts`** — the multi-document fetch is owner-scoped; any id not owned by the caller drops out of the result and trips the existing length-mismatch `404` (no existence disclosure).
- **`routes/agent/index.ts`** (hybrid) — both the provided-`documentIds` fetch and the auto-select branch (`extractionStatus='success'`) are owner-scoped; unowned ids → existing `404`.
- All handlers also short-circuit `401` when `getCurrentUserId` is `null` (defense-in-depth behind the existing `requireApprovedEmail` gate).

### Data — backfill
- Legacy rows (uploaded before this column existed → `owner_user_id IS NULL`) were assigned to the admin account **mbenezra@erezcapital.io** (`user_3FFNmOxc5P4v8P6aKFLmUeYJgEh`, resolved as the single Clerk user for that email). Rows already owned by real users were left untouched.

### Deliberate exceptions (left global — documented)
- `GET /api/admin/stats` and `GET /api/system/info` remain global aggregates (counts/route inventory only, no document content or per-document access). They were outside the enumerated scope; scope them later if per-user dashboards are desired.
- `GET /api/demo/qa` (the **public**, unauthenticated landing-page demo) still reads the global indexed corpus, **by design**: it has no signed-in user to scope to, and it only ever returns an **anonymized chunk ordinal** (`grounded` + `Chunk N`) — never a filename, content, or document id. Owner-scoping it would either break the public demo or require auth (a feature change). Left unchanged as an explicit exception; the separate "demo panel real-data" follow-up tracks any future change to its data sourcing.

### Unchanged
- OpenAPI spec, generated Zod/React-Query client, all frontend code, the approved-email auth gate, durable storage, upload/download/delete/reindex, PDF viewer, citations + Verification Trace, and the public health/demo routes. The demo route was already privacy-safe (anonymized, never leaks filenames).

### Verification
- `pnpm run typecheck:libs` + `pnpm --filter @workspace/api-server run typecheck` — clean.
- Unauthenticated `GET /api/documents`, `/api/documents/1`, `/api/documents/1/chunks` → `401`.
- Cross-user isolation (data layer): a document owned by another user is **not** returned by an owner-scoped query as the admin (→ `404` in-route); admin sees exactly its own document set.
- Backfill confirmed: `UPDATE 5`; no `owner_user_id IS NULL` rows remain.

---

## [Signal87_Core_Hybrid_Agent_v1] — 2026-06-18  *(Hybrid cross-document agent — POST /api/agent/hybrid + /agents/hybrid page)*

### Summary
Adds the **Signal87 Hybrid Cross-Document Agent**: a single-query endpoint that retrieves relevant chunks across one or more documents, synthesises an LLM answer grounded in the retrieved context, and returns per-source citations and a Verification Trace. A new `/agents/hybrid` frontend page surfaces the full feature with mode selection, optional document filter, answer display (MarkdownAnswer), expandable citation cards, and a collapsible trace panel. All existing flows are unaffected.

### Added — API contract (`lib/api-spec/openapi.yaml`)
- New `agent` tag.
- `POST /agent/hybrid` (operationId `postAgentHybrid`) with schemas `HybridAgentInput`, `HybridAgentDocumentRef`, `HybridAgentCitation`, `HybridAgentTrace`, `HybridAgentResult`.
- Ran `pnpm --filter @workspace/api-spec run codegen` → generated Zod `PostAgentHybridBody` / `PostAgentHybridResponse`, React Query hook `usePostAgentHybrid`, and TypeScript types `HybridAgentInput` / `HybridAgentResult` / `HybridAgentCitation` / `HybridAgentTrace` / `HybridAgentInputMode`.

### Added — backend (`artifacts/api-server/src/routes/agent/index.ts`)
- `POST /api/agent/hybrid` — validates with `PostAgentHybridBody` (Zod); if `documentIds` provided, verifies existence and fetches those docs; otherwise auto-selects up to `maxDocuments` (default 5) most-recently-indexed docs (`extractionStatus='success'`).
- Fetches chunks, builds `DocumentGroup[]`, calls `retrieveAcrossDocuments` with `perDocTopK = ceil(maxChunks / numDocs)`; on retrieval failure falls back to first-K deterministic selection (`fallbackUsed: true`).
- Flattens all retrieved chunks, sorts globally by relevance, slices to `maxChunks`; assigns 1-based `citationNumber`.
- Mode-aware system prompts for: `auto | summarize | compare | extract | diligence`.
- Response shape matches `HybridAgentResult`: `{ answer, mode, documentsUsed, citations, trace }`.
- Mounted in `routes/index.ts` after `requireApprovedEmail` (authenticated-only).

### Added — frontend (`artifacts/signal87-core/src/pages/hybrid-agent.tsx`)
- New `/agents/hybrid` page with `Layout`, Clerk `AuthGuard`, `useListDocuments` for checkbox doc-selector (ready docs only), mode `Select`, `Textarea` query input (Cmd+Enter submit).
- Result view: `MarkdownAnswer` for the answer, document-used pill badges, `CitationCard` (expandable excerpt + relevance score), `TracePanel` (collapsible Verification Trace).
- Uses `usePostAgentHybrid` mutation from `@workspace/api-client-react`.

### Changed
- `artifacts/signal87-core/src/App.tsx` — added `Route path="/agents/hybrid"` for `HybridAgent`.
- `artifacts/signal87-core/src/components/layout.tsx` — added **Agent** nav item (`Bot` icon, href `/agents/hybrid`) between Compare and Activity.
- `artifacts/api-server/src/routes/index.ts` — mounted `agentRouter`.

### Unchanged
- All existing routes (health, demo, documents, chat, multi-chat, brief), the approved-email auth gate, DB schema, durable storage, upload/download/delete/reindex, PDF viewer, single-doc chat history, and multi-doc comparison and brief flows.

### Verification
- `curl -X POST localhost:80/api/agent/hybrid -H "Content-Type: application/json" -d '{"query":"test"}'` → `401` (auth gate intact).
- `pnpm --filter @workspace/api-server run typecheck` — clean.
- `pnpm --filter @workspace/signal87-core run typecheck` — clean.
- Both workflows running; **Agent** nav item visible in sidebar (between Compare and Activity).

---

## [Signal87_Core_Landing_DemoQA_GroundedData_v1] — 2026-06-18  *(Ground the landing "Document Q&A" demo panel in a real stored document)*

### Summary
The animated "Document Q&A" demo panel on the landing page now pulls its content from a real stored document instead of being purely hardcoded. A new lightweight **public** (no-auth) endpoint serves a curated demo answer whose **citation is grounded in an actual indexed document** (real file name + chunk). The panel falls back to the existing hardcoded copy if the endpoint is unavailable, so the landing page never breaks.

### Added — API contract (`lib/api-spec/openapi.yaml`)
- New `demo` tag and `GET /demo/qa` (operationId `getDemoQa`) → `DemoQa` schema: `{ question, answer, citationLabel, sourceDocument (nullable), grounded }`.
- Ran `pnpm --filter @workspace/api-spec run codegen` → generated zod `GetDemoQaResponse`, hooks `useGetDemoQa` / `getDemoQa`, and the `DemoQa` type.

### Added — backend (`artifacts/api-server/src/routes/demo/index.ts`)
- Public `GET /demo/qa`. Finds the most-recent successfully-indexed document and its lowest-index non-empty chunk; if found, returns a curated question/answer with a **grounded** citation (`grounded: true`).
- **Privacy:** the citation is grounded in a real chunk *ordinal* (`Demo document · Chunk N`), but the query selects **only** the chunk index — never the filename or content — so this unauthenticated endpoint never discloses protected document names (which can contain client / deal / employee names). `sourceDocument` is an anonymized `"Demo document"` label, not a real file name.
- If no ready document exists (or anything throws), returns the curated fallback (`grounded: false`, `sourceDocument: null`). The route never 500s.
- Mounted in `artifacts/api-server/src/routes/index.ts` **before** `requireApprovedEmail` (public, alongside `healthRouter`).

### Changed — frontend (`artifacts/signal87-core/src/components/aria-chat-animation.tsx`)
- Fetches via `useGetDemoQa` (`retry: false`, `staleTime: Infinity`, `refetchOnWindowFocus: false`); derives question/answer/citation from the response, falling back to the existing hardcoded constants.
- The typing animation re-runs when the live content loads. Fixed a latent timer leak: inner typing intervals are now tracked and cleared on cleanup / cycle restart.

### Unchanged
- All protected flows (upload / download / delete / re-index / PDF viewer / durable storage / single-doc chat / citations + Verification Trace), the approved-email auth gate (verified: `GET /api/documents` still `401`), DB schema, and all other landing sections.

### Verification
- `curl localhost:80/api/demo/qa` → `200` with `grounded: true` and an anonymized `sourceDocument` (`"Demo document"`, no real filename); `GET /api/documents` still `401` (auth gate intact).
- `pnpm --filter @workspace/api-server run typecheck` and `pnpm --filter @workspace/signal87-core run typecheck` — both clean.
- Visual check via preview: panel animates the Q&A on the landing page.

---

## [Signal87_Core_Landing_HowItWorks_v1] — 2026-06-17  *(Add "How it works" 3-step walkthrough to landing page)*

### Summary
Added a numbered "How it works" walkthrough section to the landing page, placed between the hero and the demos, so first-time visitors see the upload → ask → cited-answer flow before the product demos. Frontend-only; no backend/API/DB/auth changes.

### Changed — `artifacts/signal87-core/src/pages/home.tsx`
- New `STEPS` data array (3 entries): 01 "Upload your documents", 02 "Ask a question or request a brief", 03 "Get a cited, verifiable answer" — each with an `icon`, `step` number, `label`, and one-sentence `description`.
- Added the icons `Upload`, `MessageSquare`, `CheckCircle2` to the existing `lucide-react` import.
- New section inserted between the hero `</section>` and the `{/* Demos */}` section, reusing the existing section shell (`border-t border-gray-200 px-6 py-20 max-w-5xl mx-auto`) and the standard centered heading block (serif `<h2>` "How it works." + gray subtitle).
- 3-column responsive grid (`grid-cols-1 md:grid-cols-3 gap-8`); each step shows a blue icon badge (`w-11 h-11 rounded-xl bg-blue-50 border border-blue-100`), a mono step number, a bold `text-lg` label, and a `text-base` description. Centered on mobile, left-aligned on `md+`.

### Unchanged
- Backend routes, database schema, auth behavior, API routes, protected app flows, all other landing sections (hero/demos/features/categories/CTA/partners/footer).

### Verification
- `pnpm --filter @workspace/signal87-core run typecheck` — clean.
- Visual check via preview: section renders between hero and demos and matches the landing aesthetic.

---

## [Signal87_Core_Landing_DocumentCategories_v1] — 2026-06-17  *(Add "Document Categories" section to landing page)*

### Summary
Added a new "Document Categories" section to the landing page based on a user-supplied design mockup, adapted to a white background to match the site style. Frontend-only; no backend/API/DB/auth changes.

### Changed — `artifacts/signal87-core/src/pages/home.tsx`
- New `CATEGORIES` data array (5 entries): CUI / LEG / FIN / STR / MED, each with a `code`, two-line `title` (via `\n` + `whitespace-pre-line`), and `description`; the STR entry has `highlight: true`.
- New section inserted between the Features grid and the CTA, following the existing section shell (`border-t border-gray-200 px-6 py-20 max-w-5xl mx-auto`):
  - Mono eyebrow `03 — Document Categories` (`font-mono uppercase tracking-widest text-gray-400`).
  - Left-aligned serif `<h2>` (Instrument Serif via global `h1,h2` rule) with "matter most." in `italic`.
  - 5-column responsive grid (`grid-cols-2 sm:grid-cols-3 lg:grid-cols-5`) with a top rule; each cell shows code label, two-line title, description, and a bottom arrow that turns blue and nudges right on hover. The highlighted STR cell uses `bg-gray-50 ring-1 ring-gray-200` (neutral, on-white) instead of the mockup's beige fill.

### Unchanged
- Backend routes, database schema, auth behavior, API routes, protected app flows, all other landing sections (hero/demos/features/CTA/partners/footer).

### Verification
- `pnpm --filter @workspace/signal87-core run typecheck` — clean.
- Visual check via preview: section renders on white, matches the supplied design and the site's typography/spacing.

---

## [Signal87_Core_Landing_AnimatedGrid_BiggerFeatures_v1] — 2026-06-17  *(Animate background grid lines + enlarge landing feature blocks)*

### Summary
Two landing-page polish changes. (1) The previously-static background grid lines now drift slowly and seamlessly. (2) The six platform-feature blocks are enlarged into proper cards so they better fit the page's scale and style. Frontend-only; no backend/API/DB/auth changes.

### Changed — `artifacts/signal87-core/src/index.css`
- `.landing-bg::before` (gridlines): added `animation: landing-grid 28s linear infinite` and `will-change: background-position`.
- New `@keyframes landing-grid`: animates `background-position` from `0 0` to `56px 56px` (exactly one grid cell), giving a seamless infinite diagonal drift. The static radial mask is unchanged, so the grid still fades out and never overpowers copy.
- Extended the `prefers-reduced-motion: reduce` block to also disable `.landing-bg::before` animation (previously only `::after` was disabled).

### Changed — `artifacts/signal87-core/src/pages/home.tsx`
- Feature blocks turned into cards: wrapper now `group rounded-2xl border border-gray-200 bg-white/70 p-8 space-y-4` with a subtle `hover:border-blue-200 hover:bg-white` transition.
- Icon container `w-8 h-8 rounded-lg` → `w-12 h-12 rounded-xl`; icon `w-4 h-4` → `w-6 h-6`.
- Title `text-sm` → `text-lg`; description `text-sm` → `text-base`.
- Grid gap `gap-8` → `gap-6` to balance the larger cards.

### Unchanged
- Backend routes, database schema, auth behavior, API routes, protected app flows, hero/CTA/partners/footer sections.

### Verification
- `pnpm --filter @workspace/signal87-core run typecheck` — clean.
- Visual check via preview: grid drifts subtly; feature cards render larger and on-style.

---

## [Signal87_Core_SearchPersist_v1] — 2026-06-17  *(Persist search text across page visits)*

### Summary
The free-text search box in the document library now restores its last value on page reload, matching the existing localStorage persistence pattern used by view mode, sort, status filter, and type filter. Frontend-only; no backend/API/DB/auth changes.

### Changed — `artifacts/signal87-core/src/pages/documents.tsx`
- Added `getInitialSearch()` getter: reads `"docs-search"` from localStorage, returns the stored string or `""` on miss/error. Placed alongside the other `getInitial*` getters (after `getInitialTypeFilter`).
- Changed `useState("")` → `useState(getInitialSearch)` for the `search` state (lazy initializer, consistent with the other filter states).
- Added `handleSearch(v: string)` handler: calls `setSearch(v)`, then writes `"docs-search"` when `v !== ""` or removes the key when `v === ""` (same remove-on-default pattern as status/type filters).
- Replaced all 5 raw `setSearch` call-sites with `handleSearch`: search input `onChange`, X-button `onClick`, filter-chip `onRemove`, "Clear all" button, "Clear filters" button.

### Unchanged
- Backend routes, database schema, auth behavior, API routes, protected app flows.

### Verification
- `pnpm --filter @workspace/signal87-core run typecheck` — clean.
- No raw `setSearch("")` call-sites remain outside of `handleSearch` itself and the state declaration.

---

## [Signal87_Core_Landing_Simplify_SubtleBG_v1] — 2026-06-17  *(Clean landing sections + subtle CSS-only animated background)*

### Summary
Simplified the public landing page into clean, professional content sections and added a subtle, premium, CSS-only animated background. Removed all fake product mockups, the canvas grid animation, and typewriter effects. Frontend-only; no backend/API/DB/auth changes.

### Removed — `src/components/`
- Deleted `grid-wave.tsx` (canvas grid animation), `aria-chat-animation.tsx`, `cross-doc-animation.tsx`, `audit-trace-animation.tsx` — all orphaned after the landing page rewrite (no remaining imports).

### Changed — `src/pages/home.tsx`
- Stateless page (only `useAuth`); removed `useState`/`useEffect`/`useRef`, `TypedText`, `GridWave`, and all three demo-animation components.
- Structure: Hero → Features (heading "Built for high-stakes document work." + subheading + responsive 6-block grid: 3-col desktop / 2-col tablet / 1-col mobile, each icon + title + description) → CTA ("Ready to turn documents into decisions?", gray-50 surface) → Partners → Footer.
- Added a `<div className="landing-bg" aria-hidden="true" />` background layer as the first child of the outer `relative` container; `header`/`main`/`footer` set to `relative z-10` to paint above it.
- CTA behavior: signed-out → "Get started" (`/sign-up`) + "Sign in" (`/sign-in`); signed-in → "Open App" (`/documents`).

### Changed — `src/index.css`
- Replaced the now-unused `@keyframes fadeIn` / `.fade-in` / `.fade-in-delayed` block with `.landing-bg` styles:
  - `::before` — very subtle gridlines (`rgba(15,23,42,0.04)`, 56px cells) with a radial mask so they fade out and never overpower the copy.
  - `::after` — soft violet/gray gradient glow (violet `rgba(139,92,246,0.14)` + gray `rgba(148,163,184,0.12)`), blurred, with a slow 22s `landing-drift` translate/scale/opacity pulse.
  - `@media (prefers-reduced-motion: reduce)` disables the drift animation.

### Unchanged
- Backend routes, database schema, auth behavior, protected app routes, documents/upload/Ask/Brief/Compare/Activity/AI/API logic, partner logos, footer links, nav.

### Verification
- `pnpm --filter @workspace/signal87-core run typecheck` — clean.
- `curl localhost:80/api/healthz` → 200; `curl localhost:80/api/documents` (unauth) → 401.
- Landing page loads publicly; CTA links resolve to `/sign-up`, `/sign-in`, `/documents`.

---

## [Signal87_Core_AriaChatAnimation_v1] — 2026-06-17  *(Chat demo animation in hero CTA section)*

### Summary
Added the `AriaChatAnimation` component to the landing page hero, between the CTA buttons and the feature cards. Shows a simulated document Q&A interaction (question typing → AI answer streaming → source citations) that triggers on scroll-into-view. Frontend-only; no backend/API/DB/auth changes.

### Added — `src/components/aria-chat-animation.tsx`
- Dark-themed chat mockup panel with macOS-style chrome bar.
- Phases: idle → question types (35 ms/char) → AI answer streams (18 ms/char, bold highlights in blue) → citations fade in with staggered delays.
- IntersectionObserver triggers the sequence when the component enters the viewport at 20% threshold.
- `streaming` indicator badge visible during answer phase; blinking cursor during both typing phases.

### Changed — `src/index.css`
- Added `@keyframes fadeIn` (opacity + translateY) plus `.fade-in` and `.fade-in-delayed` utility classes consumed by the citation rows.

### Changed — `src/pages/home.tsx`
- Imported `AriaChatAnimation`.
- Added `<AriaChatAnimation />` in a `max-w-2xl mt-12` container between the CTA buttons and the feature grid.
- Reduced feature grid top margin: `mt-24` → `mt-16` (animation fills the visual gap).

### Unchanged
- All copy, GridWave animation, feature cards, partner logos, footer, auth routing, backend.

### Verification
- `pnpm --filter @workspace/signal87-core run typecheck` — clean.

---

## [Signal87_Core_GridWave_FullPage_v1] — 2026-06-17  *(Full-page GridWave + typed feature descriptions)*

### Summary
Extended the GridWave animation to cover the entire page (header, hero, feature section, footer). Added a typewriter animation to all six feature card descriptions that triggers when the section scrolls into view, with staggered delays per card. Frontend-only; no backend/API/DB/auth changes.

### Changed — `src/components/grid-wave.tsx`
- Canvas height: `window.innerHeight * 0.6` → `document.documentElement.scrollHeight` (full document height).
- Rows: 25 → 35 to maintain visual grid density over the taller canvas.
- Added `requestAnimationFrame(resizeCanvas)` after initial mount to re-measure after React content fully renders.
- Removed `maskImage` fade-out gradient — grid now shows at consistent opacity across the whole page.

### Changed — `src/pages/home.tsx`
- Restructured layout: `relative` added to outermost div; `<GridWave />` moved to first child of outermost div (previously inside a `flex-1` wrapper around `<main>` only).
- Removed the intermediate `<div className="flex-1 relative overflow-hidden">` wrapper; `<main>` restored to `flex-1`.
- `<header>` and `<footer>` now have `relative z-10` so they paint above the z-0 canvas.
- Added `TypedText` inline component: uses `IntersectionObserver` to trigger on scroll-into-view, then types one character every 10 ms with a blinking cursor while in-progress.
- All six feature card `<p>` descriptions replaced with `<TypedText>` with staggered `startDelay` (0 / 150 / 300 / 450 / 600 / 750 ms).
- Added `useState`, `useEffect`, `useRef` imports.

### Unchanged
- All copy, icons, CTAs, partner logos, footer links, nav, auth routing, backend.

### Verification
- `pnpm --filter @workspace/signal87-core run typecheck` — clean.

---

## [Signal87_Core_Landing_Copy_v2] — 2026-06-17  *(Landing page copy v2 — business-decision positioning)*

### Summary
Replaced PDF/document-focused hero copy with stronger business-document intelligence positioning. Added secondary "See how it works" CTA. Expanded feature cards from 3 to 6. Frontend-only; no backend, API, DB, auth, or AI changes.

### Changed — `src/pages/home.tsx`
- **Hero badge**: "AI-powered · Cites every source" → "AI-powered · Source-cited · Business-ready"
- **Hero headline**: "Precision Document Intelligence." → "Turn documents into decisions."
- **Hero subheadline**: replaced PDF-upload copy with "Signal87 converts business documents into cited answers, executive briefs, and multi-document intelligence — giving teams a faster path from source material to action."
- **CTA layout**: primary CTA and new secondary "See how it works ↓" link (`href="#features"`) rendered side-by-side in a `flex-row` on sm+ screens.
- **Feature grid** (`id="features"`): expanded from 3 to 6 cards in a `sm:grid-cols-2 lg:grid-cols-3` responsive grid:
  1. Verified Intelligence (ShieldCheck)
  2. Executive Briefs (FileText)
  3. Cross-Document Analysis (GitCompare)
  4. Audit-Ready Reasoning (Search)
  5. Secure Document Workspace (Lock)
  6. Built for Business Judgment (Users)
- **Icon imports**: removed `Database`, `Zap`; added `FileText`, `GitCompare`, `Search`, `Lock`, `Users`.
- GridWave animation, partner logos, footer, header, and all auth routing unchanged.

### Unchanged
- All backend routes, API contract, DB schema, auth, upload, AI routing, protected-app pages.

### Verification
- `pnpm --filter @workspace/signal87-core run typecheck` — clean.

---

## [Signal87_Core_GridWave_v1] — 2026-06-17  *(GridWave animated canvas background on home page)*

### Summary
Added a `GridWave` React canvas component as a perspective-grid wave animation behind the home page hero. Frontend-only; no backend, API, DB, auth, or AI changes.

### Added — `src/components/grid-wave.tsx`
- New `GridWave` component: canvas-based animation that draws a 25×40 perspective grid with sinusoidal wave offsets per cell.
- Canvas resizes to `window.innerWidth × window.innerHeight * 0.6` on mount and window resize; listener is cleaned up on unmount.
- Grid lines: `rgba(59, 130, 246, 0.15)` (subtle blue, 1 px). Fades to transparent at the bottom via CSS `maskImage` gradient.
- Component is `pointer-events-none z-0 absolute top-0 left-0` — purely decorative, does not block any interaction.

### Changed — `src/pages/home.tsx`
- Imported `GridWave` from `@/components/grid-wave`.
- Wrapped the `<main>` hero section in a `flex-1 relative overflow-hidden` div so the absolutely-positioned canvas is contained and full-width.
- `<GridWave />` rendered as first child of that wrapper (z-0); `<main>` is `relative z-10` so hero text/buttons sit above the canvas.

### Unchanged
- All hero copy, CTA buttons, features grid, partner logos, footer, header.
- All backend routes, API contract, DB schema, auth, upload, AI routing.

### Verification
- `pnpm --filter @workspace/signal87-core run typecheck` — clean.

---

## [Signal87_Core_Mobile_Polish_v1] — 2026-06-17  *(Mobile layout polish — larger tap targets, responsive padding, smaller thumbnails, scrollable table)*

### Summary
Frontend-only mobile/app-like polish pass across all protected pages. No backend, API, DB, auth, upload, download, delete, reindex, or PDF-viewer logic changed.

### Changed — `src/components/layout.tsx`
- Bottom-nav link vertical padding: `py-2` → `py-3 md:py-2` — minimum ~44 px touch target on mobile, desktop unchanged.

### Changed — `src/pages/documents.tsx`
- **Header padding**: `px-6 py-5` → `px-4 md:px-6 py-4 md:py-5`.
- **Toolbar**: `flex items-center gap-3 px-6` → `flex flex-wrap items-center gap-x-2 gap-y-2 px-4 md:px-6` — filters wrap to a second line on narrow screens instead of overflowing.
- **Search input container**: removed `max-w-sm` cap (`flex-1 min-w-[160px]`) so the search bar fills available width on mobile.
- **Grid thumbnail height**: `h-40` → `h-28` (card and skeleton) — more compact cards on all screen sizes.
- **List table**: wrapped in `<div className="overflow-x-auto">` with `min-w-[520px]` on the table — no horizontal clipping on narrow screens.
- **Delete button**: `h-7 w-7` → `h-8 w-8` for a larger touch target in list view.

### Changed — `src/pages/document-detail.tsx`
- All five `TabsContent` panels (preview, text, citations, history, system): `p-6` → `p-4 md:p-6`.

### Changed — `src/pages/ask.tsx`
- Main content wrapper: `p-6` → `p-4 md:p-6`.

### Changed — `src/pages/activity.tsx`
- Main content wrapper: `p-6` → `p-4 md:p-6`.

### Unchanged
- `executive-brief.tsx`, `multi-document-chat.tsx` — already use `p-4 md:p-6` throughout; no changes needed.
- All backend routes, API contract, DB schema, auth, upload, download, delete, reindex, PDF viewer.

### Verification
- `pnpm --filter @workspace/signal87-core run typecheck` — clean.

---

## [Signal87_Core_Dark_Theme_v1] — 2026-06-17  *(Global black theme, Instrument Serif headers, transparent logos)*

### Summary
Global visual overhaul: black background across the entire site, Instrument Serif for h1/h2 headings, Inter body font confirmed, and partner logos on the front page rendered as ghosted white silhouettes. No backend, API, DB, auth, or business logic changes.

### Changed — `src/index.css`
- **Google Fonts import**: added `@import url('https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&display=swap')` at top of file.
- **`--app-font-serif`**: `Georgia, serif` → `'Instrument Serif', Georgia, serif`.
- **`:root` theme** replaced with a dark theme (was light):
  - `--background: 0 0% 0%` (pure black), `--card: 0 0% 5%`, `--sidebar: 0 0% 3%`
  - All foreground/foreground-variant tokens set to light grays (90%, 85%, 55%)
  - `--border / --card-border / --sidebar-border`: 12% / 12% / 10%
  - `--muted: 0 0% 8%`, `--input: 0 0% 13%`, `--secondary: 0 0% 10%`
  - `--accent / --sidebar-accent`: dark blue `217 40% 12%` (was light blue 96% lightness)
  - Shadows updated to dark-weight values (0.5 opacity, not 0.05)
  - `--opaque-button-border-intensity: 9` (dark mode positive value)
  - `--button-outline / --badge-outline / --elevate-*` updated to white-alpha variants
- **`@layer base`**: added `h1, h2 { font-family: var(--font-serif); font-synthesis: none; }` — applies Instrument Serif to all page-level headings; `font-synthesis: none` prevents fake-bold since only weight 400 is available.

### Changed — `src/pages/home.tsx`
- Partner logos: added `style={{ filter: 'brightness(0) invert(1)' }}` to convert JPG colors to white silhouettes, plus `opacity-20 hover:opacity-50` for a ghosted/transparent appearance on the dark background.

### Unchanged
- Authenticated app shell structure, all page content, backend, API contract, DB schema, auth, upload, AI routing.

### Verification
- `pnpm --filter @workspace/signal87-core run typecheck` — **clean**.
- Screenshot: Instrument Serif renders on hero h1, gradient background retained, zero console errors.

---

## [Signal87_Core_Blue_Theme_v1] — 2026-06-17  *(Black-to-blue gradient home + blue accent)*

### Summary
Two-part visual change: (1) landing page gets a dark black-to-blue gradient background; (2) light-mode accent/primary color replaced from purple to blue throughout the app. No backend, API, DB, auth, or business logic changes.

### Changed — `src/index.css`
Replaced all light-mode purple HSL values with blue (`217 91% 60%`):
- `--primary`, `--ring`, `--sidebar-primary`, `--sidebar-ring`: `262 83% 58%` → `217 91% 60%`
- `--accent`, `--sidebar-accent`: `269 100% 96%` → `217 100% 96%`
- `--accent-foreground`, `--sidebar-accent-foreground`: `262 83% 42%` → `217 91% 36%`

Dark mode is untouched (uses orange/amber, not purple).

### Changed — `src/pages/home.tsx`
- Page wrapper background: `bg-background` → inline `linear-gradient(135deg, #000000 0%, #060f20 50%, #0f2554 100%)` (black → deep navy-blue).
- All text: semantic tokens (`text-foreground`, `text-muted-foreground`, etc.) replaced with hardcoded dark-bg-safe values (`text-white`, `text-white/60`, `text-white/50`, `text-white/40`).
- Logo: black SVG inverted to white via `filter: brightness(0) invert(1)`.
- CTA button: explicit `bg-blue-600 hover:bg-blue-500 text-white` (bypasses any shadcn variant that might pick up the semantic primary token).
- Feature icons: `text-primary` → `text-blue-400` (high-contrast on dark background).
- Nav "Sign In" / "Open App" links: `text-blue-400 hover:text-blue-300`.
- All borders: `border-border` → `border-white/10`.
- Partners/footer logos: `opacity-80` → `opacity-70` for subtler feel on dark background.

### Unchanged
- Authenticated app shell (layout, document pages, chat, brief, compare, activity, admin).
- Dark-mode token values.
- Backend, API contract, DB schema, auth, upload, AI routing.

### Verification
- `pnpm --filter @workspace/signal87-core run typecheck` — **clean**.
- Screenshot confirms: gradient renders correctly, white logo visible, blue CTA, blue feature icons, zero console errors.

---

## [Signal87_Core_Mobile_Polish_v1] — 2026-06-17  *(Mobile / app-like layout polish)*

### Summary
Frontend-only mobile polish pass across the protected app shell and all protected pages. No backend, API, DB schema, auth, upload, PDF viewer, chat, brief, compare, or AI logic changed.

### Changed — `src/components/layout.tsx`
- **Bottom nav on mobile:** moved `<main>` before `<aside>` in DOM order. On desktop, `md:order-first` on the aside restores the left-sidebar position unchanged. On mobile (`flex-col`), the aside now sits at the **bottom** of the viewport as a compact icon + label nav bar — thumb-reachable, no horizontal scroll.
- **Logo + UserButton:** hidden on mobile (`hidden md:flex`); logo only shown on desktop sidebar.
- **UserButton on mobile:** appears as a small avatar at the far-right of the bottom bar (`md:hidden`, separated by a border-l divider).
- **Nav items mobile shape:** `flex-col` (icon above label) with `flex-1` so all 5 items share the bar width evenly. Icons scale `w-5 h-5` on mobile vs `w-4 h-4` on desktop. Labels `text-[10px]` on mobile, `text-sm` on desktop.
- Desktop sidebar layout: **completely unchanged** (width, colors, logo, UserButton position, active state).

### Changed — `src/pages/document-detail.tsx`
- Header: `p-6` → `p-4 md:p-6`; vertical spacing `space-y-4` → `space-y-3 md:space-y-4`.
- h1: `text-2xl` → `text-xl md:text-2xl` — no overflow on narrow screens.
- Tab bar: wrapped in `overflow-x-auto` container so 5 tabs scroll horizontally on narrow screens instead of overflowing. `TabsList` gains `w-max` to allow natural expansion.
- Tab content padding: `p-6` on tab content areas — not changed (they already scroll).

### Changed — `src/pages/activity.tsx`
- Header: `p-6` → `p-4 md:p-6`; h1 `text-2xl` → `text-xl md:text-2xl`.
- Activity row timestamp: responsive — `<span class="hidden sm:inline">` shows `MMM d, yyyy` on ≥640 px; `<span class="sm:hidden">` shows `MMM d` on mobile. Prevents tight text overflow in the title-date flex row.

### Changed — `src/pages/ask.tsx`
- Header: `p-6` → `p-4 md:p-6`; h1 `text-2xl` → `text-xl md:text-2xl`. Content area already mobile-friendly (max-w-2xl centered card).

### Changed — `src/pages/executive-brief.tsx`
- Header: `p-6` → `p-4 md:p-6`; h1 `text-2xl` → `text-xl md:text-2xl`. Scroll area already uses `p-4 md:p-6`; document/brief-type selectors already use `grid-cols-1 sm:grid-cols-2`.

### Changed — `src/pages/multi-document-chat.tsx`
- Header: `p-6` → `p-4 md:p-6`; h1 `text-2xl` → `text-xl md:text-2xl`. Scroll area already uses `p-4 md:p-6`; document selectors already use `grid-cols-1 sm:grid-cols-2`.

### Unchanged
- `documents.tsx` — already polished in previous pass (sm:grid-cols-2, etc.).
- Backend, API contract, DB schema, auth, upload, download, PDF viewer, chat, brief, compare, activity, admin, AI routing.

### Verification
- `pnpm --filter @workspace/signal87-core run typecheck` — **clean**.
- Vite HMR: all 6 files hot-updated successfully; final state zero browser console errors.
- API: `/api/healthz` → 200; unauthenticated `/api/documents` → 401.
- Authenticated document list + thumbnail fetches confirmed in API logs from standalone tab.

---

## [Signal87_Core_Document_Library_Polish_v1] — 2026-06-17  *(Document library + detail UI polish pass)*

### Summary
Narrow frontend-only polish pass on the document library and document detail pages. No backend, API, DB schema, auth, or business logic changes.

### Changed — `src/pages/documents.tsx`
- **Removed redundant file-type icon box** from card body — the thumbnail already signals file type; the card body now leads cleanly with the filename.
- **Title rendering:** `truncate` → `line-clamp-2` so long filenames wrap to a second line rather than truncating; `font-medium text-base` → `font-semibold text-sm leading-snug` for tighter, crisper hierarchy.
- **Grid breakpoint added:** `sm:grid-cols-2` for tablet — cards stack 2-up at 640 px instead of jumping from 1-col to 3-col. Reduces visual void on iPad.
- **Thumbnail height:** `h-44` → `h-40` — slightly less visual weight; cards feel less tall.
- **CardContent padding:** `p-5` → `p-4` — tighter body without feeling cramped.
- **Meta spacing:** `space-y-2` → `space-y-1.5`; action separator `mt-6 pt-4` → `mt-4 pt-3`.
- **Upload date format:** `yyyy-MM-dd HH:mm` → `MMM d, yyyy` (e.g. "Jun 17, 2026") — more readable at a glance.
- **Type badge text:** `text-xs` → `text-[11px]` — visually consistent with status badge.
- **Header:** `p-6` → `px-6 py-5`, heading `text-2xl` → `text-xl`, subtitle `text-sm mt-1` → `text-xs mt-0.5` — slightly reduced weight.
- **Skeleton placeholders** updated to match new layout (h-40 thumbnail, tighter body).
- All card actions (Ask, Re-Index, Delete), routing, and AlertDialog behavior are **untouched**.

### Changed — `src/pages/document-detail.tsx`
- **h1 word-break:** `break-all` → `break-words` — filenames with spaces wrap naturally rather than splitting at any character.

### Unchanged
- `document-thumbnail.tsx` — no changes.
- Backend, API contract, DB schema, auth, upload, download, PDF viewer, chat, brief, compare, activity, admin, AI routing.

### Verification
- `pnpm --filter @workspace/signal87-core run typecheck` — **clean**.
- Vite HMR: both `documents.tsx` and `document-detail.tsx` hot-updated; browser console **zero errors**.
- API: `/api/healthz` → 200; unauthenticated `/api/documents` → 401.
- Thumbnail fetches (`/api/documents/:id/original`) confirmed in API logs from standalone tab.

---

## [Signal87_Core_Document_Thumbnails_v1] — 2026-06-17  *(Document library thumbnail/preview experience)*

### Summary
Restored a polished thumbnail/preview experience on the `/documents` library page. Each document card now shows a full-bleed top-area thumbnail: PDF files with a stored original render an actual first-page preview using `react-pdf`; all other file types (DOCX, CSV, XLSX, PPTX, TXT, etc.) display a color-coded file-type icon card. Thumbnails are lazy-loaded via IntersectionObserver — the PDF fetch/render only starts when the card enters (or approaches) the viewport. Failures fall back silently to the PDF icon card. All existing card actions (Ask, Re-Index, Delete), routing, auth, and every other feature are completely unchanged.

### Added — Frontend only
- **`src/components/document-thumbnail.tsx` (new):** `DocumentThumbnail` component.
  - **PDF + stored original:** uses `react-pdf` `Document` + `Page` (page 1, no text/annotation layers) with the protected `/api/documents/:id/original` URL passed directly. Same-origin means the browser includes the Clerk `__session` cookie automatically — no token wiring needed.
  - **PDF without original or render error:** `FileTypePlaceholder` with a red-tinted background and `PDF` badge.
  - **All other types (DOCX/DOC → blue, XLSX/XLS/CSV → green, PPTX/PPT → orange, TXT → gray, unknown → violet):** `FileTypePlaceholder` with appropriate color.
  - **Lazy loading:** `IntersectionObserver` with `rootMargin: "300px"` — `react-pdf` Document only mounts when the card is near the viewport. `disconnect()` after first intersection so the observer is released.
  - **Container width measurement:** container width is read via `useRef` once the card enters view, so `react-pdf`'s `Page` fills the card width exactly.
  - **Skeleton overlay:** visible until `onRenderSuccess` fires (first page has actually painted) or until `onRenderError` triggers the fallback.
  - **pdfjs worker:** configured at module level (idempotent; same URL as `pdf-viewer.tsx`). Required because `documents.tsx` does not import `pdf-viewer.tsx`.
- **`src/pages/documents.tsx`:** added thumbnail area to each document card.
  - Thumbnail lives in a `<Link href="/documents/:id">` block above `CardContent` — full-bleed (176 px / `h-44`), `overflow-hidden`, separated from the card body by a `border-b`. `overflow-hidden` added to `Card` so the thumbnail respects the card's border radius.
  - Skeleton loading state updated: includes matching `h-44` skeleton at the top of each placeholder card.
  - **All existing content, actions, and routing inside `CardContent` are untouched.**

### Unchanged
- Backend, API contract, DB schema, auth middleware, upload, download, delete, re-index, PDF viewer (detail page), chat, brief, compare, activity, admin, and all other routes.

### Verification
- `pnpm --filter @workspace/signal87-core run typecheck` — **clean**.
- Vite HMR confirmed in logs: `hmr update /src/pages/documents.tsx`.
- `/documents` auth gate confirmed: redirects to sign-in when unauthenticated (401 from API, redirect from AuthGuard).

---

## [Signal87_Core_Clerk_Auth_Fix_v1] — 2026-06-17  *(Auth 401 fix: canonical Clerk wiring + dev-iframe cookie diagnosis)*

### Summary
Fixed authenticated, approved users receiving **401** on all `/api` routes. **Root cause:** in dev, Clerk's short-lived session cookie cannot be refreshed inside the embedded Replit preview / canvas **iframe** (the browser blocks it as a third-party cookie), so the backend received a `__session` cookie it could not verify (`getAuth(req).userId` was `null` with empty `sessionClaims`). The frontend SDK still considered the user signed in, producing the split. **Dev fix: open the app in a standalone browser tab.** Production is unaffected (first-party cookies on the app's own domain). Also corrected real production-proxy and key-resolution bugs surfaced while diffing against canonical Clerk wiring.

### Fixed — Frontend (`src/main.tsx`)
- **Production proxy bug:** `proxyUrl` was hardcoded behind a `PROD` gate (`baseUrl + "/api/__clerk"`), which breaks the Clerk Frontend API proxy in production. Now uses `import.meta.env.VITE_CLERK_PROXY_URL` unconditionally (empty in dev, auto-populated by the deploy pipeline in prod).
- **Publishable key:** now resolved via `publishableKeyFromHost(window.location.hostname, VITE_CLERK_PUBLISHABLE_KEY)` (from `@clerk/react/internal`) so the same build works across the dev domain and custom/production domains.

### Fixed — Backend (`src/app.ts`)
- `cors()` → `cors({ credentials: true, origin: true })`.
- `clerkMiddleware()` → host-aware `clerkMiddleware((req) => ({ publishableKey: publishableKeyFromHost(getClerkProxyHost(req) ?? "", process.env.CLERK_PUBLISHABLE_KEY) }))` (`@clerk/shared/keys`), matching the proxy host resolution.

### Fixed — Backend (`src/middlewares/requireAuth.ts`)
- **Robust email resolution:** the default Clerk session token does not include an email claim, so the middleware now falls back to `clerkClient.users.getUser(auth.userId)` to read the primary email for the `APPROVED_EMAILS` allowlist — preventing false **403s** for approved users. Middleware is now async. Removed the temporary per-request diagnostic logging.

### Verification
- `pnpm run typecheck` — clean. Architect code review — **PASS**, no critical issues.
- Unauthenticated `GET /api/documents` → **401**; `GET /api/healthz` → **200**.
- **Dev testing must be done in a standalone browser tab**, not the embedded preview iframe.

### Notes
- The dev-iframe cookie limitation affects only the embedded preview; it is not a code bug and does not affect production.
- Before production, confirm `VITE_CLERK_PROXY_URL`, `CLERK_SECRET_KEY`, `CLERK_PUBLISHABLE_KEY`, `VITE_CLERK_PUBLISHABLE_KEY` are present (all currently set).

---

## [Signal87_Core_Clerk_Auth_v1] — 2026-06-17  *(Minimal Clerk auth with approved-email gate)*

### Summary
Implemented minimal Clerk-based authentication with an approved-email gate. All backend API routes (except `/healthz`) and all frontend application routes (Documents, Ask, Brief, Compare, Activity) are now protected. The landing page, public pages (About, Team, Contact, Privacy, Terms), and sign-in/sign-up pages remain public. Only users whose email is in the `APPROVED_EMAILS` environment variable can access protected content.

### Added — Backend
- **`src/middlewares/requireAuth.ts` (new):** `requireApprovedEmail` middleware. Uses `getAuth(req)` from `@clerk/express` to check if the user is signed in and their email is in the `APPROVED_EMAILS` comma-separated list. Returns **401** if not signed in, **403** if email not approved. Supports `CLERK_BYPASS_AUTH=true` for emergency override.
- **`src/middlewares/clerkProxyMiddleware.ts` (new):** Clerk Frontend API proxy — production-only, no-op in dev. Required for Clerk to work on custom domains and `.replit.app` deployments.
- **`src/routes/index.ts`:** `healthRouter` remains public; all other routes are now gated with `requireApprovedEmail`.

### Added — Frontend
- **`src/main.tsx`:** Wraps `<App>` with `<ClerkProvider>` using the `VITE_CLERK_PUBLISHABLE_KEY` environment variable. Configured `signInUrl`, `signUpUrl`, `afterSignOutUrl`, and `redirectUrl` with proper base-path handling. Uses `@clerk/themes` dark theme with Signal87 brand colors.
- **`src/App.tsx`:** Added `/sign-in` and `/sign-up` routes using `<SignIn>` and `<SignUp>` components. Added `AuthGuard` component that allows public routes (`/`, `/about`, `/terms`, `/privacy`, `/contact`, `/team/*`, `/sign-in`, `/sign-up`) and redirects all other routes to sign-in via `<RedirectToSignIn>` when the user is not signed in.
- **`src/components/layout.tsx`:** Added `<UserButton>` in the sidebar header (visible when signed in), showing avatar and account popover.
- **`src/pages/home.tsx`:** CTA button now shows "Sign In" when not signed in and "Open App" when signed in. Header nav also shows Sign In link.
- **`src/index.css`:** Added Clerk component CSS overrides for Tailwind v4 compatibility — dark-themed cards, form inputs, buttons, social login buttons, and user popover styling.

### Dependencies
- **Backend:** `@clerk/express`, `@clerk/themes`, `http-proxy-middleware`
- **Frontend:** `@clerk/react`, `@clerk/themes`

### Verification
- `pnpm --filter @workspace/api-server run typecheck` — clean.
- `pnpm --filter @workspace/signal87-core run typecheck` — clean.
- API: `GET /api/documents` → **401** (no auth), `GET /api/healthz` → **200** (public).
- Frontend: `/documents` redirects to `/sign-in` when not signed in; `/sign-in` shows Clerk sign-in UI with Google OAuth; `/sign-up` shows Clerk sign-up UI.
- Workflows: `API Server` and `web` both restarted successfully.

### Notes
- `APPROVED_EMAILS` is set as an empty placeholder. **Before deploying, populate it** with a comma-separated list of approved emails (e.g., `user1@example.com,user2@example.com`).
- `CLERK_BYPASS_AUTH` is not set — auth is active. If you need to disable it for testing, set `CLERK_BYPASS_AUTH=true` in the environment.
- The Clerk components render in a light-themed card by default even with the dark theme applied; the CSS overrides ensure the dark theme styling is consistent.

---

## [Signal87_Core_Stabilization_Smoke_v1] — 2026-06-15  *(Zero-tolerance smoke stabilization)*

### Summary
Investigated the failed Activity item **"Extraction failed — test-smoke.pdf"** under a zero-tolerance standard. **Root cause: a 75-byte malformed PDF stub** (`pdf-parse`/pdf.js `bad XRef entry`), 0 chunks — **not an app or pipeline bug.** The pipeline behaved correctly: it attempted extraction, caught the error, set `extraction_status=failed`, stored 0 chunks, returned 207, and preserved the original file. Full 17-step lifecycle verification passed on a known-good PDF. **Frontend-only** change (improved failure message); no backend/contract/schema/pipeline changes. All test documents deleted afterward.

### Changed — Frontend
- **`src/lib/document-status.ts`:** improved the "Extraction failed" (original-available) description to: *"No readable text could be extracted. This may be a scanned, image-only, blank, password-protected, or malformed PDF. Try a text-based PDF or an OCR-enabled version."* `canReindex`/`needsReupload`/`isReady` unchanged (no behavior regression).
- **`src/pages/activity.tsx`:** the failed not-ready event now uses `status.description` (single source of truth) instead of a hardcoded string; the activity row shows file name and detail on separate lines so the longer message wraps instead of truncating.

### Verified (live)
- Failed record inspected (id 22, 75 B, `bad XRef entry`, 0 chunks, original preserved); Q&A on it returns **422** with no OpenAI call.
- Known-good PDF: upload **201** + extraction **success** + **3 chunks**; in-platform preview renders; Q&A **200** with **3 citations**; delete **204**; Activity accurate before/after with no stale entries; no orphan chunks.
- `pnpm --filter @workspace/signal87-core run typecheck` passes; architect review passed.

### Notes
- **No OCR added** (out of scope). The improved copy is PDF-oriented per request; it also surfaces for empty DOCX/TXT/CSV failures (acceptable for PoC — failures are overwhelmingly PDFs).

---

## [Signal87_Core_Ask_Activity_Tabs_v1] — 2026-06-15

### Summary
Added two lightweight, **frontend-only** navigation tabs — **Ask** and **Activity** — alongside the existing **Documents** tab. **No new major features**, no agents/reports/briefs/billing/integrations/workspaces/knowledge-graph, **no backend changes**, no API/contract/schema changes, and no changes to the working PDF viewer / upload / single-doc chat / citations / delete / re-index flows. Both new pages are read-only and reuse existing data and the existing single-doc chat.

### Added — Frontend
- **`src/components/layout.tsx`:** two nav items added to the single `navItems` array — **Ask** (`/ask`, `MessageSquare` icon) and **Activity** (`/activity`, `Activity` icon) — reusing the existing `Link`/active-state pattern. Mobile (`flex-row` + `overflow-x-auto`) and desktop (`flex-col`) layouts unchanged and verified usable.
- **`src/App.tsx`:** two wouter routes (`/ask`, `/activity`) registered before the catch-all.
- **`src/pages/ask.tsx` (new):** explains the user can ask questions about uploaded documents; a `Select` picker lists only **ready** documents (gated by `getDocumentStatus(doc).isReady`). Selecting one shows a card that links to the **existing** single-doc chat at `/documents/:id/chat` (no new chat logic, no multi-doc chat). States: loading skeleton, error, no-documents empty state (links to Documents), docs-exist-but-none-ready guidance, and the exact required message **"Select a document from Documents to ask questions."** when ready docs exist but none is selected.
- **`src/pages/activity.tsx` (new):** a read-only activity feed derived **only** from existing `useListDocuments()` data — per document, an **Upload completed** event plus an **Extraction completed** / **Extraction failed** / **Needs re-upload** / **Processing** outcome event, timestamped from `uploadedAt`, sorted newest-first. Failure labels reuse `getDocumentStatus()` for precision. Clean **"No activity yet"** empty state. No invented events (no upload-started / Q&A-completed / deleted, which aren't durably recorded) and no raw logs / API keys / stack traces.

### Verification
- `pnpm --filter @workspace/signal87-core run typecheck` — clean.
- Screenshots (desktop + mobile 402×874) confirmed: Ask picker + required empty message; Activity real upload/extraction feed (incl. red **Extraction failed** for the 0-chunk PDF); Documents tab unchanged (status badges, Ask-a-Question, Re-Index) with the new 3-tab nav.
- Architect review: **PASS**, no launch blockers.

---

## [Signal87_Core_Reliability_Clarity_Pass_v1] — 2026-06-15

### Summary
Reliability + clarity hardening pass on the existing MVP. **No new features**, no redesign, no schema changes, and no changes to the working PDF viewer / durable storage / upload / download / delete / re-index mechanics or the citation + Verification Trace contract. One additive API contract change (a documented `422` on chat), plus frontend status clarity, friendlier error/empty states, and sparse structured backend logging.

### Changed — API contract
- **`lib/api-spec/openapi.yaml`**: `POST /documents/{id}/chat` now documents a `422 → ErrorResponse` for documents that have no readable text. Client regenerated via `pnpm --filter @workspace/api-spec run codegen` (no new routes, no schema changes).

### Fixed / Added — Backend
- **`routes/chat/index.ts` — not-ready guard:** before any OpenAI call, chat now returns `422 { error }` when the document has **0 indexed chunks _or_ `extractionStatus === "failed"`** (mirrors the multi-chat/brief routes and matches the frontend "not ready" gate). Prevents an empty/stale-context LLM call and gives the user an actionable message.
- **`routes/chat/index.ts` — Q&A logging:** one structured outcome log per request — `info "Q&A succeeded"` (`documentId`, `provider`, `model`, `chunksSearched`, `chunksRetrieved`, `totalLatencyMs`) or `warn "Q&A rejected…"`. **No question or answer content is ever logged** (PII boundary).
- **`routes/documents/index.ts` — upload logging:** `info` on successful upload (with `chunkCount`) and `warn` on the `207` extraction-failed path (`documentId`, `fileType`); no file content logged.
- **`routes/documents/index.ts` — reindex bookkeeping:** the "no text extracted" re-index path now sets `extractionStatus = "failed"` + `extractionError` (previously left stale) and emits a reindex success log. Re-index success/atomic-transaction mechanics are unchanged.

### Added — Frontend (clarity only, no redesign)
- **`src/lib/document-status.ts` (new):** shared `getDocumentStatus()` deriving five states from existing API fields only — **Processing**, **Ready**, **Extraction failed**, **Original file missing**, **Needs re-upload** — plus `canReindex` / `needsReupload` / `isReady` flags. No backend enum added.
- **`src/components/document-status-badge.tsx` (new):** small tone-colored badge used by the list and detail pages.
- **`src/pages/documents.tsx`:** status badge on each card; the primary action is now conditional — **Re-Index** for failed/0-chunk docs (with original available), **Ask a Question** for ready docs, disabled otherwise; per-card re-indexing spinner state; re-index success now invalidates `listDocuments` + `getDocument` + `getDocumentChunks`.
- **`src/pages/document-detail.tsx`:** status badge in the header and a "not ready" banner when applicable.
- **`src/pages/document-chat.tsx`:** when the document is not ready, the input is disabled with an explanatory inline banner (no API call is made); a "no source citations" note is shown when an answer returns zero citations; citation markers/chips now read **"Section N · {doc}"** instead of "Chunk N" (display-only — `chunkIndex`, prompt, parsing, and the Verification Trace payload are unchanged).
- **`src/components/file-upload.tsx`:** shows accepted types + 20 MB max; validates extension and size client-side with a clean inline message; surfaces the server's `{ error }` message on failure; treats an HTTP `207` (uploaded but extraction failed) as a **warning** toast, not success.

### Verification
- `pnpm run typecheck` — clean across all packages.
- Backend smoke: `POST /documents/22/chat` (0 chunks, status failed) → `422` with the clear message and **no OpenAI call**; `POST /documents/5/chat` (ready) → `200` with answer + citations + `provider/model` in the trace.
- Structured logs confirmed in server output (`Q&A succeeded` / `Q&A rejected…`) with no document/question/answer content.
- Documents list screenshot confirmed: green **Ready** badges, red **Extraction failed** badge on the 0-chunk PDF, and that card correctly shows **Re-Index** instead of "Ask a Question".

---

## [Signal87_Core_Backend_Stability_Pass_v1] — 2026-06-14

### Summary
Backend-first stability pass in preparation for connecting `app.signal87.ai`. No new features, no API contract changes, no schema changes, no redesign. Four targeted backend hardening fixes plus six residual frontend label corrections from the previous polish pass.

### Fixed — Backend
- **`app.ts`**: Added a global Express error handler (4-arg middleware) that catches any unhandled async throw, logs it via pino, and returns `{ error: "Internal server error" }` HTTP 500 as JSON instead of an HTML page.
- **`routes/documents/index.ts` — `GET /documents`**: Wrapped the list query in `try/catch`; DB failure now returns `500 { error: "Failed to list documents" }` instead of throwing uncaught.
- **`routes/documents/index.ts` — `POST /api/documents/:id/reindex`**: Wrapped chunk delete + new-chunk insert + document update in `db.transaction()`. Previously, if the insert step failed, the document was left with 0 chunks permanently.
- **`lib/retriever.ts`**: Added empty-content chunk filter (`c.content.trim().length > 0`) before the OpenAI embeddings batch call in both `retrieveRelevantChunks` and `retrieveAcrossDocuments`. An empty string in the batch causes a `400 Invalid 'input'` from OpenAI.

### Fixed — Frontend (residual labels from previous polish pass)
- **`pages/document-chat.tsx`**: `DOCUMENT_NOT_FOUND` → "Document not found"; `RETURN` button → "Back to Documents"; header sub-row `ID:{id}` / `CHUNKS:{n}` → `doc {id} · {n} chunks`; `CLEAR` → "Clear".
- **`pages/document-detail.tsx`**: `{n} CHUNKS` in header metadata → `{n} chunks`; `EXTRACTED_TEXT_PREVIEW — original PDF not available` → "Extracted text (original PDF not available)" (removed `font-mono`).

### Verification
- `pnpm --filter @workspace/api-server run typecheck` — clean.
- `pnpm --filter @workspace/signal87-core run typecheck` — clean.
- API server restarted; logs show `Server listening port: 8080`, no errors.
- Frontend HMR applied all label changes; documents list and chat confirmed clean in screenshot.

---

## [Signal87_Core_PublicDemo_Polish_v1] — 2026-06-14

### Summary
Final public-demo polish pass. No new features, no rebuilds, no backend or API contract changes. All edits are cosmetic/copy — removing internal-looking labels, fixing mobile layout, and making every user-facing string readable to a first-time visitor. The SIGNAL87 logotype and all System-tab debug content intentionally keep the terminal aesthetic.

### Changed
- **`src/pages/home.tsx`**: `CORE_SYSTEM_ONLINE` → `Open Preview`; `INTELLIGENCE_NODE_ACTIVE` badge → `AI-powered · Cites every source`; subheadline rewritten from jargon-heavy copy to `Upload any PDF, DOCX, or text file. Ask questions. Get answers that cite exactly where they came from.`; CTA `ACCESS_SYSTEM` → `Get Started` (removed `font-mono` and layout overrides from button); feature card descriptions de-monospaced and rewritten for non-technical readers.
- **`src/pages/documents.tsx`**: `INDEXED_FILES` subtitle → `Your uploaded documents`; `FAILED_TO_LOAD_DOCUMENTS` → `Could not load your documents`; empty state title `No documents indexed` → `No documents yet` with clearer body copy; `CHUNKS:` / `UPLOADED:` labels → `Chunks` / `Uploaded`.
- **`src/components/layout.tsx`**: outer container `min-h-screen` → `h-screen overflow-hidden`; sidebar `sticky h-auto md:h-screen` → `shrink-0` with `border-b md:border-b-0 md:border-r` (fixes mobile overflow where `h-screen` on `<main>` pushed total height to sidebar + 100vh); main `h-screen` → `min-h-0`; footer `SYSTEM_CORE_v1.0.4` → `Signal87 Core`.
- **`src/pages/not-found.tsx`**: was `bg-gray-50 / text-gray-900` (wrong theme) with developer message "Did you forget to add the page to the router?"; rewritten to match app dark theme, links to `/documents`, no dev message.
- **`src/pages/document-chat.tsx`**: `INITIALIZING_SESSION...` → `Loading...`; empty-state heading `SYSTEM_READY` (font-mono) → `Ready for your questions` (font-semibold) with added hint "Every answer will cite its exact source."; `PROCESSING_QUERY...` → `Thinking...` (removed font-mono); input placeholder `Query document...` → `Ask a question about this document...`; footer `SIGNAL87 CORE // RESPONSES GROUNDED IN SOURCE DOCUMENTS` → `Answers grounded in your document`.
- **`src/pages/document-detail.tsx`**: 14 user-facing SCREAMING labels converted — `BACK_TO_DOCUMENTS` → `Back to Documents` (×2), `DOCUMENT_NOT_FOUND` → `Document not found`, `LOADING_PREVIEW` → `Loading preview...`, `FAILED_TO_LOAD_PREVIEW` → `Failed to load preview`, `NO_PREVIEW_AVAILABLE` → `No preview available`, both `EXTRACTED_TEXT_PREVIEW —` banners → readable descriptions, `CHUNKS` / `INDEXED:` → `chunks` / `Indexed:`, `NO_EXTRACTED_TEXT` → `No extracted text available`, `SOURCE_CHUNKS — N blocks indexed for retrieval` → `Source chunks · N indexed for retrieval`, `CHUNK_LOAD_FAILED — ...` → `Could not load source chunks`, `CHUNK #N` badge → `Chunk N`, `N CHARS` → `N chars`, `NO_CHUNKS_INDEXED` → `No source chunks found`, `HISTORY_LOAD_FAILED — ...` → `Could not load history`. System-tab row labels kept as-is (intentional debug content).

### Verification
- `pnpm --filter @workspace/signal87-core run typecheck` passes.
- Screenshots confirmed: homepage clear headline/CTA, documents list with readable labels, chat with updated placeholder and footer.

---

## [Signal87_Core_Core_Flow_Simplification_v1] — 2026-06-14

### Summary
Frontend-only simplification pass to focus the app on the single core user flow (upload PDF → list → open document → PDF preview → ask a question → grounded cited answer → delete). The three deferred/secondary features — Multi-document Comparison (`/compare`), Executive Brief (`/brief`), and Admin Stats (`/admin`) — are now **hidden from the UI, not deleted**. Their page files and backend routes remain on disk so the features are fully reversible. No backend changes, no API contract changes, no redesign, and no changes to storage/upload/download/delete/reindex or the PDF viewer.

### Changed
- **`src/components/layout.tsx`**: sidebar nav reduced to a single "Documents" item; removed the Compare Docs / Exec Brief / Admin Stats nav entries and their now-unused icon imports.
- **`src/App.tsx`**: removed the `/compare`, `/brief`, and `/admin` routes and the imports of their page components. These paths now fall through to the existing NotFound route.
- **`src/pages/document-detail.tsx`**: removed the "Compare" and "Generate Brief" cross-link buttons from the primary actions row (and their unused icon imports); relabeled the primary action "Analyze Document" → "Ask a Question".
- **`src/pages/documents.tsx`**: relabeled the per-document card action "Analyze" → "Ask a Question" to match the core-flow language.

### Preserved
- The full core flow is intact: upload (PDF/DOCX/TXT/CSV), document list, document detail with all tabs (Preview / Extracted Text / Citations / History / System), the in-platform PDF viewer, single-document chat with grounded `[Source N]` citations + Verification Trace, download original, re-index, and delete.
- The deferred features are hidden, not removed: `pages/multi-document-chat.tsx`, `pages/executive-brief.tsx`, and `pages/admin.tsx` remain on disk, and their backend routes (`POST /api/documents/brief`, multi-chat, `GET /api/admin/stats`) are unchanged — re-adding a nav item + route restores each feature.

### Verification
- `pnpm --filter @workspace/signal87-core run typecheck` passes.
- Dev core-flow smoke (upload real PDF → list → preview/original → chat returns 3 citations → delete) all green; `/documents` and `/documents/:id` render with the cleaned nav and no Compare/Brief buttons; consoles clean.

---

## [Signal87_Core_MVP_Readiness_Fixes_v1] — 2026-06-14

### Summary
Production-readiness pass against a 15-item publishable-MVP checklist. Verification only confirmed the core flows (upload → list → open → PDF preview → Q&A → grounded citations → delete) all work on well-formed documents. Two small, contained launch-blocker fixes were made; no new features, no redesign, no API contract changes, no storage/upload/download/delete/reindex/PDF-viewer changes. Per an explicit product decision, the app ships **open access** (no signup/login).

### Fixed
- **`components/file-upload.tsx`**: added a `DialogDescription` to the Upload Document modal, resolving a Radix accessibility warning (`Missing Description or aria-describedby` for `DialogContent`) that surfaced in the browser console.
- **`lib/retriever.ts`**: `retrieveRelevantChunks` now returns `[]` early when a document has 0 chunks, mirroring the existing guard in `retrieveAcrossDocuments`. Previously, asking a question about a document whose extraction failed (0 chunks) sent an empty array to the OpenAI embeddings API, throwing `400 Invalid 'input': input cannot be an empty array` and logging a server ERROR. The chat endpoint already caught this and returned a graceful "no information" answer (HTTP 200), but the failed API call and ERROR log are now eliminated.

### Preserved
- Normal (non-empty) single-doc retrieval, multi-doc comparison, Executive Brief, citations, and Verification Trace behavior are unchanged.
- The chat endpoint still returns HTTP 200 with a grounded "no information" answer for 0-chunk documents.

---

## [Signal87_Core_PDF_Preview_Fallback_v1] — 2026-06-14

### Summary
Frontend-only fix to the Document Detail Page **Preview tab** for PDFs whose original file was never stored (documents uploaded before durable file storage was enabled). Previously these showed a cryptic, centered `ORIGINAL_FILE_UNAVAILABLE` dead-end with no context — which made it look like the in-platform PDF viewer was missing. The viewer itself (`Signal87_Core_PDF_Viewer_v1`) is unchanged and continues to render any PDF that has a stored original. No backend changes, no API contract changes, no storage/upload/download/delete/reindex changes.

### Changed
- **`pages/document-detail.tsx`**: the PDF `!originalFileAvailable` Preview branch now renders a clear, plain-language notice ("Original PDF not stored — can't render in viewer") explaining the cause (uploaded before durable storage) and the fix (re-upload to enable preview; new uploads render automatically), and falls back to the document's extracted text when available (reusing the existing extracted-text Card pattern) instead of a bare dead-end.

### Preserved
- The `PdfViewer` component and the normal PDF render path (page nav, zoom, fit-to-width, loading/error states, Download Original) are untouched.
- Download Original / Re-Index header controls remain disabled when no original is stored.

---

## [Signal87_Core_Typography_Polish_v1] — 2026-06-14

### Summary
Frontend-only typography and readability pass. **Inter is now the sole primary UI font** (Geist removed from the font-family stack; Inter was already loaded via Google Fonts). Space Mono is retained exclusively for Verification Trace values, system metadata labels, route/model names, and technical debug identifiers. All user-facing action button labels converted from `SCREAMING_CASE` to Title Case. No backend changes, no API contract changes, no layout or component redesign.

### Changed
- **`src/index.css`**: `--app-font-sans` changed from `'Geist', 'Inter', sans-serif` → `'Inter', sans-serif`.
- **`pages/documents.tsx`**: "ANALYZE" → "Analyze"; "CANCEL" / "CONFIRM_DELETE" → "Cancel" / "Delete"; `font-mono` removed from all action buttons.
- **`pages/document-detail.tsx`**: "ANALYZE_DOCUMENT" → "Analyze Document"; "COMPARE" → "Compare"; "GENERATE_BRIEF" → "Generate Brief"; "DOWNLOAD_ORIGINAL" → "Download Original" (×3); "RE-INDEX" → "Re-Index"; "DELETE" → "Delete"; "CANCEL" / "CONFIRM_DELETE" → "Cancel" / "Delete"; "COPY_TEXT" → "Copy Text"; "CHAT_HISTORY — prior analysis on this document" → "Chat history — prior analysis on this document"; "NO_CHAT_HISTORY" → "No chat history"; `font-mono` removed from all action buttons and the history section header.
- **`pages/multi-document-chat.tsx`**: "COMPARE" → "Compare"; `font-mono` removed from submit button.
- **`pages/executive-brief.tsx`**: "COPY_BRIEF" / "COPIED" → "Copy Brief" / "Copied"; "GENERATE_BRIEF" → "Generate Brief"; `font-mono` removed from both buttons.
- **`components/file-upload.tsx`**: "UPLOAD_DOCUMENT" → "Upload Document"; "SELECT_FILE (PDF, DOCX, TXT, CSV)" → "Select file (PDF, DOCX, TXT, CSV)"; "UPLOADING..." / "UPLOAD" → "Uploading..." / "Upload"; "CANCEL" → "Cancel"; `font-mono` removed from all interactive elements; dialog title changed to `font-semibold`.
- **`components/pdf-viewer.tsx`**: "DOWNLOAD_ORIGINAL" → "Download Original"; `font-mono` removed.

### Preserved (intentional mono)
- Verification Trace fields: all values remain Space Mono.
- System tab metadata: `DOCUMENT_ID`, `STORAGE_KEY`, `EXTRACTION_STATUS`, etc. remain mono.
- Technical status indicators: extraction status badge, chunk/indexed metadata in the Extracted Text tab.
- Brand/terminal labels on the home page: `CORE_SYSTEM_ONLINE`, `ACCESS_SYSTEM`, `INTELLIGENCE_NODE_ACTIVE`, `SYSTEM_CORE_v1.0.4`.
- Page sub-headers: `INDEXED_FILES`, `BRIEF_GENERATOR // SELECT 1–5 DOCUMENTS`, etc.

---

## [Signal87_Core_Answer_Rendering_Polish_v1] — 2026-06-14

### Summary
Frontend-only Markdown rendering pass for all AI-generated answer text. Replaced the `whitespace-pre-wrap` plain-text rendering in single-document chat, multi-document comparison, and Executive Brief sections with a shared `MarkdownAnswer` component backed by `react-markdown` + `remark-gfm`. **Bold text, numbered lists, bullet lists, section headings, and paragraphs now render as structured HTML.** Citation pill injection is preserved — citation tokens (`[Chunk N]`, `[Source N]`) are intercepted inside the Markdown renderer's component overrides and converted to the existing `InlineCitation` pill components. No backend changes, no API contract changes, no retrieval changes.

### Added
- **`src/components/markdown-answer.tsx`** (new shared component): `MarkdownAnswer` — accepts `content`, `citationPattern` (regex), and `renderCitation` callback; uses `react-markdown` + `remark-gfm` for structure; custom component overrides for `p`, `li`, `ul`, `ol`, `h1`–`h3`, `strong`, `em`, `code`, `pre`, `blockquote`. A `processChildren` helper walks React children from markdown nodes and splits any string children on the citation pattern, replacing matches with pill components from the caller's `renderCitation` callback.

### Changed
- **`pages/document-chat.tsx`**: removed `renderAnswerWithCitations`; `AssistantAnswer` now renders AI answers via `<MarkdownAnswer citationPattern={/\[\s*chunks?\s+(\d+)\s*\]/} … />` preserving existing `InlineCitation` pills.
- **`pages/multi-document-chat.tsx`**: removed `renderAnswerWithCitations`; comparison answers now rendered via `<MarkdownAnswer citationPattern={/\[\s*sources?\s+(\d+)\s*\]/} … />`.
- **`pages/executive-brief.tsx`**: removed `renderBodyWithCitations`; each section body now rendered via `<MarkdownAnswer citationPattern={/\[\s*sources?\s+(\d+)\s*\]/} … />`.
- **`package.json` (signal87-core)**: added `react-markdown`, `remark-gfm`.

### Unchanged / preserved
- API contract, all Zod schemas, codegen — not touched.
- Citation pill component definitions, citation payload shape, Verification Trace.
- PDF viewer, storage, upload/download/delete/reindex, OpenAI routing.
- Copy Brief output (plain-text Markdown string — unaffected by rendering layer).

---

## [Signal87_Core_Executive_Brief_Quality_Polish_v1] — 2026-06-14

### Summary
Quality polish pass on the Executive Brief generator. **No new features, no architecture changes, no new endpoints, no retrieval changes.** Five improvements: (1) Copy Brief now outputs a proper `# Title` heading and a `## Sources` footer mapping every `[Source N]` to document name, chunk number, and relevance score. (2) The Risk Brief prompt enforces citation honesty — severity/likelihood/impact ratings are prefixed "Assessed" and citations must support the underlying risk, not the inferred rating. (3) System prompt gains explicit anti-fluff rules (ban on "innovative", "powerful", "cutting-edge", etc.) and requires recommendations to trace to cited findings or be omitted. (4) Executive Summary sections restructured to eliminate overlap: Overview / Key Findings / What Stands Out / Watch Items / Open Questions / Source Notes. (5) Verification Trace panel adds a synthesized-query note explaining why relevance scores may read lower than Q&A searches; section names polished ("Risk Assessment", "Open Items", "Notes by Document").

### Changed
- **`lib/brief.ts`**: Executive Summary sections renamed and de-duplicated; Risk template section "Severity & Likelihood" → "Risk Assessment"; Diligence "Outstanding Items" → "Open Items"; Comparison "Per-Document Notes" → "Notes by Document". Risk `instructions` updated to require "Assessed" prefix on ratings and prohibit citing a source for an inferred rating. Executive Summary `instructions` updated to keep each section distinct with no cross-section repetition.
- **`routes/brief/index.ts`**: System prompt hardened with Rule 5 (ban unsupported evaluative adjectives) and Rule 6 (recommendations must trace to a cited finding or be omitted); Rule 3 extended to require stating when sources are insufficient.
- **`pages/executive-brief.tsx`** — `handleCopy`: output changed from `title\n\n## sections` to `# title\n\n## sections\n\n## Sources\n[Source N] name — Chunk K (relevance S)`.
- **`pages/executive-brief.tsx`** — `TraceDetailPanel`: synthesized-query note added at the bottom of the expanded trace.

### Unchanged / preserved
- API contract, endpoint, and all Zod schemas — no codegen re-run needed.
- Citation generation, retrieval pipeline, chunk scoping, fallback behaviour.
- PDF viewer, storage, upload/download/delete/reindex, single-doc chat, multi-doc comparison.

---

## [Signal87_Core_Executive_Brief_Generator_v1] — 2026-06-14

### Summary
Added an **Executive Brief generator**: select 1–5 indexed documents, pick one of **5 brief types** (Executive Summary, Risk, Diligence, Contract Review, Comparison), optionally add a free-text **focus instruction**, and generate a **structured brief** (titled sections) with inline `[Source N]` citations and a full **Verification Trace**. New additive backend route (`POST /api/documents/brief`) and a new frontend page (`/brief`). Brief generation **duplicates** the multi-chat retrieval/citation pattern — it does **not** modify or call multi-chat. No Gemini, global search, billing, or agents. No changes to durable storage, the PDF viewer, upload/download/delete/reindex, single-doc chat, or multi-doc comparison.

### Added
- **OpenAPI contract** (`lib/api-spec/openapi.yaml`): `POST /documents/brief` (operationId `generateBrief`, tag `chat`) with schemas `BriefInput` (documentIds 1–5, briefType enum of 5, optional `focus` ≤500 chars), `BriefSection`, `BriefCitation`, `BriefDebugInfo` (reuses `MultiChatDocumentStat`, adds `briefType` + `focusProvided`), `BriefResult`. Schema names chosen to avoid Orval auto-symbol collisions. Regenerated client hooks + Zod via codegen.
- **Brief template lib** (`artifacts/api-server/src/lib/brief.ts`): `BRIEF_TEMPLATES` for all 5 types (label, title hint, ordered section headings, prompt instructions, retrieval seed), `COMPARISON_MIN_DOCS_MESSAGE`, and `buildBriefRetrievalQuery(type, focus)` (synthesizes an embedding query from the brief type + optional focus, since briefs have no user question).
- **Backend route** (`artifacts/api-server/src/routes/brief/index.ts`, registered in `routes/index.ts`): validates via Zod `GenerateBriefBody`, dedupes ids, enforces 1–5 and Comparison ≥2 (exact `COMPARISON_MIN_DOCS_MESSAGE`), fetches docs + chunks scoped strictly to the selection, fails closed on missing docs (404) or empty-chunk docs (400), runs `retrieveAcrossDocuments` (top-3 per doc), builds global `[Source N]` blocks, calls OpenAI `gpt-4o-mini` with `response_format: json_object`, parses `{title, sections}` (single-section fallback on parse/LLM error), and returns a debug trace (route/provider/model/fallbackUsed/briefType/focusProvided/per-doc chunk stats/latencies/errors).
- **Frontend page** (`artifacts/signal87-core/src/pages/executive-brief.tsx`): document selection grid (1–5, `?preselect=` deep-link reconciled against eligible docs), 5-way brief-type selector, optional focus Textarea (500-char cap), Generate button, and a ResultView with titled sections, inline citation chips, citations grouped by document, a collapsible Trace Detail panel, and Copy Brief. Comparison with <2 docs disables submit and shows the exact message. Route `/brief` added in `App.tsx`; nav item **Exec Brief** (`ScrollText`) added in `layout.tsx`.
- **Document Detail link**: `GENERATE_BRIEF` header action → `/brief?preselect=:id` (mirrors the existing Compare link).

### Unchanged / preserved
- Single-document chat and multi-document comparison (multi-chat code path untouched — brief logic is duplicated, not refactored into it).
- Durable file storage, upload/download/delete/reindex, PDF viewer, OpenAI routing, citation payload shape, Verification Trace.

---

## [Signal87_Core_PDF_Viewer_v1] — 2026-06-14

### Summary
Replaced the basic `<iframe>` PDF preview in the Document Detail Page's **Preview tab** with a real in-platform **PDF viewer** built on `react-pdf` (pdf.js). PDFs now render page-by-page inside the platform with navigation, zoom, and fit-to-width — no reliance on the browser's native plugin or a forced download. This is a **viewer only**: no annotation, highlighting, redaction, signing, editing, OCR, in-PDF search, or thumbnails. Frontend-only change — no backend, storage, OpenAI routing, or contract changes. No Gemini, global search, billing, or agents.

### Added
- **`PdfViewer` component** (`artifacts/signal87-core/src/components/pdf-viewer.tsx`):
  - Page rendering via `react-pdf` `<Document>` / `<Page>`.
  - Previous / next page navigation with current page + total page count (`N / M`).
  - Zoom in / zoom out (50%–300%, 25% steps) and a fit-to-width toggle (uses a `ResizeObserver` on the container).
  - Loading state (`LOADING_PDF` / `RENDERING_PAGE`) and error state (`FAILED_TO_RENDER_PDF`).
  - Download Original button in the toolbar and in the error fallback, so the original is always reachable even if rendering fails.
  - pdf.js worker configured for Vite via `import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url"` and `pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerUrl`.

### Changed
- **Preview tab** (`pages/document-detail.tsx`): for PDFs with a stored original, renders `<PdfViewer>` (fed the existing object-URL blob fetched from `GET /api/documents/:id/original`) instead of an `<iframe>`. Non-PDF files keep the extracted-text preview fallback unchanged. The blob-fetch failure state now also offers Download Original.

### Dependencies
- Added `react-pdf` and `pdfjs-dist` (pinned to match react-pdf's pdf.js version) as dev dependencies of `@workspace/signal87-core`.

### Unchanged / preserved
- Durable file storage, upload/download/delete/reindex, OpenAI routing, citation payloads, Verification Trace.
- The other Detail tabs (Extracted Text, Citations, History, System), single-document chat, multi-document comparison.
- No backend code or API contract changes — the viewer consumes the existing `/original` endpoint.

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
