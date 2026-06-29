# Signal87 Render Migration Notes

> **Canonical guide:** see [DEPLOYMENT.md](../DEPLOYMENT.md).
>
> **Preferred: single-origin Node deployment.**
>
> **Avoid split static/API deployment unless there is a specific reason.**
>
> **If split deployment is used, `VITE_API_BASE_URL` must be set correctly.**

## Deprecated: `signal87-web` static service

The two-service Render layout (`signal87-web` + `signal87-api`) is retired. Static Render sites cannot proxy `/api/*` to the API service, which forced cross-origin wiring and brittle env configuration. Use one Node service (`signal87` in `render.yaml`) instead.

## Current target architecture

One Node service serves:

- React SPA from `artifacts/signal87-core/dist/public`
- Express API at `/api/*` from `artifacts/api-server/dist/app.mjs`

Entry point: `production-server.mjs` (also used by the root `Dockerfile`).

## Migrating from split static + API services

If you previously ran separate `signal87-web` (static) and `signal87-api` (Node) services:

1. **Consolidate to one Render web service** using `render.yaml`.
2. **Remove `VITE_API_BASE_URL`** from production environment — it is no longer needed.
3. **Point your custom domain** at the unified service (not the old static site).
4. **Retire the static-only service** after the unified service passes smoke tests.
5. Keep the persistent disk on the unified service for `FILE_STORAGE_DIR`.

## Why the split setup was fragile

The static Render service rewrote all routes to `/index.html` and did **not** proxy `/api/*` to the API service. That forced:

- Cross-origin API calls via `VITE_API_BASE_URL`
- Extra CORS and Clerk cookie configuration
- Two deploy pipelines and duplicated environment management

Same-origin deployment eliminates these issues.

## Verification

```bash
pnpm smoke:production https://your-production-domain.example
```