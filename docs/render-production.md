# Signal87 Render Production Runbook

Signal87 production stays on Render, Clerk auth, and Neon/Postgres. Do not add MongoDB or switch the production entrypoint away from `railway-server.mjs` unless a separate deployment change explicitly requires it.

## Required Render environment variables

Set these on the Render web service before deploying:

| Variable | Required value / notes |
| --- | --- |
| `DATABASE_URL` | Neon Postgres connection string. Keep this secret. |
| `OPENAI_API_KEY` | OpenAI API key used by AI/chat/analyze features. |
| `CLERK_SECRET_KEY` | Clerk backend secret key. Keep this secret. |
| `CLERK_PUBLISHABLE_KEY` | Clerk publishable key for the backend Clerk middleware/runtime injection. |
| `VITE_CLERK_PUBLISHABLE_KEY` | Clerk publishable key available to the browser build. |
| `APPROVED_EMAILS` | Comma-separated allowlist of approved user email addresses. |
| `FILE_STORAGE_DIR` | Persistent Render Disk path for uploaded originals, for example `/var/data/uploads`. |
| `STORAGE_PROVIDER` | Use `local` on Render with a persistent disk mounted at `FILE_STORAGE_DIR`. |
| `NODE_ENV` | `production`. |

Never commit `.env` files, API keys, database URLs, Clerk secrets, or credentials.

## Domain and DNS

1. In Render, add the custom domain `signal87.ai` to the production web service.
2. In DNS, point `signal87.ai` to Render using Render's current custom-domain instructions.
3. Wait for Render to show the domain certificate as issued and the domain as verified.
4. Confirm `https://signal87.ai/` and `https://signal87.ai/sign-in` both serve the SPA.

## Deploy

1. Confirm the Render service build command uses `pnpm install --frozen-lockfile && pnpm build` or the equivalent project setting.
2. Confirm the start command runs the combined SPA/API entrypoint: `node railway-server.mjs`.
3. Confirm a persistent Render Disk is mounted at `FILE_STORAGE_DIR`.
4. Deploy the selected Git branch from Render.
5. After deploy, run the smoke test below.

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
