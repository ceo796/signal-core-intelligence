---
name: Deployed-app (production) verification
description: How to reliably verify the deployed Signal87 app — prod has its own DB, and live-URL screenshots can be stale.
---

# Verifying the deployed app

## Production has its own database, separate from dev
The published deployment uses a different Postgres database than the dev environment — different document ids and contents. A test doc uploaded to prod lives only in the prod DB and must be deleted there. Do not assume dev doc ids/contents match prod.
**How to apply:** for a prod smoke test, treat the live `/api/documents` on the production URL (`getDeploymentInfo().primaryUrl`) as authoritative state; use the `database` skill with `environment:"production"` for read-only prod DB checks.

## external_url screenshots of the deployed app can be stale/cached
Screenshots of the live `*.replit.app` URL are served through a caching screenshot service and can show a stale or mixed-build state (e.g. an old theme on some routes, a deleted doc still visible) while other routes look current.
**Why:** observed two routes rendering an old light theme plus a long-deleted test doc, while the live JSON API and the served asset hashes both showed the current dark-theme build.
**How to apply:** confirm which build is live by curling the prod `index.html` and matching its referenced hashed assets (e.g. `assets/index-*.js`/`.css`) against the freshly built `dist/public/assets`; verify data state via the live JSON API, never from screenshots.

## Autoscale cold-start emits transient healthcheck 500s
On a fresh deploy/scale-from-zero, the platform health probe logs a few `healthcheck /api returned status 500` lines for ~3s until the Node process binds its port and logs `Server listening`; healthz then returns 200. These are internal startup probes (not user-facing) — not an app error.

## Publish migrates prod SCHEMA but never prod DATA
A dev-side data backfill (e.g. stamping `owner_user_id` on legacy rows) does NOT propagate to prod — prod has its own DB and Publish only syncs schema (column adds), not row data. After deploying any code that depends on a backfill, the same backfill must be re-run against prod separately, or legacy rows stay in the un-backfilled state (e.g. NULL owner → invisible to every user under owner-scoped queries).
**How to apply:** when verifying a per-row migration in prod, query the prod replica for the un-migrated state (`WHERE <col> IS NULL`) — do not assume the dev backfill count carries over.

## Clean up legacy NULL-owner prod rows BEFORE publishing owner-scoping
Once owner-scoped mutations ship, a row with `owner_user_id IS NULL` matches no user, so the app's delete/reindex endpoints 404 for everyone — the row becomes undeletable through the UI and strands its object-storage file. The agent cannot write to prod (separate DB; prod executeSql is a read-only replica), so the only clean removal is the user deleting via the *still-running old build* (delete gated by approved-email only, and the delete handler also removes the storage object + chunks). Raw SQL `DELETE FROM documents` is messier: it orphans the object-storage file and is blocked by the `chunks.document_id` FK unless chunks are deleted first (`chat_messages.document_id` has no FK, so those just orphan harmlessly).
**How to apply:** sequence = (1) user deletes legacy ownerless rows via the live app first, (2) then Publish the owner-scoping code. Do not publish first.

## A public route OLDER than your change is a canary for "is my latest build actually live in prod"
To tell whether prod is running the latest committed code without an authenticated session, pick a route whose public/unauth behavior changed in a commit that PREDATES your feature, and curl it on the prod URL. Example: `/api/demo/qa` became public at an earlier commit than the ownership work; prod returning 401 (the `requireApprovedEmail` body `"Unauthorized. Please sign in."`) while dev returns 200 proves the live build predates both. Schema can be ahead of code (column present) while the serving build is stale — behavior, not the DB column, tells you what code is live.
