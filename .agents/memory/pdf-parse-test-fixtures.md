---
name: pdf-parse 1.1.1 strict xref / test PDF fixtures
description: How to produce a known-good test PDF that pdf-parse@1.1.1 (old pdf.js) will actually parse.
---

`pdf-parse@1.1.1` (the version the api-server pins) uses an old pdf.js whose classic cross-reference-table parser is strict. A hand-rolled minimal PDF will fail with `FormatError: bad XRef entry` **even when every xref byte offset is correct** (verified: offsets resolved exactly to each `N 0 obj`, startxref pointed at `xref`, entries were exactly 20 bytes — still rejected).

**Why:** old pdf.js rejects classic-xref PDFs that aren't produced by a real generator; reproducing a byte-perfect acceptable table by hand is not worth it.

**How to apply:** to get a guaranteed-good text PDF for a live upload/extraction test, do NOT hand-craft one. Instead download an existing real, already-extracted PDF from `GET /api/documents/:id/original`, then re-upload it as a fresh test doc (new id + storage key, original untouched), run the lifecycle, and delete the test doc. No pdfkit/pdf-lib/python is installed by default.

Same `bad XRef entry` is also the signature of a genuinely malformed/truncated upload (e.g. a tiny byte stub) — extraction correctly fails, marks `extraction_status=failed`, stores 0 chunks, keeps the original, returns 207; Q&A then returns 422. That is expected behavior, not a bug.
