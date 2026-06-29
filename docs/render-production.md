# Signal87 Render Production Runbook

> **Canonical guide:** see [DEPLOYMENT.md](../DEPLOYMENT.md) for architecture, environment variables, and same-origin deployment.

Signal87 production on Render uses **one Node web service** (`signal87` in `render.yaml`) that serves both the React SPA and `/api/*` via `production-server.mjs`.

## Render service setup

1. Link the Render service to `Husky87/signal-core-intelligence` on branch `main`.
2. Use the checked-in `render.yaml` (single `web` service) or mirror its build/start commands manually.
3. Confirm the persistent disk is mounted at `/var/data` and that `render.yaml` sets `STORAGE_PROVIDER=local` and `FILE_STORAGE_DIR=/var/data/uploads` (uploads fail closed without both).
4. Set required secrets in the Render dashboard — see `.env.example` and `DEPLOYMENT.md`.
5. **Do not set `VITE_API_BASE_URL`** on the unified service; the SPA calls same-origin `/api/*`.

## Domain and DNS

Attach your custom domain (e.g. `signal87.ai`, `www.signal87.ai`) to the **single** Node service. Both the SPA and API are served from that domain.

## Deploy

```bash
# After schema changes:
DATABASE_URL="<production-postgres-url>" pnpm --filter @workspace/db push
```

Trigger deploy from Render (or push to `main` if auto-deploy is enabled).

## Smoke test

```bash
pnpm smoke:production https://www.signal87.ai
```

One URL is sufficient for same-origin hosting. Pass a second URL only when testing a legacy split-origin setup.

## Rollback

Use Render deploy history to redeploy the last known-good revision, then re-run the smoke test.