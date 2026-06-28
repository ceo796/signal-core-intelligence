# Signal87 App Theme — LOCKED

**Status:** LOCKED as of 2026-06-28  
**Owner directive:** Do not change the logged-in app visual theme unless explicitly instructed.

## What is locked

The dark Documents dashboard palette applied **site-wide** to every authenticated page:

- Charcoal panel (`#1b1b1a`) with warm ink (`#f4f4f2`)
- Green primary accent (`#bdf58a`) with dark on-accent text (`#111110`)
- Rose brand accent (`#f6a0d7`), gold warnings (`#ffd699`)
- Dark sidebar, cards, dialogs, and PDF viewer chrome

## Canonical files

| File | Purpose |
|------|---------|
| `src/index.css` | `.signal-app` token block — **single source of truth** |
| `src/components/layout.tsx` | Applies `signal-app` class to app shell |
| `src/components/documents-dashboard-ui.tsx` | `dashboardColors` reads `--s87-*` vars |
| `theme/signal87-app-theme.lock.json` | Machine-verified fingerprints |
| `scripts/verify-signal87-theme.mjs` | Build gate — fails if theme drifts |

## What stays independent (not locked together)

- **Landing page** (`src/pages/home.tsx`, `.s87-landing`) — separate dark marketing theme
- **Public pages** (`src/components/public-layout.tsx`) — light `:root` tokens
- **Auth shell** (`src/App.tsx` AuthShell) — separate sign-in aesthetic

## Enforcement

```bash
pnpm run verify:theme   # standalone check
pnpm run build          # includes verify:theme
```

## Changing the theme (only with explicit user directive)

1. Edit `.signal-app` in `src/index.css`
2. Update `theme/signal87-app-theme.lock.json` fingerprints
3. Run `pnpm run verify:theme && pnpm run build`
4. Update this file with the new lock date