# Signal87 Deployment

Signal87 is designed for **single-origin production**: one Node process serves the React frontend and all `/api/*` routes on the same domain.

## Recommended architecture

```text
Browser  →  https://your-domain.example/
              ├── /              React SPA (static files from signal87-core build)
              ├── /sign-in       SPA routes (fallback to index.html)
              └── /api/*         Express API (@workspace/api-server)
```

**Entry point:** `production-server.mjs`

This file imports the bundled Express app (`artifacts/api-server/dist/app.mjs`), mounts static file serving for `artifacts/signal87-core/dist/public`, and listens on `PORT`.

Equivalent paths:

- **Docker:** root `Dockerfile` → `CMD node production-server.mjs`
- **Render:** `render.yaml` → one `web` service, same build + start commands
- **Local production smoke:** `pnpm build:production && pnpm start`

## Why one service (not split frontend + API)

A split static-site + API deployment (for example, a static host that only rewrites `/*` to `index.html` without proxying `/api/*`) causes:

- **CORS complexity** — cross-origin fetches need permissive headers and preflight handling.
- **Clerk cookie/session issues** — auth cookies and proxy paths work best on one origin.
- **Duplicate hosting** — two services, two deploy pipelines, two health checks.
- **`VITE_API_BASE_URL` confusion** — the frontend must be rebuilt with the API hostname baked in at build time; rotating API URLs requires a frontend redeploy.

Single-origin deployment avoids all of this: the generated API client calls relative paths like `/api/healthz` and `/api/documents` on the same host.

## API client routing

The React app configures the API client in `artifacts/signal87-core/src/App.tsx`:

```ts
setBaseUrl(import.meta.env.VITE_API_BASE_URL?.trim() || null);
```

When `VITE_API_BASE_URL` is **unset or blank** (recommended for production), requests use same-origin relative `/api/*` paths.

Set `VITE_API_BASE_URL` only as an **optional escape hatch** for:

- Local dev with the Vite dev server on a different port (usually handled by Vite's `/api` proxy instead).
- Future mobile or external clients that must call a remote API host.
- API-only deployments without the SPA.

**Do not set `VITE_API_BASE_URL` in normal same-origin production.**

## Required environment variables

See `.env.example` for the full key list (names only — never commit live values).

Minimum for production:

| Variable | Purpose |
| --- | --- |
| `NODE_ENV` | `production` |
| `PORT` | Injected by the host (e.g. Render sets this automatically) |
| `DATABASE_URL` | Postgres connection string |
| `CLERK_SECRET_KEY` | Clerk backend secret (`sk_live_...` in production) |
| `CLERK_PUBLISHABLE_KEY` | Clerk publishable key for server middleware |
| `VITE_CLERK_PUBLISHABLE_KEY` | Injected at runtime into HTML by `production-server.mjs` (or set for build) |
| `APPROVED_EMAILS` | Comma-separated signup allowlist |
| `FILE_STORAGE_DIR` | Persistent upload directory (e.g. `/var/data/uploads` with a mounted disk) |
| `STORAGE_PROVIDER` | `local` with a persistent volume |
| `XAI_API_KEY` | Grok/xAI fallback LLM |
| `GEMINI_SERVICE_ACCOUNT_JSON` or `GEMINI_SERVICE_ACCOUNT_PATH` | Gemini/Vertex primary LLM |
| `GEMINI_PROJECT_ID` | Google Cloud project for Vertex |
| `GEMINI_LOCATION` | Vertex region (e.g. `global`) |

Optional but common: Stripe billing keys, `ADMIN_EMAILS`, `FRONTEND_URL` for checkout redirects, `LOG_LEVEL`.

Runtime AI chain: **Google/Gemini → xAI/Grok → local extractive fallback**. OpenAI is not required.

## Health checks

| Path | Use |
| --- | --- |
| `/api/healthz` | Simple liveness probe (always `200` when the process is up) — use for platform health checks |
| `/api/health` | Readiness: database, storage, AI router — no secret values exposed |
| `/api/runtime-check` | Extended diagnostics for operators |

Platform health checks should target `/api/healthz` so transient dependency issues do not flap the service.

## Persistent storage

Mount a disk at `/var/data` (or your host's equivalent) and set:

```text
FILE_STORAGE_DIR=/var/data/uploads
STORAGE_PROVIDER=local
```

## Deploy flow

```text
code change → GitHub main → host pulls branch → build API + frontend → start production-server.mjs
```

After deploy, verify:

```bash
pnpm smoke:production https://your-production-domain.example
```

With same-origin hosting, one URL is enough — API checks run against the same base.

## Provider-neutral notes

- Do not hardcode host-specific URLs in application code.
- `STATIC_DIR` overrides the default frontend build path if needed.
- `RENDER` and similar variables are injected by the platform; do not set them manually.