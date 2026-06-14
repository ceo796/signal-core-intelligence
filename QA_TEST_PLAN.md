# Signal87 Core — QA Test Plan

> Checkpoint: **Signal87_Core_Durable_File_Storage_v2**
> Last updated: 2026-06-14
> Type: Manual end-to-end test plan

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
- **Verification Trace** section with ≥ 1 citation chip (Chunk N, doc name, relevance %)
- Clicking chip expands to source excerpt
- **AI Audit Trail** collapsible present with PROVIDER, MODEL, ROUTE, FALLBACK: NO, latency values

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

## T16 — Delete document cascades to GCS

**Goal:** Verify deletion removes document from DB and GCS.

**Steps:**
1. Upload a document and note its ID and storage key
2. Delete the document
3. Try `GET /api/documents/:id/original`

**Expected:**
- 404 on document fetch
- GCS object deleted (best-effort — may take a moment)

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

## Known behaviour — not bugs

| Scenario | Expected behaviour |
|----------|-------------------|
| Document without `storage_key` | `/original` returns 404; `/reindex` returns 404 — expected for pre-v2 documents |
| Upload where extraction fails | 207 response with `warning` field; document and GCS file preserved; re-index available |
| Large document with many chunks | Slower chat response — embeddings recomputed on every query |
| Pre-v1 chat messages (stored without citations) | Show AI Audit Trail but no citation chips — legacy format gracefully handled |
| Scanned PDF (no text layer) | 207 with `extractionStatus: "failed"`, `originalFileAvailable: true` |
| GCS delete fails on document delete | Non-fatal — logged server-side, 204 still returned |

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
- [ ] T11 Chat returns answer + citations
- [ ] T12 Citation maps to correct chunk
- [ ] T13 Chat scoped to selected document
- [ ] T14 History persists across navigation
- [ ] T15 Clear history works
- [ ] T16 Delete cascades to GCS
- [ ] T17 System Panel shows storage card
- [ ] T18 Health check responds
- [ ] T19 System info hides secret values
- [ ] T20 Data survives server restart
- [ ] T21 Re-index with changed chunk params (manual test)
