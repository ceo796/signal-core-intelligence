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
