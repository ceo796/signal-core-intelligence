# Signal87 Core — QA Test Plan

> Checkpoint: **Signal87_Core_Answer_Rendering_Polish_v1**
> Last updated: 2026-06-14
> Type: Manual end-to-end test plan
> Note: Answer Rendering Polish (T28) is a frontend-only change — shared `MarkdownAnswer` component replaces `whitespace-pre-wrap` plain text in all three answer surfaces; no API, retrieval, or citation payload changes. The Executive Brief generator (T13e–T13h) adds one additive route (`POST /api/documents/brief`) + a new `/brief` page; it duplicates the multi-chat retrieval/citation pattern and does not modify multi-chat. T13i–T13m cover the quality polish pass (prompt tightening, Copy Brief footer, Risk Assessment honesty, Exec Summary de-duplication, Trace note + section renames) — frontend + prompt-only changes, no API contract or retrieval changes. The PDF viewer (T27) is frontend-only. The detail page (T22–T26) is frontend + one additive read-only backend field; all other backend tests (T01–T10, T16–T21) are unchanged.

---

## Environment setup

1. Confirm both workflows are running (API server + frontend web)
2. Confirm `GET /api/healthz` returns `{"status":"ok"}`
3. Confirm `GET /api/system/info` shows:
   - `OPENAI_API_KEY: "set"`
   - `DATABASE_URL: "set"`
   - `DEFAULT_OBJECT_STORAGE_BUCKET_ID: "set"`
   - `PRIVATE_OBJECT_DIR: "set"`
   - `fileStorageConfig.bucketConfigured: true`
   - `fileStorageConfig.originalFilesStored: true`

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
9. **No original:** a PDF without a stored original shows `ORIGINAL_FILE_UNAVAILABLE`.
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
