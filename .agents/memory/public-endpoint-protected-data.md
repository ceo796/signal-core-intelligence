---
name: Public endpoints must not leak protected-store metadata
description: Any unauthenticated route that reads from an otherwise-protected data store must anonymize identifying fields, not just gate writes.
---

# Public endpoints serving from a protected store

When an unauthenticated (public) endpoint reads from a data store whose normal
access is gated behind auth, returning *real* identifying metadata from that
store is a disclosure bug — even if the endpoint is read-only and the values
feel innocuous.

**Concrete case:** a public landing-page demo endpoint grounded a citation in
the most-recent uploaded document and returned the real `fileName`. Uploads are
auth-protected, and filenames routinely contain client / deal / employee names.
That leaked document existence + names to any anonymous visitor.

**Why:** "public route" + "reads protected table" is the trap. Auth gating the
write/upload path does not make the *contents* (including names/metadata) public.

**How to apply:**
- For a public endpoint, select only non-identifying fields from a protected
  table (e.g. a chunk *ordinal*, a count) — ideally don't even fetch the
  sensitive column, so it can't accidentally end up in a response or log.
- Return anonymized labels (e.g. `Demo document · Chunk N`) instead of real
  names. You can still keep a `grounded: true`-style flag to signal the value is
  backed by real data without exposing the identity.
- Prefer an explicit allowlist / "demo-safe" flag if you must surface a real
  record publicly.
