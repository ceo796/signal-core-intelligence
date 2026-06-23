# Render migration notes

This repository is now prepared to run production outside Replit.

## Services

The `render.yaml` blueprint defines two services:

1. `signal87-api` — Node/Express API service
2. `signal87-web` — static Vite frontend service

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
VITE_CLERK_PUBLISHABLE_KEY=<Clerk publishable key>
```

The frontend API URL should point to the deployed `signal87-api` service URL.

## Storage

Production uploads now use local durable storage under `/var/data/uploads`, backed by a Render persistent disk. This removes the production runtime dependency on Replit Object Storage.

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

OpenAI remains the only AI provider in the current backend provider file. Do not add Replit AI, Gemini, Vertex, Anthropic, OpenRouter, or managed gateway fallbacks without a separate architecture decision.
