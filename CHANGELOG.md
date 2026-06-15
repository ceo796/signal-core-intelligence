# Signal87 Core — Changelog

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
