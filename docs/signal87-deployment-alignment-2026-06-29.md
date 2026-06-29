# Signal87 Deployment Alignment

Date: 2026-06-29

## Source of truth

GitHub is the source of truth for Signal87 code. Render is the production host.

Active repo:

```text
Husky87/signal-core-intelligence
```

Standard production flow:

```text
coding terminal -> GitHub main branch -> Render production deploy
```

## Rules

1. All coding agents must work from `Husky87/signal-core-intelligence`.
2. All agents must pull the latest `main` before changes.
3. Changes should be committed and pushed to GitHub.
4. Render should deploy from the same repo and branch.
5. Do not maintain separate production code in Replit, Railway, Lovable, or a local-only terminal.
6. Runtime settings belong in Render, not in source code.
7. The repo may document required setting names, but must not contain live credential values.
8. Add or update a non-sensitive `.env.example` after auditing the exact names the code reads.
9. Add a production-safe health endpoint that confirms database, storage, and AI-router readiness without revealing values.

## AI routing

Production should resolve to:

```text
Google/Gemini -> xAI/Grok -> local fallback
```

OpenAI should not be required for runtime document analysis.

## Build-terminal prompt

```text
Use only the repository Husky87/signal-core-intelligence. Pull latest main first. Treat GitHub as the source of truth and Render as the production host. Audit the active runtime setting names and create or update a non-sensitive .env.example. Confirm the AI router uses Google/Gemini first, xAI/Grok second, and local fallback third. Confirm OpenAI is not required at runtime. Add or update a production-safe health endpoint for database, storage, and AI-router readiness. Do not commit live credentials. Commit changes back to GitHub so Render deploys from the same source.
```

## Acceptance criteria

1. Render production service is linked to `Husky87/signal-core-intelligence`.
2. Render production service deploys from `main` unless intentionally changed.
3. Grok or any coding terminal is working from the same repo and branch.
4. Runtime settings are stored in Render.
5. No live credential values are committed to GitHub.
6. Health check reports production readiness.
