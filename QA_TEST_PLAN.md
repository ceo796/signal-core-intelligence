# Signal87 Core — QA Test Plan

> Checkpoint: **Signal87_Core_Durable_Storage_v1**
> Last updated: 2026-06-14
> Type: Manual end-to-end test plan

---

## Environment setup

1. Confirm both workflows are running (API server + frontend web)
2. Confirm `GET /api/healthz` returns `{"status":"ok"}`
3. Confirm `GET /api/system/info` shows `OPENAI_API_KEY: "set"` and `DATABASE_URL: "set"`

---

## T01 — Document Upload (TXT)

**Goal:** Verify plain-text upload, extraction, and chunking work end-to-end.

**Steps:**
1. Navigate to `/documents`
2. Click `UPLOAD_DOCUMENT`
3. Select a `.txt` file containing at least 200 words
4. Submit

**Expected:**
- Upload modal closes
- Document card appears in the list with correct filename
- `CHUNKS:` shows ≥ 1
- `UPLOADED:` timestamp is recent

**Cleanup:** Leave document for T04.

---

## T02 — Document Upload (PDF)

**Goal:** Verify PDF text extraction (uses patched `pdf-parse`).

**Steps:**
1. Upload a `.pdf` file with readable text

**Expected:**
- Document card appears with `PDF` badge
- `CHUNKS:` > 0
- No server error in the API logs

**Edge case — scanned PDF (no text layer):**
- Expected: API returns 422 "No text could be extracted from the file"
- UI shows an error toast

---

## T03 — Document Upload (DOCX)

**Goal:** Verify DOCX extraction via `mammoth`.

**Steps:**
1. Upload a `.docx` file

**Expected:**
- Document card appears with `DOCX` badge
- Chunks > 0

---

## T04 — Document Upload (CSV)

**Goal:** Verify CSV handled as plain text.

**Steps:**
1. Upload a `.csv` file

**Expected:**
- Document card appears with `CSV` badge
- Chunks > 0 (one chunk per 500-word window; small CSVs may yield 1 chunk)

---

## T05 — Upload size limit

**Goal:** Verify 20 MB cap is enforced.

**Steps:**
1. Attempt to upload a file larger than 20 MB

**Expected:**
- Request rejected before the server processes it
- Error shown to the user (toast or modal)

---

## T06 — Unsupported file type

**Goal:** Verify unsupported types are rejected.

**Steps:**
1. Attempt to upload a `.xlsx` or `.jpg` file

**Expected:**
- API returns 400 "Unsupported file type"
- Error shown in UI

---

## T07 — Chat: basic question answering

**Goal:** Verify full RAG pipeline — embedding, retrieval, completion, citation storage.

**Pre-condition:** At least one document is uploaded with ≥ 1 chunk.

**Steps:**
1. Navigate to `/documents/:id/chat`
2. Type a question that can be answered from the document
3. Submit

**Expected:**
- Typing indicator shows `PROCESSING_QUERY...`
- Response appears with answer text
- **Verification Trace** section appears below the answer with ≥ 1 citation chip
- Each chip shows: `Chunk N`, document filename, relevance % (0–100)
- Clicking a chip expands to show the source excerpt
- **AI Audit Trail** collapsible is present
- Expanding it shows: PROVIDER (`openai`), MODEL (`gpt-4o-mini`), ROUTE, FALLBACK (`NO`), CHUNKS_SEARCHED, CHUNKS_RETRIEVED, latency values

---

## T08 — Chat: citation accuracy

**Goal:** Verify citation `chunkIndex` maps to real chunk content.

**Steps:**
1. After a chat response, note the `Chunk N` number from a citation chip
2. Call `GET /api/documents/:id/chunks` and find chunk at `chunkIndex = N - 1`
3. Compare the expanded excerpt in the UI against the DB chunk content

**Expected:**
- Excerpt in UI matches `chunk.content.slice(0, 300)` from the DB

---

## T09 — Chat: search scope (document isolation)

**Goal:** Confirm chat only retrieves chunks from the selected document.

**Pre-condition:** At least 2 different documents are uploaded.

**Steps:**
1. Upload Document A and Document B with clearly distinct content
2. Open chat for Document A
3. Ask a question whose answer only exists in Document B

**Expected:**
- Model answers "the information is not in the provided document" (or similar)
- Citation chips only reference chunks from Document A
- No content from Document B appears in the answer

---

## T10 — Chat history persistence

**Goal:** Verify history survives page navigation and server restart.

**Steps:**
1. Send a question in a document chat session
2. Navigate away to `/documents`
3. Return to the same document's chat page

**Expected:**
- User message and assistant response are still visible
- Citation chips and AI Audit Trail are present on the historical message
- (Note: pre-checkpoint messages stored without citations will show the audit trail but no citation chips — this is expected for the legacy format)

---

## T11 — Chat history clear

**Goal:** Verify `CLEAR` button wipes history.

**Steps:**
1. On a document chat page with ≥ 1 message, click `CLEAR`
2. Confirm the confirmation toast appears
3. Check the page

**Expected:**
- Chat area shows `SYSTEM_READY` empty state
- `GET /api/documents/:id/history` returns `[]`

---

## T12 — Document delete

**Goal:** Verify document + its chunks and messages are removed.

**Steps:**
1. On the Documents page, click the delete icon for a document
2. Confirm deletion

**Expected:**
- Document card disappears
- `GET /api/documents/:id` returns 404
- `GET /api/documents/:id/chunks` returns 404 or empty
- `GET /api/documents/:id/history` returns empty

---

## T13 — System Panel (Admin)

**Goal:** Verify `/admin` page shows accurate live backend info.

**Steps:**
1. Navigate to `/admin`

**Expected:**
- DOCUMENTS / CHUNKS / MESSAGES counters match actual data
- FORMAT_BREAKDOWN bar chart shows correct file type distribution
- BACKEND RUNTIME section shows:
  - Framework: `Express 5`
  - Node.js version starts with `v24`
  - Environment badge: `development`
  - File Storage: `none (memory only)`
  - Chunk Size: `500 words`
  - Chunk Overlap: `50 words`
- AI CONFIGURATION section shows:
  - Provider: `OpenAI`
  - Chat Model: `gpt-4o-mini`
  - Embedding Model: `text-embedding-3-small`
  - Max Tokens: `2048`
- DATABASE section shows:
  - Type: `PostgreSQL`
  - ORM: `Drizzle ORM`
  - Tables: `documents, chunks, chat_messages`
- ENVIRONMENT VARIABLES: `DATABASE_URL`, `OPENAI_API_KEY`, `PORT` all show green `set`
- ACTIVE API ROUTES: all 11 routes listed, colour-coded by method

---

## T14 — API health check

**Goal:** Verify health endpoint is reachable.

```bash
curl -s localhost:80/api/healthz
```

**Expected:** `{"status":"ok"}`

---

## T15 — System info endpoint (no secrets)

**Goal:** Verify `/api/system/info` exposes no secret values.

```bash
curl -s localhost:80/api/system/info
```

**Expected:**
- `env.OPENAI_API_KEY` is `"set"` or `"missing"` — never the actual key value
- `env.DATABASE_URL` is `"set"` or `"missing"` — never the connection string
- Response contains `framework`, `routes[]`, `database`, `ai`, `chunkConfig`

---

## T16 — Re-index capability (manual / future)

**Goal:** Document current behaviour and limitation.

**Current state:** No re-indexing endpoint exists.

**What is possible today:**
1. `DELETE /api/documents/:id` — removes document, chunks, and history
2. Re-upload the original file — triggers fresh extraction, chunking, and chunk insert

**What would be required for in-place re-indexing:**
- `DELETE FROM chunks WHERE document_id = $id`
- Read `documents.extracted_text`
- Call `chunkText()` with new parameters
- Insert new chunks
- (Optionally persist new embeddings)

---

## T17 — Post-restart data durability

**Goal:** Confirm data survives API server restart (PostgreSQL durability).

**Steps:**
1. Upload a document and send at least one chat message
2. Restart the API server workflow
3. Navigate to `/documents` and then to the document's chat page

**Expected:**
- Document is still listed
- Chat history is intact with citations

---

## Known failure modes (by design, not bugs)

| Scenario | Expected behaviour |
|----------|-------------------|
| Upload a file, try to re-download the original | Not possible — file binary not stored |
| Large document with many chunks — slow chat response | Expected: embeddings recomputed on every query; latency grows linearly with chunk count |
| Pre-v1 chat messages (stored without citations) | Show AI Audit Trail but no citation chips — legacy format gracefully handled |
| Scanned PDF with no text layer | 422 error "No text could be extracted" |

---

## Sign-off checklist

- [ ] T01 TXT upload
- [ ] T02 PDF upload
- [ ] T03 DOCX upload
- [ ] T04 CSV upload
- [ ] T05 Size limit enforced
- [ ] T06 Unsupported type rejected
- [ ] T07 Chat returns answer + citations
- [ ] T08 Citation maps to correct chunk
- [ ] T09 Chat scoped to selected document only
- [ ] T10 History persists across navigation
- [ ] T11 Clear history works
- [ ] T12 Delete document cascades
- [ ] T13 System Panel accurate
- [ ] T14 Health check responds
- [ ] T15 System info hides secret values
- [ ] T16 Re-index limitation documented
- [ ] T17 Data survives server restart
