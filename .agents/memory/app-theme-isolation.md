---
name: App vs landing theme isolation
description: How the logged-in app theme is kept separate from the public landing/marketing pages.
---

# App vs landing theme isolation

The logged-in app and the public marketing pages are themed by two **independent** systems. Keep them separate.

- **Logged-in app shell:** `components/layout.tsx` puts the global `dark` class on its root div. That activates the `.dark` token block in `index.css` (shadcn/Tailwind CSS variables) for every authenticated page. To restyle the app theme, edit the `.dark` block and/or the app pages — this is safe and does NOT touch the landing.
- **Public landing page:** `pages/home.tsx` renders inside a fully scoped `.s87-landing` CSS namespace with its **own** CSS variables (`--bg`, `--ink`, `--green`, etc.) injected as a `<style>` string. It never applies the global `.dark` class, so `.dark` token edits cannot reach it.
- **Other public pages** (about/team/contact/privacy/terms) use `components/public-layout.tsx` on the light `:root` tokens.

**Why:** the user has a permanent rule — never modify the public landing page unless explicitly told. App theme experiments must be isolated.

**How to apply:** for any app re-theme, confine changes to the `.dark` block + app pages/components (`layout.tsx`, `dashboard.tsx`, `documents.tsx`, etc.). After changes, confirm `git diff --name-only` shows no `home.tsx` / `public-layout.tsx` / marketing-page edits. Note the dark sidebar needs the **white** `public/signal87-logo.png`; `signal87-logo-black.svg` (fill `#0A1428`) is for light backgrounds only.
