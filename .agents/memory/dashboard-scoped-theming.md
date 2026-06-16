---
name: Page-scoped theming & dark mode (Signal87 frontend)
description: How to add a per-page theme/dark-mode or custom font without breaking other pages in this Tailwind v4 app.
---

# Page-scoped theming & dark mode

When a single page (e.g. the dashboard) needs its own palette, dark mode, or font, scope everything to a wrapper class (the dashboard uses `.s87` + `.s87.s87-dark`). Do NOT reach for global mechanisms.

**Why:** other pages in this app are not dark-mode-safe. Several pages (upgrade, checkout) hardcode a light look, and most pages consume the global theme tokens (`--background`, `--primary`, `--app-font-sans`, etc.). Anything global leaks into all of them.

**How to apply:**
- Dark mode: toggle a wrapper-local class (e.g. `s87-dark` on the page's root div), never the global `.dark` class. The global `.dark` rule would also flip the hardcoded-light pages.
- Custom font for one page: set `font-family` inside the wrapper class (`.s87 { font-family: ... }`); descendants inherit it. Do NOT edit the global `--app-font-sans` — `body` uses it, so changing it restyles every page. Keep the `@font-face`/Google Fonts `<link>` global (harmless), only the application scoped.
- Specificity/cascade: custom selectors written outside any `@layer` (these `.s87` blocks sit before `@layer base`) are *unlayered*, so they beat Tailwind's layered utilities (e.g. `font-sans`). A compound selector like `.s87.s87-dark` reliably overrides `.s87`.
- CSS variables defined on the wrapper inherit into `position: fixed` descendants (e.g. a mobile drawer) as long as they remain DOM descendants of the wrapper.

**Mobile full-screen drawer gotcha:** a `fixed inset-0 z-50` overlay paints over the page's own top bar, so any close/hamburger control left in that top bar becomes unreachable. The overlay must render its own header with a close (X) button inside it.
