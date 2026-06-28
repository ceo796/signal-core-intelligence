---
name: signal87-app-theme
description: LOCKED Signal87 logged-in app dark dashboard theme. Use when editing UI in the authenticated app, restyling pages, or any task that might touch colors, layout chrome, or CSS tokens. Triggers: theme, dark mode, colors, palette, signal-app, dashboard style, reskin, rebrand, index.css tokens.
---

# Signal87 App Theme (LOCKED)

The logged-in Signal87 platform uses a **locked dark dashboard palette**. Treat it as immutable unless the user **explicitly** asks to change the app theme.

## Canonical source of truth

| Asset | Role |
|-------|------|
| `artifacts/signal87-core/src/index.css` | `.signal-app` CSS variables + component classes |
| `artifacts/signal87-core/theme/signal87-app-theme.lock.json` | Fingerprints verified by `pnpm run verify:theme` |
| `artifacts/signal87-core/THEME_LOCK.md` | Human-readable lock policy |

## Locked palette (do not drift)

- Panel: `#1b1b1a` (`--s87-panel`)
- Ink: `#f4f4f2` (`--s87-ink`)
- Primary accent: `#bdf58a` green (`--s87-green`, `--primary: 92 82% 75%`)
- Rose brand: `#f6a0d7` (`--s87-rose`)
- On-accent text: `#111110` (`--s87-on-accent`)

## Rules

1. **Never** revert `.signal-app` to the old light Notion/indigo theme (`#4F3FF0`, white backgrounds).
2. **Never** move app tokens from `.signal-app` into `:root` or `.dark` — landing/public pages stay isolated.
3. **Never** edit `pages/home.tsx` `.s87-landing` styles as part of an app theme task.
4. Use semantic Tailwind tokens (`bg-background`, `text-foreground`, `bg-card`, `text-primary`) inside the app — they inherit from `.signal-app`.
5. For dashboard-specific inline styles, use `dashboardColors` from `documents-dashboard-ui.tsx` (reads `--s87-*` vars).
6. PDF pages stay **paper-white** (`--s87-paper`) inside viewers; chrome around them stays dark.

## When the user explicitly requests a theme change

1. Update `.signal-app` in `index.css`.
2. Update fingerprints in `theme/signal87-app-theme.lock.json`.
3. Run `pnpm run verify:theme` and `pnpm run build`.
4. Update `THEME_LOCK.md` with the new lock date and summary.

## Verification

```bash
pnpm run verify:theme
```

This runs as part of `pnpm run build`. Do not remove it.