# Signal87 Core — QA Test Plan

> Checkpoint: **Signal87_Trash_SoftDelete_v11**
> Last updated: 2026-06-22
> Note (Trash_SoftDelete_v11): New tests **T81–T81e** cover the Trash / Soft-delete feature. **T81** = deleting a document from the Documents list shows a confirmation dialog saying "moved to Trash" (not "permanently remove"); after confirming, the document disappears from the list, a toast says "Document moved to Trash", and the Trash nav item counter updates. **T81a** = visiting `/trash` shows a list of trashed documents with file name, type, size, and deleted date; each row has Download Original, Restore, and Permanently Delete buttons. **T81b** = clicking **Restore** on a trashed document moves it back to Documents (visible in the list, `/trash` count decreases), with a toast confirming the restore. **T81c** = clicking **Permanently Delete** on a trashed document shows a confirmation dialog; after confirming, the document is gone from Trash and the original file is removed from storage. **T81d** = clicking **Empty Trash** shows a confirmation dialog; after confirming, all trashed documents are permanently deleted and the count goes to zero. **T81e (scope intact)** = trashed documents are **excluded** from Documents list, AI Chat document selection, Analyze selection, Brief selection, Compare selection, and single-document chat; `GET /api/documents/:id` on a trashed doc returns `404`; no change to upload, extraction, indexing, PDF viewer, spreadsheet viewer, AI chat behavior, citations, or Verification Trace. **Backend + frontend** — DB schema already had `deletedAt`/`deletedBy` columns (no new migration needed); OpenAPI/codegen updated for 4 trash endpoints; typecheck clean; no runtime/console errors.
>
> Prior checkpoint: **Signal87_SpreadsheetGridViewer_v10**
> Last updated: 2026-06-22
> Note (SpreadsheetGridViewer_v10): New tests **T80–T80d** cover the polished spreadsheet preview on the Document Detail page (`/documents/:id`) for XLSX/XLS/CSV — **frontend-only**. **T80** = opening a multi-sheet `.xlsx` with a stored original shows a **spreadsheet grid** (toolbar info chips, sheet tabs, paginated table with row numbers + sticky header) as the **default** preview — not the raw extracted indexing text. **T80a** = clicking **"View extracted text"** switches to the raw indexed text (debug view) and "Back to preview" returns to the grid; the grid is the default on load. **T80b** = a **CSV** opens as a single-sheet grid (no sheet tabs, no "sheets" chip); a multi-sheet workbook shows clickable **sheet tabs** and switching a sheet resets pagination; an **empty sheet** shows an inline "This sheet is empty" message while the tabs stay usable. **T80c** = honest fallbacks — a spreadsheet **without a stored original** shows a summary card (file type, sheet count/names parsed from indexed text, extraction status, chunk count) instead of a grid; a parse failure shows an error state with **Download Original**; an entirely empty workbook shows "no readable rows". **T80d (scope intact)** = Download / Open Original / Re-Index / Ask AI / More actions, the PDF viewer for PDFs, and the non-spreadsheet extracted-text preview are all unchanged; **no** backend, route, OpenAPI/codegen, DB schema, auth/ownership, storage, upload, extraction, chat, citation, or Verification Trace change; spreadsheet AI indexing is preserved; typecheck clean; no runtime/console errors.

> Prior checkpoint: **Signal87_DocumentDetail_ViewerOnly_v7**
> Last updated: 2026-06-22
> Note (DocumentDetail_ViewerOnly_v7): New test **T79** covers the document detail page viewer-only refactor. **T79** = navigating to `/documents/:id` shows a **full-width document viewer** (PDF embed, extracted text, or not-available message) with **no** AI Analysis panel visible or mounted; no AI queries fire on page load. **T79a** = the header action bar contains an **"Ask AI"** button (was "Ask") that navigates to `/documents/:id/chat` (single-doc chat) — this is the only path into AI for this document. **T79b** = all other header actions are preserved: Download, Open Original, Re-Index, Print (PDF-only), Highlight mode (PDF-only), Delete. **T79c** = the More menu (DropdownMenu) is preserved with Download / Open Original / Re-Index / Print / Highlight / Delete items; Highlight mode still works on PDF documents. **T79d** = status alert (not-ready banner) renders below the meta row when the document is not ready; the "Ask AI" button is still present but single-doc chat enforces its own readiness gate. **Frontend-only** — no backend, auth/Clerk, DB schema, OpenAPI/codegen, upload, extraction, citation, or Verification Trace changes; the `DocumentIntelligencePanel` component is no longer mounted on this page; `POST /api/agent/hybrid` is not called from document detail; single-doc chat, hybrid AI chat, brief, compare, activity, and admin are unchanged; typecheck clean; no runtime/console errors.

> Prior checkpoint: **Signal87_Light_Theme_Reskin_v6**
> Last updated: 2026-06-22
> Note (Light_Theme_Reskin_v6): New tests **T78–T78d** cover the authenticated app light-theme reskin. **T78** = visiting any logged-in route (`/dashboard`, `/documents`, `/agents/hybrid`, etc.) shows a light Notion/Dropbox-style UI with white surfaces, light gray borders, and indigo (#4F3FF0) primary accent — not the prior dark theme. **T78a** = the public landing page (`/`) is unchanged — still dark Retool-style with near-black background, cream pills, and the hero collage. **T78b** = all portaled overlays (dropdowns, popovers, dialogs, select menus, toasts) inherit the light theme correctly (no dark dropdowns on a light page). **T78c** = all existing functionality works identically — upload, download, delete, re-index, PDF viewer, single-doc chat, hybrid AI chat, brief, compare, citations, Verification Trace, admin, settings, activity — only colors changed. **T78d** = no fake data or mock stat cards anywhere; all data is real backend data; empty states are honest. **Frontend-only** — no backend, auth/Clerk, DB, OpenAPI/codegen, upload, extraction, chat, citation, or Verification Trace changes; typecheck clean; landing page (`/`) untouched; sign-in/sign-up untouched.

> Prior checkpoint: **Signal87_Home_Command_Center_v1**
> Last updated: 2026-06-19
> Note (Home_Command_Center_v1): New tests **T77–T77d** cover the Home / Command Center page. **T77** = visiting `/` when signed in redirects to `/dashboard`; the sidebar shows **Home** (LayoutDashboard icon) as the first nav item and it is highlighted when on `/dashboard`. **T77a** = the Ask bar reads "Ask Signal87 across your documents" and clicking it navigates to `/agents/hybrid`. **T77b** = the five quick-action buttons are present: Upload document → navigates to `/documents`; Create brief → `/brief`; Compare documents → `/compare`; Start workflow → toast "Workflows coming soon"; New collection → toast "Collections coming soon". **T77c** = Recent documents loads from the existing `GET /api/documents` endpoint and shows the 5 most-recently-uploaded documents with file-type color badge + relative timestamp; an empty state ("No documents yet") is shown if the library is empty. **T77d** = Recent briefs always shows an empty state with the explanation "Briefs are generated on-demand and not stored" (no brief history API exists). Suggested actions section shows four cards: Summarize a collection → `/brief`, Compare documents → `/compare`, Extract key insights → `/agents/hybrid`, Create a brief → `/brief`. **Frontend-only** — no backend, auth/Clerk, DB, OpenAPI/codegen, upload, extraction, citations, Verification Trace, or provider/model changes; all existing routes (Documents, AI Chat, Brief, Compare, Activity, Settings) still load and behave exactly as before; unauthenticated access to `/dashboard` still redirects to Clerk sign-in; typecheck clean; no runtime/console errors.
> Prior checkpoint: **Signal87_Landing_Partners_v1**
> Last updated: 2026-06-19
> Note (Landing_Partners_v1): New test **T76** covers the "Backed by" partner strip added to the public landing page (`/`) — **landing-page-only**, frontend. **T76** = directly below the hero (and above the ticker), `/` shows a muted uppercase **"Backed by"** caption above a framed monochrome band displaying the **NVIDIA Inception** and **Google Cloud for Startups** logos (supplied composed image at `public/partners-strip.png`, referenced via `import.meta.env.BASE_URL`); the band is centered, capped at 760px wide, and scales within the page container with **no horizontal overflow** at desktop / tablet / mobile widths; nav + all other landing sections + the authenticated app are unchanged; only `pages/home.tsx` + the new image changed; **no** backend / route / OpenAPI / DB / auth change; typecheck clean; no runtime/console errors.
> Prior checkpoint: **Signal87_Landing_Sections_v1**
> Last updated: 2026-06-19
> Note (Landing_Sections_v1): New tests **T75–T75c** cover the two sections added to the public landing page (`/`) — **landing-page-only**, frontend; recreated as native CSS/JSX from the attached mockups (no embedded raster images). **T75 (three-step section)** = below the governance section, `/` shows an eyebrow pill *"Build your first document workflow"*, the heading *"From source material to verified answer in three steps."*, and **three purple-gradient cards**, each with a white mock panel (**Signal87 Library** w/ `Q1 Financials.xlsx` + `Master Services Agreement.pdf` rows; **Ask Signal87** w/ the *"Use GPT reasoning + selected documents"* pill; **Verification Trace** w/ `Chunk 04 · Agreement A` + `Chunk 11 · Agreement B`) and a step title + description beneath (Set your workspace up for intelligence / Use GPT reasoning on your documents / Verify every important answer). **T75a (Grounded AI blocks)** = a split section shows a dark teal-glow stage with a **dashed frame** containing a `summarizeDocument` (white) card, a `verificationTrace` (dark, header **stacked over** the code — not side-by-side) card, and `generateBrief` / `compareDocs` pills on the left, plus an icon + *"Grounded AI blocks"* heading + description on the right. **T75b (responsive / fits margins)** = at ≤980px both sections collapse to one column and at ≤640px the overlapping trace card resets; content stays inside the page container with **no horizontal overflow / scrollbar** at desktop, tablet, and mobile widths. **T75c (scope intact)** = nav + all pre-existing sections (hero, ticker, governance, `#workflow`, footer) and the **authenticated app** are unchanged; only `pages/home.tsx` changed; **no** backend / route / OpenAPI / DB / auth change; typecheck clean; no runtime/console errors.
> Prior checkpoint: **Signal87_Landing_Page_Retool_Redesign_v1**
> Last updated: 2026-06-19
> Note (Landing_Page_Retool_Redesign_v1): New tests **T74–T74d** cover the replaced public landing page (`/`) — **landing-page-only**, frontend. **T74** = visiting `/` (signed out) loads the **Retool-style dark** landing page: near-black background, large thin off-white headline *"Extend your team with verifiable AI reasoning."*, cream **Start for free** + green-outline **Book a demo** pills, sticky top nav, the hero product-collage on the right, the moving ticker, the governance/security split with Citations / Verification Trace / GPT Reasoning badges, and the three Upload → Ask → Verify feature cards; positioning still reads document intelligence + GPT reasoning + grounded citations + verification trace + private workflows + **no live web research**. **T74a** = nav contains **Signal87 AI** wordmark, **Product / Governance / Use cases / Security** (smooth-scroll anchors to in-page sections), **Sign in**, **Book a demo**, **Start for free**. **T74b (auth wiring)** = **Sign in → `/sign-in`** and **Start for free → `/sign-up`** open the existing Clerk screens and sign-in/sign-up still work; **Book a demo → `/contact`**; a **signed-in** visitor instead sees **Open App → `/documents`** (nav + hero). **T74c (responsive)** = premium on desktop **and** mobile — at ≤980px nav links collapse and the hero/split + collage stack; at ≤640px it reduces to the primary pill; ticker + smooth-scroll respect `prefers-reduced-motion`. **T74d (scope intact)** = the **authenticated app is unchanged** — Documents list/detail, upload, download, delete, reindex, PDF viewer, spreadsheet, single-doc chat, Ask, Activity, Brief, Compare, AI Chat all still load and behave exactly as before; unauth protected routes still **401**/redirect; **no** backend / route / OpenAPI / DB schema / object-storage change (only `pages/home.tsx` changed). **No TypeScript / build / runtime errors** (typecheck clean; only standard Vite + Clerk dev console notices).
> Prior checkpoint: **Signal87_Hybrid_AI_Chat_GPT_UI_v1**
> Last updated: 2026-06-19
> Note (Hybrid_AI_Chat_GPT_UI_v1): New tests **T73–T73c** cover the ChatGPT-style redesign of `/agents/hybrid` (frontend-only; behavior unchanged). **T73** = on first load (no answer yet) the **textbox is centered in the middle of the page** under the "Hybrid AI Chat" eyebrow + "What can I help you find?" greeting + the *documents + GPT reasoning, no web research* explainer; **Enter** submits and **Shift+Enter** inserts a newline. **T73a** = directly **underneath the textbox**, **Mode** is a **pill-button dropdown** (Auto/Summarize/Compare/Extract/Diligence, descriptions + check on the active one) and **Documents** is a **dropdown** (popover multi-select checkbox list; trigger reads "All documents" when none selected, "N selected" otherwise; "Clear" resets); the disabled **"Web · Soon"** pill is present, non-interactive, and makes **no** network calls. **T73b** = submitting docks the composer to the **bottom**, shows the question as a right-aligned **bubble** and a **"Thinking…"** indicator, then renders the answer above with the **same** `[Source N]` citations, the three source badges (Document context / GPT reasoning / disabled Web context), the "Searched:" doc chips, and the **Verification Trace** — i.e. T72a/T72b citation + label behavior is preserved verbatim. **T73c** = on query failure the error shows and the **textbox content is restored** (not lost). **Frontend-only** — same `POST /api/agent/hybrid`, no backend/route/OpenAPI/codegen/schema/auth/storage change; unauth still **401**; upload, download, delete, reindex, PDF viewer, single-doc chat, brief, compare, and the `{answer,mode,documentsUsed,citations,trace}` payload are unchanged.
> Prior checkpoint: **Signal87_Hybrid_AI_Chat_GPT_Only_v1**
> Last updated: 2026-06-18
> Note (Hybrid_AI_Chat_GPT_Only_v1): New tests **T72–T72d** cover the Hybrid AI Chat discoverability + GPT-only positioning. **T72** = the nav shows **AI Chat** (Sparkles icon) as the **2nd** item (after Documents) routing to `/agents/hybrid`; the page header reads **"Hybrid AI Chat"** with the *documents + GPT reasoning, no web research* explainer. **T72a** = a question the documents cover returns an answer with `[Source N]` citations, the **"Document context"** source badge active, the **"Searched:"** doc chips, and the Verification Trace (provider `openai` / model `gpt-4o-mini`) — exactly as before (citation behavior preserved). **T72b** = every answer shows three source labels — **Document context** (active only when docs contributed; "· not used" otherwise), **GPT reasoning** (always active), and a **disabled "Web context · Coming soon"** badge; a question the docs don't cover still answers via GPT reasoning, is clearly labeled as general reasoning, shows Document context as "not used", and never claims a web/external source. **T72c** = the form's **"Web context — Coming soon"** placeholder control is visibly disabled, non-interactive, and triggers **no** network calls. **T72d** = the Documents dashboard shows an **"Ask a question across your documents"** CTA → `/agents/hybrid` only when ≥1 document exists (hidden on empty/loading). **Provider discipline:** only OpenAI is ever called (no Gemini/Anthropic/Claude/web-search/scraping); a missing `OPENAI_API_KEY` **fails clearly at startup** (no silent provider switch). **Unchanged:** auth (unauth still **401**), upload, storage, download, delete, reindex, PDF viewer, single-doc chat, brief, compare, and the `{answer,mode,documentsUsed,citations,trace}` payload.
> Prior checkpoint: **Signal87_Upload_Drag_And_Drop_v1**
> Last updated: 2026-06-18
> Note (Upload_Drag_And_Drop_v1): New tests **T71–T71b** cover **drag-and-drop** in the **"Upload Documents"** dialog. **T71** = dragging one or more files over the dashed drop zone shows the active hover state ("Drop files to add them", primary border/tint), and dropping them lists each as its own queue row exactly as picking files does; clicking Upload uploads them via the existing per-file `POST /api/documents/upload`. **T71a** = dropped files go through the same de-dupe (name+size+lastModified) and per-file validation as picked files — an unsupported-type or >20 MB dropped file is flagged inline and skipped, valid ones still queue; the in-zone **browse** link still opens the native picker and both sources can be mixed. **T71b** = drops are ignored while an upload is in progress, and the hover state clears correctly on dragleave/drop (no flicker on nested drag). **Frontend-only** — no backend, auth/Clerk, owner, DB schema, OpenAPI/codegen, storage, or extraction changes; unauth still **401**; owner-scoping, the PDF viewer, download/print/delete/reindex, and the citations + Verification Trace payload are unchanged.
> Prior checkpoint: **Signal87_Multi_Document_Upload_v1**
> Last updated: 2026-06-18
> Note (Multi_Document_Upload_v1): New tests **T70–T70d** cover multi-file upload from the **"Upload Documents"** dialog. **T70** = selecting multiple valid files lists each as its own row (size + remove control), and clicking Upload uploads them all (button shows `Uploading X of Y…`), each row resolving to success; the documents list refreshes and a summary success toast appears. **T70a** = adding files in multiple picks accumulates (de-duplicated), and a row can be removed before upload. **T70b** = an invalid file (unsupported type or >20 MB) is flagged inline and is **not** uploaded, while valid files in the same batch still upload. **T70c** = a file with no extractable text resolves to a per-row **warning** (uploaded but needs re-index) and is counted in the warning summary. **T70d** = on partial failure the dialog stays open showing which files failed, and clicking Upload again **retries only the failed files** (no re-selection needed). **Frontend-only, client-side fan-out** — each file still hits the existing `POST /api/documents/upload` **one request per file**; no backend, multer, auth/Clerk, owner, DB schema, OpenAPI/codegen, storage, or extraction changes. Unauth still **401**; owner-scoping, the PDF viewer, download/print/delete/reindex, and the citations + Verification Trace payload are unchanged.
> Prior checkpoint: **Signal87_Document_Workspace_AI_Panel_v1**
> Last updated: 2026-06-18
> Note (Document_Workspace_AI_Panel_v1): New tests **T69–T69e** cover the two-column Document Workspace on `/documents/:id` — the existing document detail (header, actions, all five tabs, PDF viewer) on the left, and an embedded **Hybrid AI Agent** panel ("Ask across all your documents.") on the right. **T69** = panel renders beside the document with Scope defaulting to **All documents**; asking a question calls `POST /api/agent/hybrid` with **no `documentIds`** and returns an answer with per-source citations + Verification Trace (documents/chunks considered). **T69a** = Scope **This document only** sends `documentIds: [currentId]`. **T69b** = Scope **Selected documents** shows the indexed-doc checkbox picker, submit is disabled until ≥1 is chosen, and sends the chosen `documentIds`. **T69c** = citations list the document(s) used and the "Searched:" chips reflect `documentsUsed`. **T69d** = Verification Trace shows provider/model/documents-considered/chunks-considered/latency/fallback. **T69e** = owner-scoping still enforced (unauth **401**, cross-owner docs never selectable/returned). **Frontend-only** — no backend, auth/Clerk, owner-scoping, DB schema, OpenAPI/codegen, storage, or routing changes; the standalone `/agents/hybrid` page and all existing detail-page actions (Ask/Download/Print/Re-Index/Delete) are unchanged.
> Prior checkpoint: **Signal87_Print_Documents_v1**
> Last updated: 2026-06-18
> Note (Print_Documents_v1): New tests **T68–T68d** cover the new **Print** feature — a labelled Print button in the Document Detail action bar and a compact printer-icon button in the Documents dashboard list rows + grid cards, both via one reusable `PrintDocumentButton`. Real PDFs with a stored original print the original file (authenticated `GET /api/documents/:id/original` blob → hidden iframe); everything else (TXT/DOCX/CSV/XLSX, and PDFs without an original) prints a clean extracted-text view fetched from the owner-scoped `GET /api/documents/:id`. **Frontend-only** — no backend, auth/Clerk, owner, DB schema, OpenAPI/codegen, upload, storage, extraction, chat, brief, agent, or routing changes; no new public URLs. Both paths reuse the existing authenticated, owner-scoped transport (unauth **401**, cross-owner **404**); Download Original, Re-Index, Delete, the PDF viewer, and the citations + Verification Trace payload are all unchanged.
> Prior checkpoint: **Signal87_Embedded_Preview_Auth_Transport_v1**
> Last updated: 2026-06-18
> Note (Embedded_Preview_Auth_Transport_v1): New tests **T64–T67** cover the centralized Clerk **bearer-token transport** that makes authenticated `/api/*` calls work inside the embedded preview iframe (where the dev session cookie can't establish, so calls previously 401'd). T64 = signed-in approved reads return **200/304** in the iframe (were 401); T65 = Download Original via authenticated blob; T66 = upload via the authenticated transport (207 warning UX preserved); T67 = security gates still enforced (**401** unauth, **403** unapproved, **404** cross-user `owner_user_id` filtering). Frontend-only — no backend, OpenAPI/codegen, DB schema, storage, or UI-redesign changes; cookie auth still works in a standalone tab and production.
> Prior checkpoint: **Signal87_Spreadsheet_Excel_Readability_v1**
> Last updated: 2026-06-18
> Note (Spreadsheet_Excel_Readability_v1): New tests **T58–T63** cover Excel (`.xlsx`/`.xls`) ingestion — upload, sheet-by-sheet readable preview, single-doc chat, hybrid agent, executive brief, and the empty-workbook failure path — all with **sheet/row-aware citations** (`Sheet: <name> | Rows a–b`, `[Chunk N]`/`[Source N]` preserved). CSV ingestion (T05) is **unchanged**. No DB schema, OpenAPI/codegen, auth/ownership, storage, or UI-redesign changes; PDF viewer, download/delete/reindex, and the citations + Verification Trace payload are unchanged.
> Prior checkpoint: **Signal87_Core_Document_Thumbnails_v1**
> Last updated: 2026-06-17
> Note (Document_Thumbnails_v1): New tests **T51–T57** cover the document thumbnail/preview experience on `/documents`. Frontend-only change — no backend, API contract, or schema changes. Auth gate, all card actions (Ask, Re-Index, Delete, click-to-detail), upload, PDF viewer (detail page), chat, brief, compare, activity, and admin are all unchanged.
> Prior checkpoint: **Signal87_Core_Clerk_Auth_v1**
> Last updated: 2026-06-17
> Note (Clerk_Auth_v1): New tests **T40–T50** cover the Clerk auth with approved-email gate. All API routes (except `/healthz`) return **401** when unauthenticated and **403** when signed in but not approved. All frontend app routes (Documents, Ask, Brief, Compare, Activity) redirect to `/sign-in` when not signed in. Landing, public pages, and sign-in/sign-up remain public. The core document flows (upload, PDF viewer, chat, citations, delete) are unchanged and should be tested under a signed-in approved session.
> Note (Ask_Activity_Tabs_v1): New tests **T36–T38** cover the two new **frontend-only** nav tabs — **Ask** (`/ask`, ready-doc picker that routes into the existing single-doc chat) and **Activity** (`/activity`, a read-only feed derived only from existing document data, no fabricated events) — plus three-tab navigation and mobile usability. **No backend, API, contract, or schema changes**; no protected flow (PDF viewer / durable storage / upload / download / delete / re-index / citation + Verification Trace) was touched.
> Type: Manual end-to-end test plan
> Note (Reliability_Clarity_Pass_v1): New tests **T29–T35** cover document status labels, list-level Re-Index for failed/0-chunk docs, the chat not-ready gate (frontend) + `422` guard (backend), upload validation + server-error surfacing, citation "Section N" labels + the no-citations note, and structured Q&A/upload logging. No protected flow (PDF viewer / durable storage / upload / download / delete / re-index mechanics / citation + Verification Trace payload) was changed.
> Scope note (Core_Flow_Simplification_v1): The Multi-document Comparison (`/compare`), Executive Brief (`/brief`), and Admin Stats (`/admin`) features are now **hidden from the UI** — their nav items, routes, and the document-detail Compare/Generate-Brief buttons were removed. Tests that begin by navigating to `/compare`, `/brief`, or `/admin` in the UI (e.g. T13a–T13h, T18/admin, and the detail-page "Compare"/"Generate Brief" steps in T22) are **N/A for this build**; those routes now resolve to NotFound. The backend endpoints remain and can still be exercised directly (e.g. `POST /api/documents/brief`). All core-flow tests (upload → list → detail → PDF preview → single-doc chat → citations/trace → delete) remain in force.
> Note: Answer Rendering Polish (T28) is a frontend-only change — shared `MarkdownAnswer` component replaces `whitespace-pre-wrap` plain text in all three answer surfaces; no API, retrieval, or citation payload changes. The Executive Brief generator (T13e–T13h) adds one additive route (`POST /api/documents/brief`) + a new `/brief` page; it duplicates the multi-chat retrieval/citation pattern and does not modify multi-chat. T13i–T13m cover the quality polish pass (prompt tightening, Copy Brief footer, Risk Assessment honesty, Exec Summary de-duplication, Trace note + section renames) — frontend + prompt-only changes, no API contract or retrieval changes. The PDF viewer (T27) is frontend-only. The detail page (T22–T26) is frontend + one additive read-only backend field; all other backend tests (T01–T10, T16–T21) are unchanged.

---

## Environment setup

1. Confirm both workflows are running (API server + frontend web)
2. Confirm `GET /api/healthz` returns `{"status":"ok"}`
3. Confirm `GET /api/system/info` (with signed-in session) shows:
   - `OPENAI_API_KEY: "set"`
   - `DATABASE_URL: "set"`
   - `DEFAULT_OBJECT_STORAGE_BUCKET_ID: "set"`
   - `PRIVATE_OBJECT_DIR: "set"`
   - `fileStorageConfig.bucketConfigured: true`
   - `fileStorageConfig.originalFilesStored: true`

---

## T68 — Print: Document Detail page (stored PDF original)

**Goal:** The detail page exposes a clearly visible Print button that prints the stored PDF original, without affecting Download Original.

**Steps:**
1. Signed in as approved (`ceo@signal87.ai`), open a Ready PDF document that has an available original (`/documents/:id`).
2. In the header action bar, locate **Print** (printer icon + "Print") between **Download Original** and **Re-Index**.
3. Click **Print**.

**Expected:**
- Print shows a brief loading spinner, then opens the browser print dialog for the original PDF (in headless e2e the native dialog is a no-op — assert no error instead).
- `GET /api/documents/:id/original` returns **200/304** (authenticated blob).
- **No error toast.** Download Original, Re-Index, Ask a Question, and Delete all remain present and functional.

---

## T68a — Print: extracted-text view (TXT / DOCX / CSV / XLSX)

**Goal:** Non-PDF documents (and PDFs without a stored original) print a clean extracted-text view.

**Steps:**
1. Open a Ready non-PDF document (TXT, DOCX, CSV, or XLSX) detail page.
2. Click **Print**.

**Expected:**
- `GET /api/documents/:id` returns **200/304**; the print view renders the document name, a metadata line (type · size · uploaded · chunk count), and the readable extracted text. Spreadsheets show the sheet/row context already encoded in the extracted text.
- **No error toast.**

---

## T68b — Print: Documents dashboard list rows + grid cards

**Goal:** A compact Print action appears (and works) in both dashboard views.

**Steps:**
1. Go to `/documents` (list view). Locate the compact printer-icon button in each document's action row, just before Delete; click it on a Ready PDF row.
2. Switch to grid view; locate the same printer-icon button on each card beside Delete; click it on a PDF card.

**Expected:**
- Both views show the Print icon; existing Ask/Re-Index and Delete remain.
- Clicking the Print icon does **not** navigate to the detail page (the click is stopped), fires the correct authenticated request (PDF → `/original`), and produces **no error toast**.

---

## T68c — Print: nothing-printable gate

**Goal:** Print is disabled (and never silently no-ops) when there is nothing to print.

**Steps:**
1. Find a document whose extraction **failed** and that has **no stored original** (e.g. a failed/0-chunk non-PDF).

**Expected:**
- The Print button is **disabled** (`canPrintDocument` returns false).
- If invoked with stale data (text empty despite status), `printDocument` throws and surfaces a toast ("No printable content available for this document.") rather than doing nothing.

---

## T68d — Print: security (owner scope preserved, no public URL)

**Goal:** Printing never bypasses auth/owner checks and adds no public URL.

**Steps:**
1. Unauthenticated `GET /api/documents/:id/original` and `GET /api/documents/:id`.
2. Signed in as a different (approved) user, attempt to print another user's document id.

**Expected:**
- Unauthenticated → **401**; cross-owner → **404** (unchanged — print reuses the existing authenticated, owner-scoped transport).
- No new public/static print URL exists; printing is entirely client-side over authenticated fetches.

---

## T64 — Embedded preview: authenticated reads succeed (was 401)

**Goal:** Confirm authenticated `/api/*` calls work inside the Replit embedded preview iframe via the Clerk bearer token.

**Steps:**
1. Open the app in the **embedded preview** (iframe), signed in as an approved user (`ceo@signal87.ai`).
2. Navigate to `/documents`.

**Expected:**
- The document list loads; `GET /api/documents` returns **200/304** (not 401).
- Server logs show the request authenticated; no "Could not load your documents" error inside the iframe.
- Detail, chunks, history, single-doc chat, hybrid agent, brief, admin, and the in-app PDF preview blob all load (all share the same transport).

---

## T65 — Download Original via authenticated blob

**Goal:** Downloading the original file works in the iframe (no cookie-based anchor).

**Steps:**
1. Signed in as approved, open a document that has an available original.
2. Click **Download Original** in each location: the detail action bar, the PDF viewer toolbar, and the preview-error fallback.

**Expected:**
- The file downloads; **no "Download failed" toast**.
- The request carries the bearer token; `GET /api/documents/:id/original` returns **200**.

---

## T66 — Upload via authenticated transport

**Goal:** Upload works in the iframe and preserves the 207 "extraction failed" warning UX.

**Steps:**
1. Signed in as approved, upload a valid file (PDF/DOCX/TXT/CSV/XLSX).
2. Upload a file that stores but fails text extraction (to exercise the 207 path).

**Expected:**
- Valid upload → success toast; document appears in the list.
- 207 → **warning** toast from the server `warning` message (not a generic error); document still appears.
- Server-side error → error toast sourced from `ApiError.data.error`.

---

## T67 — Security unchanged by the transport change

**Goal:** Auth/authorization gates are not weakened.

**Steps:**
1. Unauthenticated: `GET /api/documents`.
2. Signed in as a NON-approved email: load `/documents`.
3. Signed in as approved: request another user's document id directly.

**Expected:**
- Unauthenticated → **401**.
- Unapproved email → **403** (approved-email gate intact).
- Cross-user document → **404** (`owner_user_id` filtering intact).
- New uploads still stamp `owner_user_id` (unchanged backend).

---

## T58 — Spreadsheet Upload (.xlsx)

**Goal:** Verify Excel workbook upload, storage, extraction, and sheet-aware chunking.

**Steps:**
1. Navigate to `/documents`
2. Click `UPLOAD_DOCUMENT`; confirm the picker accepts `.xlsx` (and the dialog/validation copy lists Excel)
3. Upload a multi-sheet `.xlsx` (e.g. a `Sales` sheet + a `Risks` sheet, each with a header row)
4. Submit

**Expected:**
- Document card appears with an `XLSX` badge; `CHUNKS:` ≥ 1
- API response: `fileType: "xlsx"`, `extractionStatus: "success"`, `originalFileAvailable: true`, `storageProvider: "replit-object-storage"`
- `extractedTextPreview` begins `Workbook: <name> — N sheet(s): ...`

---

## T59 — Spreadsheet Preview (sheet-by-sheet readable text)

**Goal:** Verify the detail-page preview renders spreadsheets readably.

**Steps:**
1. Open the `.xlsx` from T58 → detail page → Extracted Text / Preview tab

**Expected:**
- Non-PDF text preview with a sheet-aware label
- Per sheet: `Sheet: <name> (R data rows × C columns)`, a `Columns: A=<header>, B=<header>, …` line, then `Row <n>: Col=val; Col=val` lines (1-based row numbers matching Excel; blank cells/rows skipped)

---

## T60 — Spreadsheet Single-Doc Chat (sheet/row citations)

**Goal:** Verify chatting with a spreadsheet returns grounded, sheet/row-aware citations.

**Steps:**
1. From the `.xlsx` detail page, ask a value-lookup question (e.g. "Which product had the highest sale and in which region?")

**Expected:**
- Grounded answer with `[Chunk N]` citation(s)
- Citation excerpt(s) start `Sheet: <name> | Rows a–b` followed by the `Columns:` line and matching `Row <n>:` lines
- Verification Trace present (provider/model/chunk stats/latencies)

---

## T61 — Spreadsheet Hybrid Agent

**Goal:** Verify the hybrid agent handles spreadsheet sources.

**Steps:**
1. `POST /api/agent/hybrid` with `{ query, documentIds: [<xlsx id>], mode: "auto" }` (or via the `/agents/hybrid` page)

**Expected:**
- Grounded answer with `[Source N]` citations whose excerpts carry `Sheet: <name> | Rows a–b` provenance
- `documentsUsed`, `citations`, and `trace` present

---

## T62 — Spreadsheet Executive Brief

**Goal:** Verify the executive brief works over a spreadsheet.

**Steps:**
1. `POST /api/documents/brief` with `{ documentIds: [<xlsx id>], briefType: "risk", focus: "..." }` (any single-doc brief type; `comparison` still requires ≥ 2 docs)

**Expected:**
- Structured brief with sections and ≥ 1 citation grounded in the spreadsheet's sheet/row chunks
- No regression to existing PDF/DOCX/TXT brief behavior

---

## T63 — Spreadsheet Edge Cases (.xls, empty workbook, CSV unchanged)

**Goal:** Verify secondary spreadsheet paths and that CSV is untouched.

**Steps & Expected:**
- **`.xls`:** upload a legacy `.xls` → `fileType: "xls"`, chunks > 0, same sheet/row preview + citations
- **Empty workbook:** upload an `.xlsx` with no data rows → `extractionStatus: "failed"` (empty extraction marks the doc failed; original still stored so re-index can be attempted)
- **CSV regression:** upload a `.csv` (see T05) → still parsed as plain text, behavior unchanged (no sheet/row prefixes)
- **Large workbook (optional):** a sheet with > 2000 rows → only the first 2000 indexed; a truncation note appears in the preview and a warning is logged server-side

---

## T01 — Document Upload (TXT)

**Goal:** Verify plain-text upload, storage, extraction, and chunking.

**Steps:**
1. Navigate to `/documents`
2. Click `UPLOAD_DOCUMENT`, select a `.txt` file with ≥ 200 words
3. Submit

**Expected:**
- Document card appears with `TXT` badge
- `CHUNKS:` ≥ 1
- API response includes `originalFileAvailable: true`, `storageProvider: "replit-object-storage"`, `extractionStatus: "success"`

---

## T02 — Document Upload (PDF)

**Goal:** Verify PDF text extraction.

**Steps:**
1. Upload a `.pdf` file with readable text

**Expected:**
- `PDF` badge, chunks > 0, `originalFileAvailable: true`

**Edge case — scanned PDF (no text layer):**
- Expected: 207 response, document created with `extractionStatus: "failed"`, `originalFileAvailable: true`
- File is still stored in GCS so re-index can be attempted

---

## T03 — Document Upload (DOCX)

**Expected:** `DOCX` badge, chunks > 0, `originalFileAvailable: true`

---

## T04 — Document Upload (CSV)

**Expected:** `CSV` badge, chunks > 0, `originalFileAvailable: true`

---

## T05 — Upload size limit

**Steps:** Attempt to upload a file > 20 MB
**Expected:** Request rejected before server processes it; error shown in UI

---

## T06 — Unsupported file type

**Steps:** Attempt to upload `.xlsx` or `.jpg`
**Expected:** API returns 400 "Unsupported file type"; UI shows error

---

## T07 — Original file download

**Goal:** Verify original file bytes are retrievable from GCS after upload.

**Steps:**
1. Upload a known file (note the file content)
2. Call `GET /api/documents/:id/original`

**Expected:**
- HTTP 200 with correct `Content-Type` (e.g. `text/plain` for TXT)
- `Content-Disposition: attachment; filename="<original filename>"`
- File content is byte-for-byte identical to the uploaded file

**Verify via curl:**
```bash
curl -o /tmp/retrieved.txt localhost:80/api/documents/<id>/original
diff /tmp/original.txt /tmp/retrieved.txt  # should produce no output
```

---

## T08 — Original file unavailable (pre-v2 document)

**Goal:** Verify graceful 404 for documents uploaded before durable storage was enabled.

**Steps:**
1. Find a document where `storage_key` is NULL in the DB
2. Call `GET /api/documents/:id/original`

**Expected:**
- HTTP 404 with error message explaining the file predates durable storage

---

## T09 — Re-index endpoint

**Goal:** Verify re-extraction and re-chunking from stored original file.

**Steps:**
1. Upload a document (note the chunk count)
2. Call `POST /api/documents/:id/reindex`

**Expected:**
- HTTP 200 with `extractionStatus: "success"`
- `chunkCount` matches original (same file, same chunker)
- `extractedTextPreview` is non-empty

**Verify chat history preserved:**
1. Send a chat message before reindex
2. Reindex
3. Confirm history still shows original message

---

## T10 — Re-index without stored file

**Goal:** Verify 404 when no original file is stored.

**Steps:**
1. Find a document with `storage_key: null`
2. Call `POST /api/documents/:id/reindex`

**Expected:** HTTP 404 "Original file not available"

---

## T11 — Chat: basic question answering

**Goal:** Verify full RAG pipeline — embedding, retrieval, completion, citation storage.

**Steps:**
1. Navigate to `/documents/:id/chat`
2. Type a question answerable from the document

**Expected:**
- `PROCESSING_QUERY...` indicator shown
- Response with answer text
- Raw `[Chunk N]` references in the answer are rendered as clean inline citation pills (no literal `[Chunk N]` text visible)
- **Verification Trace** section with ≥ 1 citation chip (Chunk N, doc name, relevance %)
- Clicking a chip — or its matching inline pill — expands to the source excerpt
- **Trace Detail** collapsible (renamed from "AI Audit Trail") present with PROVIDER, MODEL, ROUTE, DOCUMENT, chunks searched/retrieved, FALLBACK: NO, latency values

---

## T11b — Chat: inline citation pill parsing (frontend)

**Goal:** Verify `[Chunk N]` token parsing and pill rendering edge cases.

**Steps & expected:**
1. **Normal case** — answer contains `[Chunk 1]` → renders as a clickable pill "1"; clicking it highlights/expands source chip 1.
2. **Multiple citations** — answer contains `[Chunk 1] ... [Chunk 2]` → two distinct pills, each linked to its source.
3. **Missing citation** — answer references `[Chunk 9]` but no citation #9 exists → pill renders but maps to no source (no crash, no React key warning).
4. **Malformed token** — text like `[Chunk]` or `[Chink 1]` → left as literal text, not converted.
5. **Legacy history** — a pre-v1 message stored without citations → renders Trace Detail but no citation chips (backward compatible).

---

## T12 — Chat: citation accuracy

**Goal:** Verify `citation.chunkIndex` maps to correct DB chunk.

**Steps:**
1. Note Chunk N from a citation chip
2. Call `GET /api/documents/:id/chunks`
3. Find chunk at index `N - 1`

**Expected:** Excerpt in UI matches `chunk.content.slice(0, 300)`

---

## T13 — Chat: document isolation

**Goal:** Chat only retrieves chunks from the selected document.

**Steps:**
1. Upload Document A and Document B with distinct content
2. Ask a question in Document A whose answer only exists in B

**Expected:** "information not in document" response; no B content in answer or citations

---

## T13a — Multi-doc comparison: valid 2–5 doc compare

**Goal:** Compare 2–5 documents in one synthesized answer with grouped citations and a trace.

**Steps:**
1. Navigate to `/compare`
2. Select 2 documents that share a topic (e.g. two policies)
3. Ask one comparison question and click COMPARE

**Expected:**
- One synthesized answer that names agreements and/or differences
- Inline `[Source N]` pills in the answer
- Citations grouped under each source document heading
- Verification Trace + Trace Detail showing provider `openai`, model `gpt-4o-mini`, docs searched = N, per-document chunk counts, latencies, fallback = NO

---

## T13b — Multi-doc comparison: validation guards

**Steps (via `POST /api/documents/multi-chat`):**
1. Send 1 document id → expect 400 ("between 2 and 5")
2. Send 6 document ids → expect 400
3. Send duplicate ids that collapse to <2 distinct → expect 400 ("at least 2 distinct")
4. Send a nonexistent document id → expect 404 naming the missing id
5. Send a document with zero indexed chunks → expect 400 naming the empty document

**Expected:** Each case returns the stated status and a clear error message; no LLM call is made on validation failure.

---

## T13c — Multi-doc comparison: document isolation

**Goal:** Only the selected documents appear in citations and trace.

**Steps:**
1. Select documents A and B (exclude C)
2. Run a comparison

**Expected:** All `citations[].documentId` and `debug.documentIds` are a subset of {A, B}; document C never appears.

---

## T13d — Multi-doc comparison: single-doc chat unaffected

**Goal:** Adding multi-chat does not regress single-document chat.

**Steps:** After running a multi-doc comparison, send a normal `POST /api/documents/:id/chat` request.

**Expected:** 200 with answer + citations + `debug.route` = `POST /api/documents/:id/chat`; behavior unchanged.

---

## T13e — Executive Brief: all 5 types generate

**Goal:** Each brief type produces a structured brief with its section plan, citations, and a trace.

**Steps:**
1. Navigate to `/brief` (or via Document Detail → GENERATE_BRIEF)
2. Select 1 indexed document
3. For each brief type (Executive Summary, Risk, Diligence, Contract Review), click GENERATE_BRIEF
4. Select 2+ documents and run Comparison Brief

**Expected:**
- 200 with `title` + ordered `sections[]` matching the chosen type's section plan
- Citations grouped by document; inline `[Source N]` pills resolve to chunk excerpts when the model cites
- Trace Detail shows provider `openai`, model `gpt-4o-mini`, `BRIEF_TYPE` = chosen type, per-document chunk counts, latencies, fallback = NO

---

## T13f — Executive Brief: focus instruction

**Goal:** The optional focus instruction steers the brief.

**Steps:** Select a document, add a focus instruction (e.g. "financial exposure"), generate.

**Expected:** 200; `debug.focusProvided` = true; brief content reflects the focus.

---

## T13g — Executive Brief: validation guards

**Steps (via `POST /api/documents/brief`):**
1. Send 0 document ids → expect 400 ("between 1 and 5")
2. Send 6 document ids → expect 400
3. Send `briefType: "comparison"` with 1 document → expect 400 with the exact message: `Comparison Brief requires at least 2 documents. Select another document or choose Executive Summary instead.`
4. Send a nonexistent document id → expect 404 naming the missing id
5. Send a document with zero indexed chunks → expect 400 naming the empty document

**Expected:** Each case returns the stated status and message; no LLM call is made on validation failure. In the UI, Comparison with <2 docs disables GENERATE_BRIEF and shows the exact message.

---

## T13h — Executive Brief: document isolation & multi-chat unaffected

**Goal:** Brief uses only selected documents and does not regress chat or multi-chat.

**Steps:** Run a brief on documents {A, B}; then run a single-doc chat and a multi-chat.

**Expected:** All `citations[].documentId` and `debug.documentIds` ⊆ {A, B}; single-doc chat and multi-chat both return 200 with unchanged behavior (brief logic is duplicated, not wired into multi-chat).

---

## T14 — Chat history persistence

**Steps:**
1. Send a message in a chat session
2. Navigate away, return

**Expected:** Message + response + citations still visible

---

## T15 — Clear chat history

**Steps:** Click CLEAR on a document with messages

**Expected:**
- Empty state shown
- `GET /api/documents/:id/history` returns `[]`

---

## T16 — Delete document cascades to GCS (reliable)

**Goal:** Verify deletion removes the document from DB and GCS reliably.

**Steps:**
1. Upload a document and note its ID
2. Delete the document — expect HTTP 204
3. Try `GET /api/documents/:id/original`

**Expected:**
- DELETE returns 204
- `/original` returns 404 immediately (GCS object deleted first, then DB rows — awaited, not best-effort)
- If the GCS delete had failed, DELETE would return 500 and the DB record would remain intact for a retry (no silent orphaning)

---

## T17 — System Panel — Storage Card

**Goal:** Verify the new FILE STORAGE section in the System Panel.

**Steps:**
1. Navigate to `/admin`

**Expected:**
- FILE STORAGE card visible
- Provider: `replit-object-storage` (green)
- Bucket configured: `yes` (green)
- Original files stored: `yes` (green)
- Embeddings persisted: `no` (red — expected)
- Re-index available: `yes` (green)
- ENVIRONMENT VARIABLES now shows `DEFAULT_OBJECT_STORAGE_BUCKET_ID: set` and `PRIVATE_OBJECT_DIR: set`
- ACTIVE API ROUTES shows 13 routes including `/documents/:id/original` (GET, green) and `/documents/:id/reindex` (POST, blue)

---

## T18 — API health check

```bash
curl -s localhost:80/api/healthz
```
**Expected:** `{"status":"ok"}`

---

## T19 — System info endpoint (no secrets)

```bash
curl -s localhost:80/api/system/info
```
**Expected:**
- `env.OPENAI_API_KEY` is `"set"` — never the actual key
- `env.DATABASE_URL` is `"set"` — never the connection string
- `env.DEFAULT_OBJECT_STORAGE_BUCKET_ID` is `"set"` — never the bucket ID
- `fileStorageConfig.bucketConfigured: true`

---

## T20 — Post-restart data durability

**Goal:** Confirm all data + GCS files survive API server restart.

**Steps:**
1. Upload a document, send a chat message
2. Restart the API server workflow
3. Navigate to the document's chat page

**Expected:**
- Document listed, chat history intact
- `GET /api/documents/:id/original` still returns the file (GCS is durable)

---

## T21 — Re-index after text parameter change (future path)

**Goal:** (Currently requires code change — no UI for chunk params yet.)

To test manually today:
1. Temporarily change `chunkSizeWords` in `chunker.ts` to 100
2. Rebuild and restart API server
3. Call `POST /api/documents/:id/reindex`

**Expected:** `chunkCount` changes to reflect new chunk size; chat still works

---

## T22 — Document Detail Page — open from card

**Goal:** Verify clicking a document opens the detail page (not Analyze directly).

**Steps:**
1. Navigate to `/documents`
2. Click a document card body (icon / name / metadata area)

**Expected:** Routes to `/documents/:id` showing the detail header (name, type badge, size, upload date, chunk count) and 5 tabs. The card's `ANALYZE` quick-action button still routes to `/documents/:id/chat`.

---

## T23 — Detail header actions

**Goal:** Verify the five primary actions.

**Steps & expected:**
1. `ANALYZE_DOCUMENT` → routes to `/documents/:id/chat` (existing single-doc chat).
2. `COMPARE` → routes to `/compare?preselect=:id` with this document preselected.
3. `DOWNLOAD_ORIGINAL` → downloads the original file (disabled when `originalFileAvailable: false`).
4. `RE-INDEX` → re-runs extraction/chunking (disabled when no stored original); chunk count refreshes.
5. `DELETE` → confirm dialog; on success returns to `/documents` and the document is gone.

---

## T24 — Preview tab (PDF and non-PDF)

**Goal:** Verify the Preview tab.

**Steps:**
1. Open a PDF document with a stored original → Preview tab
2. Open a TXT/DOCX document → Preview tab

**Expected:** PDF renders inline in an embedded viewer (blob object-URL, not a forced download). Non-PDF shows a readable extracted-text preview. Both keep a working Download Original action. Documents with no stored original show `ORIGINAL_FILE_UNAVAILABLE`.

---

## T25 — Extracted Text / Citations / History / System tabs

**Goal:** Verify the remaining inspection tabs.

**Expected:**
- **Extracted Text:** full extracted text (not just the 200-char preview), copy button, chunk count, extraction-status badge, indexed timestamp.
- **Citations:** every chunk as a source block (chunk #, content, character length).
- **History:** prior chat Q/A pairs with timestamp and citations count; `NO_CHAT_HISTORY` when empty.
- **System:** document ID, original stored, storage provider, storage key, file size, file type, extraction status, extraction error (if any), chunks created, re-index available, download available.

---

## T26 — Detail page does not alter backend contracts

**Goal:** Confirm the additive `extractedText` field is read-only and list stays light.

**Steps:**
1. `GET /api/documents/:id` → `extractedText` is the full text
2. `GET /api/documents` → each item's `extractedText` is `null`

**Expected:** Single-doc GET carries full text; list payload stays light. `extractedTextPreview` (200 chars) unchanged. Single-doc chat and multi-doc comparison unaffected.

---

## T27 — In-platform PDF viewer (Preview tab)

**Goal:** Verify the real PDF viewer renders and is interactive, with graceful fallbacks.

**Setup:** Upload a normal multi-page PDF; open `/documents/:id` → Preview tab.

**Steps & expected:**
1. **Render:** the PDF renders page-by-page inside the platform (not an iframe download), showing page 1 and a `1 / N` page counter with the correct total.
2. **Navigation:** Next/Previous advance and retreat pages; Previous is disabled on page 1, Next is disabled on the last page.
3. **Zoom:** Zoom in / zoom out change the rendered size (50%–300%); the percentage indicator updates.
4. **Fit-to-width:** toggling fit-to-width scales the page to the container width (shows `FIT`); re-toggling returns to percentage zoom.
5. **Loading state:** a `LOADING_PDF` / `RENDERING_PAGE` indicator appears briefly while fetching/rendering.
6. **Error state:** if the PDF cannot be parsed/rendered, the viewer shows `FAILED_TO_RENDER_PDF` and still offers Download Original — the page does not crash.
7. **Download Original:** the toolbar Download Original button downloads the stored file.
8. **Non-PDF fallback:** a TXT/DOCX document still shows the extracted-text preview (no viewer).
9. **No original:** a PDF without a stored original shows a clear plain-language explanation ("Original PDF not stored — can't render in viewer", with re-upload guidance) and falls back to rendering the document's extracted text when available — not a bare `ORIGINAL_FILE_UNAVAILABLE` dead-end. The header Download Original / Re-Index controls remain disabled.
10. **Worker:** no pdf.js worker errors in the browser console (the worker is bundled via Vite `?url`).

**Regression sweep:** Extracted Text / Citations / History / System tabs, single-doc chat, multi-doc comparison, and upload/download/reindex all still work.

---

## T28 — Answer Rendering Polish (Markdown rendering)

**Goal:** Verify AI-generated answers render as structured Markdown, citation pills still work, and no raw `**bold**` markers are visible.

**Precondition:** At least one indexed document with ≥ 3 chunks.

### T28a — Single-document chat

1. Open `/documents/:id/chat` for any indexed document.
2. Ask a question that is likely to produce a multi-paragraph answer with bold section labels (e.g. "Summarize this document in detail with section headings").
3. **Expected:**
   - Bold text renders as **bold** (not `**bold**`).
   - Numbered or bullet lists render with proper spacing and list markers.
   - Section headings render visually distinct (slightly larger/bolder).
   - Inline `[Chunk N]` citations become clickable orange pills — not plain text.
   - Clicking a citation pill expands the corresponding CitationChip in the Verification Trace.
   - No raw Markdown syntax characters (`**`, `##`, `- `, `1. `) appear in the rendered text.

### T28b — Multi-document comparison

1. Navigate to `/compare`, select 2–3 documents, ask "Compare the risk profiles across these documents".
2. **Expected:** Same rendering requirements as T28a but for `[Source N]` citation pills.

### T28c — Executive Brief

1. Navigate to `/brief`, select 1–2 documents, generate an Executive Summary brief.
2. **Expected:**
   - Section bodies render as structured Markdown.
   - `[Source N]` tokens become clickable pills; clicking opens the citation group in the Verification Trace.
   - No raw Markdown characters in the rendered text.

### T28d — Copy Brief unchanged

1. Generate any brief and click `COPY_BRIEF`.
2. Paste into a plain-text editor.
3. **Expected:** Output is plain Markdown text (the copy path is unchanged — it reads the raw `section.body` strings, not the rendered HTML).

### T28e — Verification Trace unchanged

1. In any of T28a–T28c, expand the Verification Trace.
2. **Expected:** All trace fields (provider, model, chunk stats, latencies) still display correctly; citation cards show relevance scores.

### T28f — No backend regression

1. Run `pnpm run typecheck` — must pass with 0 errors.
2. Backend was not touched; no API contract changes needed.

---

## T13i — Copy Brief source legend

**Goal:** Verify that Copy Brief produces a self-contained, pasteable document.

**Steps:**
1. Navigate to `/brief`, select 1–2 documents, generate any brief type.
2. Click `COPY_BRIEF`.
3. Paste into a plain-text editor.

**Expected:**
- First line is `# <title>` (markdown H1).
- Each section follows as `## <heading>` then body text with inline `[Source N]` markers.
- A `## Sources` block appears at the end with one line per citation: `[Source N] <documentName> — Chunk <chunkIndex> (relevance <score>)`.
- Relevance score is present when the retrieval returned one; otherwise the score suffix is omitted.
- No dangling `[Source N]` references without a corresponding Sources entry.

---

## T13j — Risk Brief "Risk Assessment" citation honesty

**Goal:** Confirm severity/likelihood/impact ratings are labelled as assessments, not cited as directly stated by the source.

**Steps:**
1. Select 1–2 documents, choose **Risk Brief**, generate.
2. Expand the "Risk Assessment" section.

**Expected:**
- Severity/likelihood/impact ratings are prefixed "Assessed" (e.g. "Assessed severity: High").
- Any `[Source N]` citation in the Risk Assessment section supports the underlying risk described, not the rating value itself.
- The section heading reads "Risk Assessment" (not "Severity & Likelihood").

---

## T13k — Executive Summary non-overlapping sections

**Goal:** Confirm the five sections carry distinct, non-repetitive content.

**Steps:**
1. Select 1–2 documents, choose **Executive Summary**, generate.
2. Read each section in sequence.

**Expected:**
- Sections are: Overview / Key Findings / What Stands Out / Watch Items / Open Questions / Source Notes.
- Overview is 1–2 sentences of context only.
- Key Findings contains concrete source-grounded facts (not restated in other sections).
- What Stands Out / Watch Items highlights only the most material items not already listed under Key Findings.
- Open Questions lists gaps a decision-maker still needs that the sources don't answer.
- Source Notes briefly notes coverage or gaps in the selected documents.

---

## T13l — Prompt tightening — no fluff, grounded recommendations

**Goal:** Confirm generated briefs avoid evaluative marketing language and tie recommendations to cited evidence.

**Steps:**
1. Generate an Executive Summary and a Diligence Brief over the same documents.
2. Scan section bodies for adjectives such as "innovative," "powerful," "cutting-edge," "robust," "seamless."
3. Check any Recommendations content for citation markers.

**Expected:**
- No unsupported evaluative adjectives in section bodies.
- Any recommendation either cites a specific `[Source N]` finding or is absent.
- If the documents do not provide enough evidence for a section, the section states that explicitly rather than padding.

---

## T13m — Verification Trace synthesized-query note and section-name polish

**Goal:** Confirm the Trace panel explains low relevance scores and that renamed sections appear throughout all brief types.

**Steps:**
1. Generate any brief, expand **Trace Detail**.
2. Read the bottom of the Trace panel.
3. Generate a Diligence Brief → check for "Open Items" (not "Outstanding Items").
4. Generate a Comparison Brief → check for "Notes by Document" (not "Per-Document Notes").
5. Generate a Risk Brief → check for "Risk Assessment" (not "Severity & Likelihood").

**Expected:**
- Trace panel bottom shows: "Brief generation uses a synthesized retrieval seed across selected documents. Relevance scores may be lower than direct question-answer retrieval but are used to identify supporting source chunks."
- Diligence section heading reads "Open Items."
- Comparison section heading reads "Notes by Document."
- Risk section heading reads "Risk Assessment."
- Contract Review still shows "Parties & Term" unchanged.

---

## T29 — Document status labels (list + detail)

**Goal:** Verify the derived status badge reflects the document's true state.

**Steps:**
1. Open `/documents` with a mix of documents (at least one ready, one with 0 chunks / failed extraction).
2. Open a ready document's detail page, then a failed one.

**Expected:**
- Ready document (chunks > 0, `extractionStatus: "success"`, original available) → green **Ready** badge.
- 0-chunk or `extractionStatus: "failed"` document with original available → red **Extraction failed** badge.
- Failed/0-chunk document **without** original available → **Needs re-upload**.
- Ready document whose original file is missing → **Original file missing** (still answerable).
- `extractionStatus: "pending"` → **Processing**.
- Detail header shows the same badge and a "not ready" banner for non-ready states.
- No layout/redesign change to existing cards beyond the badge.

---

## T30 — Re-Index a failed / 0-chunk document from the list

**Goal:** Verify the list-level Re-Index action and cache invalidation.

**Steps:**
1. On `/documents`, find a card showing **Extraction failed** with the original available.
2. Confirm it shows a **Re-Index** button (not "Ask a Question").
3. Click **Re-Index**; wait for completion.

**Expected:**
- Button shows a per-card loading state while running (other cards unaffected).
- Toast "Re-index complete" on success.
- The card's badge + chunk count refresh without a manual reload (list, detail, and chunks queries are invalidated).
- If re-extraction still yields no text, the document stays **Extraction failed** (backend marks `extractionStatus: "failed"`).

---

## T31 — Chat blocked on a not-ready document (frontend gate + backend 422)

**Goal:** Verify a not-ready document cannot be queried and gives a clear message.

**Steps:**
1. Open the chat page for a 0-chunk / failed document.
2. Observe the input.
3. Directly call `POST /api/documents/:id/chat` for that document (e.g. via curl).

**Expected:**
- Frontend: input is **disabled** with an explanatory inline banner linking back to the document; **no API call** is made.
- Backend: the direct call returns **HTTP 422** with `{ "error": "This document has no readable text yet…" }` and **no OpenAI call** is made.
- A ready document is unaffected: input enabled, chat returns `200` with answer + citations + Verification Trace.

---

## T32 — Upload validation (client-side)

**Goal:** Verify the upload modal validates before sending and shows limits.

**Steps:**
1. Open the upload modal.
2. Attempt a file with an unsupported extension (e.g. `.zip`).
3. Attempt a supported file larger than 20 MB.
4. Upload a valid file.

**Expected:**
- Modal shows accepted types + **20 MB max**.
- Unsupported extension → clean inline error, no request sent.
- Oversize file → clean inline error, no request sent.
- Valid file uploads normally (mechanics unchanged).

---

## T33 — Server error surfaced on upload + 207 warning

**Goal:** Verify the modal reflects the server's response faithfully.

**Steps:**
1. Trigger an upload that the server rejects (e.g. unsupported type reaching the server, or storage unconfigured → 503).
2. Upload a file whose text extraction fails (scanned PDF → 207).

**Expected:**
- Server rejection → the modal surfaces the server's `{ error }` message (not a generic string).
- 207 (uploaded but extraction failed) → a **warning** toast (not a success toast); the document appears as **Extraction failed** and is re-indexable.

---

## T34 — Citation labels + no-citations note (display only)

**Goal:** Verify citation clarity changes without altering the citation payload.

**Steps:**
1. Ask a question that returns citations.
2. Inspect the inline citation markers/chips and the Verification Trace.
3. Ask a question that returns an answer with zero citations (if reproducible).

**Expected:**
- Citation markers/chips read **"Section N · {doc}"** instead of "Chunk N".
- The Verification Trace payload (`chunkIndex`, `relevanceScore`, excerpts, provider/model/latencies) is unchanged — only the display label changed.
- An answer with zero citations shows a small **"no source citations"** note.

---

## T35 — Structured backend logging (no content leakage)

**Goal:** Verify sparse structured logs exist and never log document/question/answer text.

**Steps:**
1. Tail the API server logs.
2. Perform: a successful chat, a chat on a not-ready document, a successful upload, and an extraction-failed (207) upload.

**Expected:**
- Successful chat → one `info "Q&A succeeded"` with `documentId` / `provider` / `model` / `chunksSearched` / `chunksRetrieved` / `totalLatencyMs`.
- Not-ready chat → one `warn "Q&A rejected…"` with `documentId` / `extractionStatus` / `chunkCount`.
- Upload → `info` success (with `chunkCount`); 207 → `warn` extraction-failed.
- **No log line contains the question, the answer, or file content.**

---

## T36 — Ask tab — document picker + states

**Goal:** Verify the Ask tab lets a user pick one ready document and reach the existing single-doc chat, with correct empty/guidance states. Frontend-only; no backend changes.

**Steps:**
1. Click **Ask** in the nav (`/ask`).
2. Observe the page with no document selected.
3. Open the picker and select a **ready** document, then click **Ask a Question**.
4. (Setup) Temporarily have zero documents, then have only not-ready documents, and revisit `/ask`.

**Expected:**
- Header "Ask" + explanatory subtitle; only **ready** documents appear in the picker.
- Nothing selected (ready docs exist) → shows exactly **"Select a document from Documents to ask questions."**
- Selecting a doc shows its name + status badge and an **Ask a Question** button linking to `/documents/:id/chat` (the existing chat — citations/trace behave exactly as before; no multi-doc chat).
- Zero documents → empty state with a **Go to Documents** link.
- Documents exist but none ready → guidance to re-index/re-upload in the Documents tab (no picker).

---

## T37 — Activity tab — real events only, no fabrication

**Goal:** Verify the Activity feed reflects only real, durable document data and never invents activity or leaks internals.

**Steps:**
1. Click **Activity** in the nav (`/activity`).
2. Compare the feed against the Documents list.
3. (Setup) Revisit with zero documents.

**Expected:**
- Per document: an **Upload completed** event and an outcome event — **Extraction completed** (`Indexed into N sections`), **Extraction failed**, **Needs re-upload**, or **Processing** — timestamped from `uploadedAt`, newest first.
- Outcome labels match the document's status badge (e.g. the 0-chunk PDF shows **Extraction failed**).
- **No** upload-started / Q&A-completed / deleted events (not durably recorded — not fabricated).
- No raw logs, API keys, stack traces, or developer-only errors anywhere on the page.
- Zero documents → clean **"No activity yet"** empty state.

---

## T38 — Navigation — three tabs, mobile usable, existing flow intact

**Goal:** Verify the nav shows Documents | Ask | Activity, active state is correct, mobile stays usable, and the core Documents flow is unchanged.

**Steps:**
1. On desktop and on a narrow viewport (~402px), view the nav across `/documents`, `/ask`, `/activity`, and `/documents/:id`.
2. Run the core flow: Upload → list → detail/preview → Ask a question → cited answer → delete.

**Expected:**
- Nav lists **Documents | Ask | Activity**; the current tab is highlighted; `/documents/:id` and `/documents/:id/chat` keep **Documents** active.
- Mobile nav is a horizontal, scrollable row that remains tappable; no overflow/clipping.
- The entire core Documents flow (PDF viewer, upload, single-doc chat, citations, delete, re-index) behaves exactly as before — no regressions.

---

## T58 — Public demo Q&A endpoint (no auth, grounded)

**Goal:** Verify `GET /api/demo/qa` is public, returns the `DemoQa` shape, and grounds its citation in a real indexed document when one exists.

**Steps:**
1. With **no** session cookie, run `curl localhost:80/api/demo/qa`.
2. Confirm at least one successfully-indexed document exists in the current DB.

**Expected:**
- HTTP `200` (no `401`/`403`) — the route is mounted before `requireApprovedEmail`.
- Body matches `DemoQa`: `{ question, answer, citationLabel, sourceDocument, grounded }`.
- When a ready document exists: `grounded: true`, `citationLabel` is `Demo document · Chunk N`, and `sourceDocument` is the anonymized `"Demo document"`.
- **Privacy:** the response **never** contains a real uploaded document's filename — protected document names must not leak to this unauthenticated endpoint.
- The auth gate is unaffected: `GET /api/documents` (no cookie) still returns `401`.

---

## T59 — Landing demo panel uses live content + falls back gracefully

**Goal:** Verify the landing "Document Q&A" panel animates content from the live endpoint and never breaks if the endpoint is unavailable.

**Steps:**
1. Load the landing page (`/`) and watch the "Document Q&A" demo panel cycle.
2. (Fallback) Simulate the endpoint being unavailable (e.g. stop the API server) and reload the landing page.

**Expected:**
- With the endpoint up: the panel types out the question, then the grounded answer, and shows the citation chip from the response (real document).
- With the endpoint down: the panel falls back to the hardcoded question/answer/citation — no error, no blank panel, no console crash (`retry: false`, so no retry storms).
- The animation has no timer leaks: navigating away/reloading does not accumulate runaway typing intervals.

---

## Known behaviour — not bugs

| Scenario | Expected behaviour |
|----------|-------------------|
| Document without `storage_key` | `/original` returns 404; `/reindex` returns 404 — expected for pre-v2 documents |
| Object storage not configured | Upload rejected with 503 (fail-closed) — durable storage is required |
| DB write fails after GCS save | Just-uploaded object is deleted (compensating cleanup); request returns 500 — no orphaned object |
| Upload where extraction fails | 207 response with `warning` field; document and GCS file preserved; re-index available |
| Large document with many chunks | Slower chat response — embeddings recomputed on every query |
| Pre-v1 chat messages (stored without citations) | Show AI Audit Trail but no citation chips — legacy format gracefully handled |
| Scanned PDF (no text layer) | 207 with `extractionStatus: "failed"`, `originalFileAvailable: true` |
| GCS delete fails on document delete | DELETE returns 500; DB record left intact with `storage_key` for retry — no silent orphaning |

---

## Sign-off checklist — v2

- [ ] T01 TXT upload (storageKey set, originalFileAvailable true)
- [ ] T02 PDF upload
- [ ] T03 DOCX upload
- [ ] T04 CSV upload
- [ ] T05 Size limit enforced
- [ ] T06 Unsupported type rejected
- [ ] T07 Original file download — byte-for-byte match
- [ ] T08 Pre-v2 document returns 404 on /original
- [ ] T09 Re-index works, chat history preserved
- [ ] T10 Re-index without stored file returns 404
- [ ] T11 Chat returns answer + citations (inline pills + Trace Detail)
- [ ] T11b Inline citation pill parsing edge cases
- [ ] T11c Chat on a 0-chunk doc (extraction failed) → HTTP 200, graceful "no information" answer, 0 citations, and NO server ERROR / no empty-array OpenAI call (`retrieveRelevantChunks` empty-chunks guard)
- [ ] T12 Citation maps to correct chunk
- [ ] T13 Chat scoped to selected document
- [ ] T13a Multi-doc compare returns synthesized answer + grouped citations + trace
- [ ] T13b Multi-doc validation guards (1/6/dupe/missing/empty)
- [ ] T13c Multi-doc isolation — only selected docs in citations/trace
- [ ] T13d Single-doc chat unaffected by multi-chat
- [ ] T13e Exec Brief — all 5 types generate structured sections + citations + trace
- [ ] T13f Exec Brief — focus instruction sets `focusProvided` and steers content
- [ ] T13g Exec Brief — validation guards (0/6/comparison<2 exact msg/missing/empty)
- [ ] T13h Exec Brief — isolation ⊆ selected docs; chat + multi-chat unaffected
- [ ] T13i Copy Brief includes # title heading and Sources footer with doc name, chunk #, relevance score
- [ ] T13j Risk Brief "Risk Assessment" section prefixes ratings as "Assessed"; no citation on inferred rating
- [ ] T13k Executive Summary: five distinct non-overlapping sections (Overview / Key Findings / Watch Items / Open Questions / Source Notes)
- [ ] T13l No evaluative fluff adjectives; recommendations cite a finding or are omitted
- [ ] T13m Trace synthesized-query note present; renamed sections confirmed (Risk Assessment / Open Items / Notes by Document / Parties & Term kept)
- [ ] T14 History persists across navigation
- [ ] T15 Clear history works
- [ ] T16 Delete cascades to GCS
- [ ] T17 System Panel shows storage card
- [ ] T18 Health check responds
- [ ] T19 System info hides secret values
- [ ] T20 Data survives server restart
- [ ] T21 Re-index with changed chunk params (manual test)
- [ ] T22 Document card opens detail page `/documents/:id`
- [ ] T23 Detail header actions (Analyze / Compare-preselect / Download / Re-index / Delete)
- [ ] T24 Preview tab — PDF inline viewer + non-PDF text preview
- [ ] T25 Extracted Text / Citations / History / System tabs
- [ ] T26 Additive `extractedText` read-only; list payload stays light
- [ ] T27 PDF viewer renders + page nav + zoom + fit-to-width + error/Download fallback
- [ ] T27 Non-PDF fallback, no-original state, and no pdf.js worker console errors
- [ ] T29 Status badges correct across Ready / Extraction failed / Needs re-upload / Original file missing / Processing
- [ ] T30 List-level Re-Index runs with per-card state and refreshes badge/chunks without reload
- [ ] T31 Not-ready chat: frontend input disabled (no call) + backend returns 422 with no OpenAI call
- [ ] T32 Upload validation: unsupported extension and >20 MB blocked client-side
- [ ] T33 Server `{ error }` surfaced on upload failure; 207 shows a warning toast
- [ ] T34 Citation markers read "Section N · {doc}"; no-citations note shown; Trace payload unchanged
- [ ] T35 Structured Q&A/upload logs present; no question/answer/file content logged
- [ ] T36 Ask tab: ready-only picker → existing chat; required unselected message; empty/none-ready states
- [ ] T37 Activity tab: real upload/extraction events only (no fabrication), labels match status, empty state, no internals leaked
- [ ] T38 Nav shows Documents \| Ask \| Activity; active state + mobile usable; core Documents flow unchanged
- [x] T39 Malformed-PDF stabilization smoke: failed doc inspected (malformed PDF, 0 chunks, original preserved); Q&A on failed doc → 422 (no OpenAI call); improved extraction-failed message shown and wraps in Activity; known-good PDF full lifecycle (upload 201 / extraction success / 3 chunks / preview renders / Q&A 200 + citations / delete 204); Activity accurate with no stale entries; no orphan chunks; all test docs deleted
- [ ] T40 Auth — API unauthenticated: `GET /api/documents` without session cookie → 401
- [ ] T41 Auth — API authenticated but unapproved email: `GET /api/documents` with signed-in session but email not in `APPROVED_EMAILS` → 403
- [ ] T42 Auth — API health check: `GET /api/healthz` remains public (no auth) → 200
- [ ] T43 Auth — Frontend: `/documents` redirects to `/sign-in` when not signed in
- [ ] T44 Auth — Frontend: `/brief` and `/compare` redirect to `/sign-in` when not signed in
- [ ] T45 Auth — Frontend: `/about`, `/terms`, `/privacy`, `/contact`, `/team` remain public (no redirect)
- [ ] T46 Auth — Frontend: Sign-in page shows Clerk UI with Google OAuth option
- [ ] T47 Auth — Frontend: After sign-in, user is redirected to `/documents`
- [ ] T48 Auth — Frontend: UserButton shows in sidebar when signed in; clicking opens account popover
- [ ] T49 Auth — Frontend: Landing page CTA shows "Sign In" when not signed in, "Open App" when signed in
- [ ] T50 Auth — Backend: `CLERK_BYPASS_AUTH=true` allows all requests through (emergency override)
- [ ] T58 Public demo Q&A: `GET /api/demo/qa` → 200 (no auth), `DemoQa` shape, grounded citation from a real doc; `GET /api/documents` still 401
- [ ] T59 Landing demo panel: animates live grounded Q&A; falls back to hardcoded copy if endpoint down (no crash, no retry storms, no timer leaks)
- [ ] T69 Landing trust section: on `/` (public), "Trusted AI, grounded in your documents." section renders below the hero and above "How it works." with three cards (Grounded Responses / Verification Trace / Model Transparency), correct icons, and no console errors
- [ ] T71 Upload drag & drop: dragging files over the dashed drop zone shows the active hover state ("Drop files to add them"); dropping one or more queues each as its own row exactly like picking; Upload sends each via `POST /api/documents/upload`
- [ ] T71a Drag & drop validation/de-dupe: dropped files run the same de-dupe + per-file validation (unsupported/>20 MB flagged + skipped, valid ones queue); the in-zone "browse" link still opens the native picker; dropped + picked files can be mixed
- [ ] T71b Drag & drop edge cases: drops ignored while an upload is in progress; hover state clears on dragleave/drop with no flicker on nested drag
- [x] T77 Compare/Brief differentiation — visual: `/compare` renders a violet-accented banner header (icon tile + left rail + "Side-by-side analysis" eyebrow), a "Documents to compare" card, and A/B/C slot badges on selected docs; `/brief` renders a blue "letterhead" header ("Brief Generator" eyebrow, no tile/banner), a "Source documents" card, and the unique Brief type selector. The two pages are clearly distinguishable at a glance (different accent color AND header treatment); no console errors
- [x] T79 Consolidate Ask nav — "/ask" nav item removed from sidebar; nav reads Documents | AI Chat | Brief | Compare | Activity; navigating to /ask redirects to /agents/hybrid; no "Ask" button removed from document cards or detail pages (those still point to /documents/:id/chat); no console errors
- [ ] T80 /ask redirect — visiting /ask directly redirects to /agents/hybrid; the old Ask page is no longer accessible
- [ ] T78 Compare/Brief differentiation — functionality preserved: document toggle + max-5 guard, Compare submit → grouped citations + Verification Trace + Trace Detail, Brief type validation (comparison needs ≥2) + Copy Brief + citations/trace all still work; A/B/C slot badge exposes `aria-label`; the violet accent is scoped to `/compare` only (nav/sidebar and `/brief` keep the default blue)
