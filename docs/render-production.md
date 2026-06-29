# Signal87 Render Production Runbook

Signal87 production runs outside Replit and Railway on Render, Clerk auth, OpenAI, and Postgres. The checked-in `render.yaml` uses two services: a Node API service and a static frontend service. Do not add Replit runtime dependencies, Railway entry points, or Replit object storage for new uploads.

The root `Dockerfile` is a neutral production fallback for an existing Render Docker service. It is not a Railway deployment path.

## Required Render environment variables

Set these on `signal87-api` before deploying:

| Variable | Required value / notes |
| --- | --- |
| `DATABASE_URL` | Neon Postgres connection string. Keep this secret. |
| `OPENAI_API_KEY` | OpenAI API key — GPT fallback for chat/analyze when Gemini is unavailable. |
| `GEMINI_SERVICE_ACCOUNT_JSON` | Full Google Cloud service account JSON (one line) for Gemini via **Vertex AI** — bills against linked GCP credits. Set in Render dashboard only; never commit. |
| `GEMINI_SERVICE_ACCOUNT_PATH` | Local/dev only: path to service account JSON file (e.g. `./.local/gemini-service-account.json`). |
| `GEMINI_VERTEX_LOCATION` | Vertex region for Gemini OpenAPI endpoint (default `us-central1`). |
| `XAI_API_KEY` | xAI/Grok API key — final LLM fallback. |
| `AI_PRIMARY_REASONING_PROVIDER` | `google` (Gemini primary). |
| `AI_FALLBACK_PROVIDER_ORDER` | `openai` (GPT first fallback). |
| `AI_FINAL_FALLBACK_PROVIDER` | `xai` (Grok last fallback). |
| `CLERK_SECRET_KEY` | Clerk backend secret key. Use `sk_live_...` in production, never `sk_test_...`. Keep this secret. |
| `CLERK_PUBLISHABLE_KEY` | Clerk publishable key for the backend Clerk middleware/runtime injection. Use `pk_live_...` in production. |
| `ADMIN_EMAILS` | Comma-separated admin emails with full complimentary access. Set to `ceo@signal87.ai,mbenezra@erezcapital.io`. |
| `APPROVED_EMAILS` | Optional legacy allowlist (admins are preferred). |
| `STRIPE_SECRET_KEY` | Stripe secret key (`sk_live_...` in production). Enables checkout + webhooks. |
| `STRIPE_PRICE_ID` | Recurring Stripe Price ID (`price_...`) for Signal87 Pro. |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signing secret (`whsec_...`) for `POST /api/billing/webhook`. |
| `STRIPE_TRIAL_DAYS` | Free trial length in days (default `14`). |
| `APP_BASE_URL` | Public API base URL, e.g. `https://signal87-api.onrender.com`. |
| `STRIPE_SUCCESS_URL` | Post-checkout redirect, e.g. `https://www.signal87.ai/documents?billing=success`. |
| `STRIPE_CANCEL_URL` | Checkout cancel redirect, e.g. `https://www.signal87.ai/pricing?billing=cancelled`. |
| `STRIPE_PORTAL_RETURN_URL` | Billing portal return URL, e.g. `https://www.signal87.ai/settings`. |
| `FILE_STORAGE_DIR` | Persistent Render Disk path for uploaded originals, for example `/var/data/uploads`. |
| `STORAGE_PROVIDER` | Use `local` on Render with a persistent disk mounted at `FILE_STORAGE_DIR`. |
| `NODE_ENV` | `production`. |

Set these on `signal87-web` before deploying:

| Variable | Required value / notes |
| --- | --- |
| `VITE_API_BASE_URL` | Deployed API URL, for example `https://signal87-api.onrender.com`. |
| `VITE_CLERK_PUBLISHABLE_KEY` | Clerk publishable key available to the browser build. Use `pk_live_...` in production. |
| `BASE_PATH` | `/` unless serving the app from a subpath. |

Never commit `.env` files, API keys, database URLs, Clerk secrets, or credentials.

## Domain and DNS

1. In Render, add `signal87.ai` and `www.signal87.ai` to the `signal87-web` static service.
2. Keep the API on `signal87-api.onrender.com` or add a separate API domain such as `api.signal87.ai` to the `signal87-api` service.
3. In DNS, point each domain to the matching Render service using Render's current custom-domain instructions.
4. Wait for Render to show each domain certificate as issued and the domain as verified.
5. Confirm `https://signal87.ai/` and `https://www.signal87.ai/sign-in` serve the SPA. If either response includes `x-powered-by: Express`, that domain is attached to the API service instead of the web service.

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
pnpm smoke:production https://www.signal87.ai https://signal87-api.onrender.com
```

You can also provide the URLs with environment variables:

```bash
SMOKE_WEB_BASE_URL=https://www.signal87.ai SMOKE_API_BASE_URL=https://signal87-api.onrender.com pnpm smoke:production
```

The script verifies:

- `/` returns 200.
- `/sign-in` returns 200.
- `/api/healthz` returns 200 JSON from the API base URL.
- `/api/runtime-check` returns 200 JSON from the API base URL, reports `status: "ok"`, and does not expose secret values.
- Unauthenticated `/api/documents` returns 401 from the API base URL.

If a smoke check fails, do not consider the deploy healthy.

## Stripe billing setup

1. In [Stripe Dashboard](https://dashboard.stripe.com), create a **Product** (Signal87 Pro) with a **recurring monthly Price**.
2. Copy the Price ID (`price_...`) into Render as `STRIPE_PRICE_ID`.
3. Copy the Stripe **Secret key** into Render as `STRIPE_SECRET_KEY`.
4. Add a webhook endpoint:
   - URL: `https://signal87-api.onrender.com/api/billing/webhook`
   - Events: `checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`
5. Copy the webhook signing secret into Render as `STRIPE_WEBHOOK_SECRET`.
6. Set `ADMIN_EMAILS=ceo@signal87.ai,mbenezra@erezcapital.io` on `signal87-api`.
7. Redeploy `signal87-api`, then verify locally or on Render:

```bash
node scripts/verify-billing-setup.mjs https://signal87-api.onrender.com
```

New users sign up → `/pricing` → **Start 14-day free trial** → Stripe Checkout → webhook marks account `trialing` → full app access. Subscription renews after trial unless canceled in the billing portal.

## Rollback

1. In Render, open the production service deploy history.
2. Select the last known-good deploy and use Render's rollback/redeploy action.
3. Re-run `pnpm smoke:production https://www.signal87.ai https://signal87-api.onrender.com`.
4. If rollback does not recover the service, verify DNS status, Render service logs, Neon availability, and the required environment variables above.
