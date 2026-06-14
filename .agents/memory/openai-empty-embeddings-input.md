---
name: OpenAI embeddings reject empty input arrays
description: Any retrieval/embedding path over a possibly-empty set must short-circuit before calling OpenAI embeddings.
---

OpenAI's `embeddings.create({ input })` returns `400 Invalid 'input': input cannot be an empty array` when `input` is `[]`. A document whose extraction failed has 0 chunks, so any code that maps chunks → `input` will hit this.

**Rule:** every retrieval function must guard `if (chunks.length === 0) return []` (or the per-group equivalent) BEFORE calling embeddings. The multi-doc path already did this per-group; the single-doc path did not, which produced a logged server ERROR (and a wasted API call) whenever someone queried a 0-chunk document — even though the chat route caught it and still returned a graceful HTTP 200 "no information" answer.

**Why:** 0-chunk documents are a normal state (malformed/scanned/unextractable uploads are stored with `extractionStatus: failed`), so this path is reachable in production, not just a test edge case.

**How to apply:** when adding any new LLM/retrieval feature (briefs, comparisons, new chat surfaces), confirm the chunk set can be empty and short-circuit before embedding. Don't rely on the caller's try/catch to mask it — that still logs an ERROR and burns an API round-trip.
