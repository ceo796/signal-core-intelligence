# Render migration notes

This repository is prepared to run production outside Replit.

## Services

The `render.yaml` blueprint defines two services:

1. `signal87-api` — Node/Express API service from `@workspace/api-server`
2. `signal87-web` — static Vite frontend service from `@workspace/signal87-core`

The frontend is intentionally pointed at the real Signal87 app package, not the mockup sandbox.

## Required Render environment variables

Set these on `signal87-api`:

```text
NODE_ENV=production
STORAGE_PROVIDER=local
FILE_STORAGE_DIR=/var/data/uploads
DATABASE_URL=<Render Postgres or direct Neon URL>
OPENAI_API_KEY=<OpenAI API key>
CLERK_SECRET_KEY=<Clerk secret key>
CLERK_PUBLISHABLE_KEY=<Clerk publishable key>
```

Set these on `signal87-web`:

```text
BASE_PATH=/
PORT=3000
VITE_API_BASE_URL=<deployed signal87-api service URL, e.g. https://signal87-api.onrender.com>
VITE_CLERK_PUBLISHABLE_KEY=<Clerk publishable key>
```

`VITE_API_BASE_URL` is required because Render static sites and Render API services run on separate domains. The frontend now reads this value and configures the generated API client at startup.

## Render build details

API service:

```text
Build Command: corepack enable && pnpm install --frozen-lockfile && pnpm --filter @workspace/api-server run build
Start Command: pnpm --filter @workspace/api-server run start
Health Check Path: /api/healthz
```

Frontend service:

```text
Build Command: corepack enable && pnpm install --frozen-lockfile && PORT=3000 BASE_PATH=/ pnpm --filter @workspace/signal87-core run build
Publish Directory: artifacts/signal87-core/dist/public
```

## Storage

Production uploads use local durable storage under `/var/data/uploads`, backed by a Render persistent disk attached to `signal87-api`. This removes the production runtime dependency on Replit Object Storage for new uploads.

Existing documents whose `storageKey` points to Replit Object Storage will not be retrievable from Render until those files are migrated from Replit storage into the new Render disk or another external object store.

## Runtime checks

After deployment, verify:

```text
GET /api/healthz
GET /api/runtime-check
```

`/api/runtime-check` should show:

```json
{
  "host": "render",
  "ai": {
    "provider": "openai",
    "billing": "direct_openai_api_key"
  },
  "storage": {
    "provider": "local",
    "configured": true,
    "productionSafe": true
  },
  "replitDependency": false
}
```

## Important

OpenAI remains the only AI provider in the backend provider file. Do not add Replit AI, Gemini, Vertex, Anthropic, OpenRouter, or managed gateway fallbacks without a separate architecture decision.
