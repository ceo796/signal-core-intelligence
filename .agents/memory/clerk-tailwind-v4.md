---
name: Clerk Tailwind v4 setup
description: Required CSS and Vite config changes to make @clerk/themes work correctly with Tailwind v4 in dev and prod.
---

## The rule

1. In `index.css`, add `@layer theme, base, clerk, components, utilities;` as the FIRST line — before `@import "tailwindcss"`. Then add `@import "@clerk/themes/shadcn.css"` immediately after `@import "tailwindcss"`.

2. In `vite.config.ts`, change `tailwindcss()` to `tailwindcss({ optimize: false })`.

**Why:** Tailwind v4's lightningcss optimization reorders nested `@layer` imports from `@clerk/themes/*.css`, so the Clerk UI renders correctly in dev but broken in prod. The `optimize: false` flag disables that reordering. The explicit `@layer` declaration tells Tailwind the correct layer order before any imports resolve.

**How to apply:** Any time Clerk Auth is added to a Tailwind v4 + `@tailwindcss/vite` project. Both changes are required — skipping either one produces the subtle dev-works / prod-broken failure mode.
