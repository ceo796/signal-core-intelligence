# Signal87 Render Production Runbook

Signal87 production runs outside Replit on Render, Clerk auth, OpenAI, and Postgres. The checked-in `render.yaml` uses two services: a Node API service and a static frontend service. Do not add Replit runtime dependencies or Replit object storage for new uploads.

## Required Render environment variables

Set these on `signal87-api` before deploying:

| Variable | Required value / notes |
| --- | --- |
| `DATABASE_URL` | Neon Postgres connection string. Keep this secret. |
| `OPENAI_API_KEY` | OpenAI API key used by AI/chat/analyze features. |
| `CLERK_SECRET_KEY` | Clerk backend secret key. Keep this secret. |
| `CLERK_PUBLISHABLE_KEY` | Clerk publishable key for the backend Clerk middleware/runtime injection. |
| `APPROVED_EMAILS` | Comma-separated allowlist of approved user email addresses. |
| `FILE_STORAGE_DIR` | Persistent Render Disk path for uploaded originals, for example `/var/data/uploads`. |
| `STORAGE_PROVIDER` | Use `local` on Render with a persistent disk mounted at `FILE_STORAGE_DIR`. |
| `NODE_ENV` | `production`. |

Set these on `signal87-web` before deploying:

| Variable | Required value / notes |
| --- | --- |
| `VITE_API_BASE_URL` | Deployed API URL, for example `https://signal87-api.onrender.com`. |
| `VITE_CLERK_PUBLISHABLE_KEY` | Clerk publishable key available to the browser build. |
| `BASE_PATH` | `/` unless serving the app from a subpath. |

Never commit `.env` files, API keys, database URLs, Clerk secrets, or credentials.

## Domain and DNS

1. In Render, add the custom domain `signal87.ai` to the production web service.
2. In DNS, point `signal87.ai` to Render using Render's current custom-domain instructions.
3. Wait for Render to show the domain certificate as issued and the domain as verified.
4. Confirm `https://signal87.ai/` and `https://signal87.ai/sign-in` both serve the SPA.

## Deploy

1. Confirm `render.yaml` has two services: `signal87-api` and `signal87-web`.
2. Confirm `signal87-api` has a persistent Render Disk mounted at `/var/data`.
3. Confirm `FILE_STORAGE_DIR=/var/data/uploads` and `STORAGE_PROVIDER=local` on `signal87-api`.
4. Confirm `VITE_API_BASE_URL` on `signal87-web` points to the deployed API service.
5. Deploy the selected Git branch from Render.
6. When database schema changes are included, push the Drizzle schema against production Postgres:

```bash
DATABASE_URL="<production-postgres-url>" pnpm --filter @workspace/db push
```

7. After deploy, run the smoke test below.

## Smoke test

Run from a machine with network access after every production deploy:

```bash
pnpm smoke:production https://signal87.ai
```

The script verifies:

- `/` returns 200.
- `/sign-in` returns 200.
- `/api/healthz` returns 200 JSON.
- `/api/runtime-check` returns 200 JSON without secret values.
- Unauthenticated `/api/documents` returns 401.

If a smoke check fails, do not consider the deploy healthy.

## Rollback

1. In Render, open the production service deploy history.
2. Select the last known-good deploy and use Render's rollback/redeploy action.
3. Re-run `pnpm smoke:production https://signal87.ai`.
4. If rollback does not recover the service, verify DNS status, Render service logs, Neon availability, and the required environment variables above.
