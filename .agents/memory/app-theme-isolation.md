---
name: App vs landing theme isolation
description: How the logged-in app theme is kept separate from the public landing/marketing pages.
---

# App vs landing theme isolation

The logged-in app and the public marketing pages are themed by two **independent** systems. Keep them separate.

## Logged-in app (LOCKED dark dashboard)

- **Shell:** `components/layout.tsx` applies `signal-app` on its root div.
- **Tokens:** `.signal-app` block in `artifacts/signal87-core/src/index.css` — charcoal panel `#1b1b1a`, ink `#f4f4f2`, green primary `#bdf58a`.
- **Lock:** `theme/signal87-app-theme.lock.json` + `pnpm run verify:theme` (runs in `pnpm run build`).
- **Agent skill:** `.agents/skills/signal87-app-theme/SKILL.md` — do not change theme without explicit user directive.
- **Do NOT** edit this theme for routine UI tasks; use semantic tokens (`bg-background`, `text-primary`, etc.).

## Public landing page

- `pages/home.tsx` uses scoped `.s87-landing` CSS with its own variables.
- Never receives `signal-app`. Permanent rule: do not modify landing unless explicitly told.

## Other public pages

- `components/public-layout.tsx` uses light `:root` tokens.

## Logo

- Dark app sidebar: `public/signal87-logo.png` with `brightness-0 invert` in layout.
- Light backgrounds: `signal87-logo-black.svg` (fill `#0A1428`).

## After app UI changes

Confirm `git diff --name-only` shows no unintended `home.tsx` / `public-layout.tsx` edits unless the task explicitly targets marketing pages.