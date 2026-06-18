---
name: Ownership-model exceptions
description: Routes that deliberately bypass per-user document ownership scoping in Signal87 — do not "fix" them as leaks.
---

Signal87 enforces per-user document ownership (`documents.owner_user_id`) on every document read/write. Three routes are **deliberately exempt** and must not be treated as ownership bugs:

- `GET /api/demo/qa` — **public**, unauthenticated landing-page demo. Reads the global indexed corpus but returns only an *anonymized chunk ordinal* (`Chunk N`, `grounded` flag) — never a filename, content, or document id. There is no signed-in user to scope to; owner-scoping it would break the public demo or require auth.
- `GET /api/admin/stats`, `GET /api/system/info` — aggregate counts / route inventory only, no per-document content or access.

**Why:** these were outside the enumerated scope of the ownership pass, and none leaks per-document content or existence. Recorded so a future agent doesn't mistake them for missing owner filters and "fix" them, regressing a public feature or admin dashboard.

**How to apply:** if asked to lock down or audit document access, treat these three as intentional. Scope `admin/stats` / `system/info` per-user only if per-user dashboards are explicitly requested; change `demo/qa` data sourcing only via its dedicated demo-panel follow-up.
