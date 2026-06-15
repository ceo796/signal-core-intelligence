---
name: Document readiness invariant
description: A document is "ready to answer" only if it has chunks AND extraction succeeded — checking chunk count alone is not enough.
---

A Signal87 document is answerable only when it has **indexed chunks AND `extractionStatus === "success"`**. Checking `chunkCount > 0` alone is insufficient.

**Why:** Re-index reuses the originally stored bytes and rebuilds chunks, but the "no text extracted" path marks `extractionStatus = "failed"` **without deleting the previously indexed chunks**. So a document that was once Ready and later fails re-index keeps stale chunks in the DB. A guard that only checks chunk count would let chat answer that document from stale context while the UI calls it "Extraction failed" — an inconsistency.

**How to apply:** Any "is this doc usable?" gate must treat `extractionStatus === "failed"` as not-ready in addition to the 0-chunk check. This applies on both sides and must stay in sync:
- Backend: the chat not-ready guard rejects with `422` before any OpenAI call when `chunks.length === 0 || extractionStatus === "failed"`.
- Frontend: `getDocumentStatus()` derives readiness from the same two signals.
- Any new doc-selection feature (multi-chat, brief, future bulk ops) should reuse this same readiness rule rather than re-deriving "has chunks" on its own.
