# Signal87 — Design QA Report
> **Audit date:** 2026-06-17 · **Auditor:** Design QA pass (pre-production)
> **Scope:** Full frontend — landing, auth flows, app pages, responsive, motion, accessibility
> **Status:** AUDIT ONLY — no code changes have been made

---

## Executive Summary

Signal87 has a polished visual language and strong typography on the landing page. The core app UI is clean and enterprise-appropriate. However, **three separate design systems** have accumulated across the product — the landing page (custom CSS, DM Sans), the app shell (shadcn/ui + Tailwind tokens), and the Dashboard (a third bespoke CSS variable system). This split causes visible inconsistencies: two different sidebars, two different navigation structures, hardcoded semantic colors that will break in dark mode, and uneven spacing and typography across pages.

The most damaging issues are architectural (three design systems, two sidebars, upgrade page with no layout wrapper) and semantic-color misuse (hardcoded `violet-*`, `green-*`, `blue-*`, `slate-*` outside the token system). These should be resolved first. The remaining issues are medium-to-low cosmetic polish that can be addressed incrementally.

**No backend, API, auth, routing, chat, upload, brief, or database changes are recommended. All proposed fixes are frontend-only.**

---

## Priority Ranking

| # | Finding | Priority |
|---|---------|----------|
| 1 | Three separate design systems — landing, app, dashboard each own separate token/variable scopes | **Critical** |
| 2 | Two completely different sidebars and navigation structures | **Critical** |
| 3 | Upgrade page breaks the authenticated layout (no Layout wrapper, no sidebar) | **Critical** |
| 4 | Hardcoded semantic colors (`violet-*`, `green-*`, `blue-*`, `slate-*`) outside token system — breaks dark mode | **Critical** |
| 5 | `fileTypeIcon` / `fileTypeColor` logic duplicated across 4+ files | **High** |
| 6 | Canvas animations on landing have no `prefers-reduced-motion` pause for rAF loops (CSS is handled, rAF is not) | **High** |
| 7 | Hero footnote uses `opacity: 0` + CSS animation — renders permanently invisible when `prefers-reduced-motion: reduce` kills animations | **High** |
| 8 | Header typography inconsistent across pages (text-2xl/font-bold vs text-xl/font-semibold) | **High** |
| 9 | Empty-state border radius inconsistent (`rounded-xl` vs `rounded-lg` vs `rounded-md`) | **High** |
| 10 | Documents card "preview" is always static text — never actual document content | **High** |
| 11 | Search and Filter on Documents page are purely decorative (no handler) | **High** |
| 12 | Chat placeholder text no longer matches hybrid behavior | **Medium** |
| 13 | Dashboard "soon" items show no visual indicator (tooltip, badge, lock icon) | **Medium** |
| 14 | Activity events have no link to the associated document | **Medium** |
| 15 | Vertical emoji icons on landing (⚖ ◈ ◎ ⬡) render inconsistently cross-platform | **Medium** |
| 16 | Activity event timestamp format (`yyyy-MM-dd HH:mm`) is developer-style, not user-friendly | **Medium** |
| 17 | Document card action button overrides secondary with inline primary-tinted styles | **Medium** |
| 18 | `ModeBadge` text (10px) may be below minimum accessible font size | **Medium** |
| 19 | Canvas animation has no visibility-change pause (runs in background tabs) | **Low** |
| 20 | Landing footer is sparse — only 3 links | **Low** |
| 21 | No skip-to-content link for keyboard navigation | **Low** |
| 22 | Missing `aria-label` on several icon-only buttons | **Low** |
| 23 | Activity `Loader2` icon has `animate-spin` applied but should stop when not processing | **Low** |

---

## Page-by-Page Findings

---

### 1. Landing Page (`/`)

**Route:** `src/pages/landing.tsx` + `src/styles/landing.css`

#### Issues

**[Critical] Third design system**
The landing page lives entirely inside `.signal87-landing` with its own `--sl-*` CSS variables, DM Sans font, and bespoke button classes (`.sl-btn-primary`, `.sl-btn-large`, `.sl-btn-ghost`, `.sl-btn-outline`). None of these tokens or classes are shared with the app's Tailwind/shadcn token system. This means any brand update (primary color, border radius, button style) must be applied in two completely separate places.

**[High] Canvas animation ignores `prefers-reduced-motion` for rAF loops**
`landing.css` line 618–625 correctly kills CSS animations and transitions under `prefers-reduced-motion: reduce`. However, `HeroCanvas` and `MiniCanvas` both use `requestAnimationFrame` directly. The rAF loop is never paused for users who have requested reduced motion — the scan-line and wave animations keep running.

**[High] Hero footnote permanently invisible under `prefers-reduced-motion`**
`.sl-hero-footnote` sets `opacity: 0` with an `animation: sl-fadeUp 1s 1.2s forwards`. When `prefers-reduced-motion: reduce` kills all animations, `animation-duration` is forced to `0.01ms`, but the element's `opacity` stays at `0`. Users with reduced-motion never see the "Trusted by legal, finance, and compliance teams" footnote.

**[Medium] Vertical section emoji icons render inconsistently**
The verticals section (`src/pages/landing.tsx` lines 427–458) uses Unicode characters (⚖, ◈, ◎, ⬡) rendered as plain text inside `.sl-vertical-icon`. These render differently across operating systems and browsers — on Windows they may show as colored emoji, on Linux as outlines. Replacing with small inline SVGs would match the feature section's icon treatment.

**[Low] Background tab canvas performance**
`HeroCanvas` and `MiniCanvas` never pause their rAF loops when the tab is hidden. On a long-open landing page tab, this continuously burns CPU. Add a `document.addEventListener('visibilitychange', ...)` guard to cancel and restart rAF.

**[Low] Footer sparseness**
`sl-footer` has only Privacy / Terms / Contact. At minimum, About and Team links (which exist as routes) should be included. Compare to the landing nav which includes Platform / Solutions / Contact.

**Screenshot reference:** Desktop `/` — clean hero layout; mobile `/` (390px) — CTAs stack correctly, hero footnote visible only before scroll.

---

### 2. Sign-in / Sign-up (Clerk-rendered)

**Route:** `/sign-in`, `/sign-up` via Clerk embed

No direct code to audit. Clerk renders its own dark card modal (`bg: #111`) with orange CTA buttons. This is visual-only and cannot be changed without Clerk theme overrides. The Clerk dark card on a light-grey background (`hsl(0 0% 98%)`) is acceptable. No critical issues.

**Minor:** The Clerk "Development mode" banner at the bottom will not appear in production.

---

### 3. Dashboard (`/dashboard`)

**Route:** `src/pages/dashboard.tsx`

#### Issues

**[Critical] Third design system**
The Dashboard is a standalone page that does not use `Layout.tsx`. It has its own `Sidebar` and `MobileNav` components, its own `--s87-*` CSS variable system (defined in a CSS block not visible in this audit but referenced throughout), and a `ThemeToggle` component that adds a dark mode only scoped to the dashboard. This creates:
- A sidebar that is 208px wide with `w-[18px]` icons and an `h-7` logo
- A different sidebar in `layout.tsx` that is 224px wide with `w-4 h-4` icons and an `h-9` logo
- Users navigating from Dashboard → Documents see the sidebar visually shift in width and icon size

**[Critical] Two navigation structures**
Dashboard sidebar: Home | Documents | Collections (soon) | Briefs | Agents (soon) | Workflows (soon) | Settings (soon)
App sidebar (Layout.tsx): Documents | Ask | Compare | Brief | Activity

These are completely different. A user on the dashboard cannot navigate to Ask, Compare, or Activity without going through Documents. Features that exist (Compare, Ask, Activity) are absent from the Dashboard nav.

**[Medium] "Soon" items lack visual affordance**
Coming-soon items (Collections, Agents, Workflows, Settings) just render as greyed-out with `cursor-not-allowed` but have no "Coming soon" badge, lock icon, or tooltip. Users may be confused whether these are broken or intentionally disabled.

**[Medium] Duplicate `fileTypeIcon` / `fileTypeColor` logic**
`dashboard.tsx` lines 37–52 define `fileTypeIcon` and `fileGlyphColor`. These are nearly identical to the same functions in `documents.tsx`, `brief.tsx`, and `compare.tsx`. A shared `src/lib/file-type.ts` utility would eliminate this.

**Files involved:** `src/pages/dashboard.tsx`, `src/components/layout.tsx`

---

### 4. Documents Library (`/documents`)

**Route:** `src/pages/documents.tsx`

#### Issues

**[High] Search bar and Filter button are decorative**
The search input (line 120–124) has no `onChange` handler or state. The Filter button has no action. These look interactive but do nothing. Either implement them or remove them — dead UI is worse than absent UI for enterprise users.

**[High] Document card "preview" is always static**
Line 203–207: when a document `isReady` and has chunks, the description area shows the hardcoded string "Document indexed and ready for analysis." instead of actual preview text. The `extractedTextPreview` field exists on the document model but is not used here. This wastes prime real estate on a card that could surface the first sentence of the document.

**[Medium] Document card CTA button uses inline override**
Line 229: the "Ask a Question" button uses inline override classes `bg-primary/5 text-primary hover:bg-primary/10 hover:text-primary border-primary/20` applied over `variant="secondary"`. This creates a non-standard button variant that isn't part of the design system. A proper `variant="primaryGhost"` or themed variant would be cleaner and more maintainable.

**[Medium] `fileTypeColor` uses hardcoded semantic colors**
Lines 94–100: `bg-rose-50 text-rose-600 border-rose-100`, `bg-emerald-50 text-emerald-600 border-emerald-100`, `bg-blue-50 text-blue-600 border-blue-100`, `bg-amber-50 text-amber-600 border-amber-100`. These hardcoded Tailwind color classes are not part of the CSS variable token system and will not respond to a global theme change or dark mode.

**Files involved:** `src/pages/documents.tsx`

---

### 5. Document Detail (`/documents/:id`)

**Route:** `src/pages/document-detail.tsx`

#### Issues

**[Medium] Tabs font style**
The Tabs component is used for Preview / Extracted Text / Citations / History / System. No explicit tab audit findings beyond confirming the pattern is consistent.

**[Low] `Row` component uses `font-mono` for both label and value**
The System panel uses a `Row` component where both label and value are `text-xs font-mono`. The label could be `font-sans text-muted-foreground` with only the value in mono for better readability.

**Files involved:** `src/pages/document-detail.tsx`

---

### 6. Document Chat (`/documents/:id/chat`)

**Route:** `src/pages/document-chat.tsx`

#### Issues

**[Medium] Chat input placeholder text is now inaccurate**
Line 546: `placeholder="Ask a question about this document..."`. With hybrid answering now live, the chat also handles general knowledge questions. The placeholder should be updated to reflect the broader capability, e.g., "Ask anything — about this document or in general..."

**[Medium] `ModeBadge` at 10px may fail accessibility**
`ModeBadge` renders at `text-[10px]` which is below the WCAG-recommended minimum of 12px for supplementary text. At 10px with uppercase tracking, the badge text may be unreadable for users with low vision even at 100% zoom.

**[Low] Verification Trace area hidden for general/hybrid answers but `TraceDetailPanel` could still be useful**
For hybrid answers where retrieval was attempted (no relevant chunks found), the trace panel is suppressed. The debug data exists and could offer transparency. Consider showing a minimal "No relevant excerpts found" trace note rather than hiding the section entirely.

**Files involved:** `src/pages/document-chat.tsx`

---

### 7. Multi-Document Compare (`/compare`)

**Route:** `src/pages/compare.tsx`

#### Issues

**[High] Hardcoded `fileTypeColor` semantic colors (same as Documents)**
Lines 41–48: same hardcoded `bg-rose-50`, `bg-emerald-50`, `bg-blue-50`, `bg-amber-50` pattern — not tokenized.

**[Medium] Duplicate `fileTypeIcon` + `fileTypeColor` functions**
Identical logic defined a third time (also in `documents.tsx`, `brief.tsx`, `dashboard.tsx`). Four separate copies of the same function.

**Files involved:** `src/pages/compare.tsx`

---

### 8. Brief Generator (`/brief`)

**Route:** `src/pages/brief.tsx`

#### Issues

**[High] Hardcoded `fileTypeColor` semantic colors (same pattern)**
Lines 53–60: same issue.

**[Medium] Duplicate `fileTypeIcon` + `fileTypeColor` functions**
Fourth copy.

**Files involved:** `src/pages/brief.tsx`

---

### 9. Ask (`/ask`)

**Route:** `src/pages/ask.tsx`

#### Issues

**[High] Empty state border radius inconsistency**
Ask empty state uses `rounded-lg` (line 49). Documents empty state uses `rounded-xl`. Activity empty state uses `rounded-lg`. This should be `rounded-xl` everywhere to match the card system's `rounded-xl` / `rounded-2xl` aesthetic.

**[High] Header typography inconsistency**
Ask header uses `text-2xl font-bold` (line 31). Documents header uses `text-xl font-semibold` (documents.tsx line 108). These are the same level of page hierarchy and should use the same heading size and weight.

**Files involved:** `src/pages/ask.tsx`, `src/pages/activity.tsx`, `src/pages/documents.tsx`

---

### 10. Activity (`/activity`)

**Route:** `src/pages/activity.tsx`

#### Issues

**[High] Header typography inconsistency**
`text-2xl font-bold` (line 113) — same mismatch as Ask vs Documents.

**[High] Hardcoded semantic tone classes**
`toneClasses` object (lines 28–33) uses `bg-green-50 text-green-700`, `bg-blue-50 text-blue-700` — same non-tokenized pattern.

**[Medium] No link from activity event to document**
Each event shows the file name and status but has no link to the document detail page. Users who see an error in the Activity feed have no way to navigate directly to that document from the event card.

**[Medium] Timestamp format is developer-style**
`format(new Date(ev.timestamp), "yyyy-MM-dd HH:mm")` renders as `2026-06-16 20:24`. This is an ISO format more typical of logs than a user-facing feed. Consider `"MMM d, yyyy 'at' h:mm a"` → "Jun 16, 2026 at 8:24 PM".

**Files involved:** `src/pages/activity.tsx`

---

### 11. Upgrade (`/upgrade`)

**Route:** `src/pages/upgrade.tsx`

#### Issues

**[Critical] No Layout wrapper — breaks navigation context**
The Upgrade page is a raw `min-h-screen bg-background` div with no `Layout` wrapper, no sidebar, and no navigation. Users who reach the upgrade page lose their navigation context entirely and must use the browser back button. The `<button onClick={() => navigate("/dashboard")}>` "Back to dashboard" link is the only escape. This is inconsistent with every other authenticated page.

**[Critical] Hardcoded Tailwind colors outside token system**
Lines 113, 127, 134–135, 166, 184: `bg-violet-50`, `text-violet-700`, `bg-slate-50`, `bg-violet-100`, `border-violet-200`, `bg-violet-600`, `hover:bg-violet-700`. None of these use the `--primary` / `--accent` CSS variable tokens. This creates a visual divergence between the Upgrade page's purple and the rest of the app's purple (which reads from `hsl(262 83% 58%)`).

**Files involved:** `src/pages/upgrade.tsx`

---

### 12. Document Status Badge (shared component)

**Route:** `src/components/document-status-badge.tsx`

#### Issues

**[Critical] Hardcoded semantic colors**
Lines 3–15: `bg-green-50 text-green-700 border-green-200`, `bg-blue-50 text-blue-700 border-blue-200`, `bg-amber-50 text-amber-700 border-amber-200`. This badge appears on Documents list, Ask picker, Brief selector, and Compare selector. All instances will break in dark mode with the current approach.

**Files involved:** `src/components/document-status-badge.tsx`

---

### 13. Mobile Layout

#### Issues

**[Medium] Landing mobile menu is not animated**
Desktop scroll triggers a `scrolled` class with a CSS transition. The mobile menu appears/disappears instantly with no `opacity` fade or slide-down. This is jarring relative to the polished landing page aesthetic.

**[Medium] App mobile: sidebar flash**
The app's mobile overlay (`md:hidden fixed inset-0`) uses `bg-background/95 backdrop-blur-sm` (layout.tsx). The Dashboard mobile overlay uses `bg-[var(--s87-bg)]` without backdrop-blur. These are visually inconsistent mobile experiences on the same product.

**[Low] Upgrade page on mobile has no `Layout` wrapper**
No mobile header or hamburger menu. The "Back to dashboard" text link is the only navigation on mobile. Fine for a flow-through page, but jarring.

---

## Interaction / Motion Review

| Area | Current State | Recommendation |
|------|--------------|----------------|
| Landing hero canvas | rAF loop, no pause | Add `document.addEventListener('visibilitychange', ...)` guard; add `prefers-reduced-motion` rAF pause |
| Landing feature cards | No hover state | Add subtle `translateY(-2px)` + `box-shadow` lift on hover (already done on document cards in app) |
| Document cards | `hover:shadow-lg hover:shadow-primary/5` — good | ✅ Well-implemented |
| App page transitions | Instantaneous | Optional: a subtle `opacity` fade on `<main>` content mount would feel polished |
| Activity event cards | No hover | Add `hover:border-primary/30 transition-colors` for clickable feel (especially once links are added) |
| Document chat messages | Appear instantly | Optional: slide-up entrance with `@keyframes` for each message bubble |
| Loading skeletons | Present on Documents, Activity, Ask | ✅ Good coverage |
| Mobile menu | No animation | Add `@keyframes sl-slideDown` for landing mobile menu; existing app overlay is fine |
| `ModeBadge` appearance | Instant | Optional: a subtle `opacity` fade-in when mode changes |

**Motion constraint:** All motion enhancements must use `@media (prefers-reduced-motion: reduce)` guards. The canvas rAF fix is **critical** — canvas animations bypass CSS `prefers-reduced-motion` entirely.

---

## Exact Recommended Fixes

### Fix 1 — Unified `fileType` utility (`src/lib/file-type.ts`)
Extract `fileTypeIcon` and `fileTypeColor` from `documents.tsx`, `compare.tsx`, `brief.tsx`, and `dashboard.tsx` into a single shared file. Eliminates four copies of the same function.

### Fix 2 — Tokenize semantic colors in `DocumentStatusBadge`, activity `toneClasses`, `fileTypeColor`
Replace:
- `bg-green-50 text-green-700 border-green-200` → `bg-emerald-50/80 text-emerald-700 border-emerald-200` scoped inside CSS variable set, OR define `--status-ready-bg`, `--status-ready-fg`, `--status-ready-border` in `:root` and `.dark`
- Same for blue (processing), amber (warning), and rose (error/PDF)
This is the only safe way to support dark mode consistently.

### Fix 3 — Upgrade page: add `Layout` wrapper
Wrap `upgrade.tsx` in `<Layout>` so navigation persists. Remove the "Back to dashboard" button and let users navigate normally.

### Fix 4 — Normalize page headers
Establish one standard for authenticated page headers:
- `h1`: `text-xl font-semibold tracking-tight` (matches Documents — the most polished)
- Subtext: `text-sm text-muted-foreground mt-0.5`
Apply to: Ask (`text-2xl font-bold` → `text-xl font-semibold`), Activity (same).

### Fix 5 — Normalize empty states
Establish one standard for empty states across all pages:
- Container: `rounded-xl border border-dashed border-border bg-card/30 flex flex-col items-center justify-center text-center p-8`
- Icon wrapper: `w-16 h-16 rounded-2xl bg-primary/5 flex items-center justify-center mb-4`
Apply to: Ask (currently `rounded-lg`), Activity (currently `rounded-lg`), error banners (`rounded-md` → `rounded-xl`).

### Fix 6 — Hero footnote `prefers-reduced-motion` fix
Change `.sl-hero-footnote` from `opacity: 0; animation: sl-fadeUp...` to use a `@media (prefers-reduced-motion: no-preference)` block. Under reduced-motion, render with `opacity: 1` directly.

### Fix 7 — Canvas rAF `prefers-reduced-motion` guard
In `HeroCanvas` and `MiniCanvas`, add:
```js
const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
if (prefersReduced) return; // skip rAF loop entirely
```
Alternatively, draw a single static frame and skip the animation loop.

### Fix 8 — Documents card: use `extractedTextPreview`
Replace the static "Document indexed and ready for analysis." string with `doc.extractedTextPreview?.slice(0, 120)` when available, falling back to the static string only when the field is null.

### Fix 9 — Search / Filter on Documents: either wire up or remove
If search is not planned for this release, remove the Search input and Filter button. Empty UI erodes trust. If planned, add a `useState` + client-side `.filter()` on `doc.fileName`.

### Fix 10 — Chat placeholder text
Update `artifacts/signal87-core/src/pages/document-chat.tsx` placeholder from:
> "Ask a question about this document..."
to:
> "Ask anything — I'll search the document or answer from general knowledge..."

### Fix 11 — `ModeBadge` font size
Change `text-[10px]` to `text-[11px]` to meet the 11px minimum for supplementary text in enterprise UI.

### Fix 12 — Activity: add document link and fix timestamp
- Wrap event cards in `<Link href={/documents/${doc.id}}>` (need to thread `doc.id` into `ActivityEvent`)
- Change timestamp format from `"yyyy-MM-dd HH:mm"` to `"MMM d 'at' h:mm a"`

### Fix 13 — Dashboard sidebar `soon` items: add badge
Add a `<span className="ml-auto text-[9px] font-mono uppercase tracking-wider text-muted-foreground/50">Soon</span>` label next to coming-soon nav items so their disabled state is self-explanatory.

---

## Files Likely Involved

| File | Issues |
|------|--------|
| `src/pages/landing.tsx` | Canvas rAF guard, hero footnote reduced-motion |
| `src/styles/landing.css` | Hero footnote opacity, reduced-motion, mobile menu animation |
| `src/pages/dashboard.tsx` | Sidebar width/icon discrepancy, soon badges, fileType duplication |
| `src/components/layout.tsx` | Sidebar dimensions (audit ref only — low risk to adjust) |
| `src/pages/documents.tsx` | Search wiring, preview text, fileTypeColor tokens |
| `src/pages/ask.tsx` | Header typography, empty state radius |
| `src/pages/activity.tsx` | Header typography, tone colors, timestamp, document link |
| `src/pages/compare.tsx` | fileTypeColor tokens, fileType duplication |
| `src/pages/brief.tsx` | fileTypeColor tokens, fileType duplication |
| `src/pages/upgrade.tsx` | Layout wrapper, hardcoded violet colors |
| `src/pages/document-chat.tsx` | Placeholder text, ModeBadge font size |
| `src/components/document-status-badge.tsx` | Hardcoded green/blue/amber colors |
| `src/lib/file-type.ts` (new) | Shared fileTypeIcon + fileTypeColor utility |

---

## Risks to Avoid

1. **Do not refactor the Dashboard away from its `--s87-*` system in one pass.** It has a full light/dark toggle scoped to it. A phased approach (align sidebar dimensions first, then token alignment) is safer.
2. **Do not change `Layout.tsx` sidebar width** without updating any hardcoded layout assumptions in page components.
3. **Do not touch the canvas animation timing values** — the specific wave parameters create the current aesthetic. Only add the guards; keep the visual the same.
4. **Do not change the `fileTypeColor` return values** — only move the function to a shared location.
5. **Do not add a Layout wrapper to Upgrade** without verifying the page still renders correctly at all breakpoints (the current `max-w-3xl mx-auto` centering needs to be preserved inside the Layout's `<main>`).
6. **Do not implement full-text search on Documents** without backend support — client-side search on file names only is a reasonable first pass.

---

## Proposed Implementation Plan

### Phase 1 — Critical / Safety (frontend-only, zero risk to backend)
> Estimated: ~3–4 hours, safe to ship immediately

- [ ] **P1a**: Extract shared `src/lib/file-type.ts` utility; update all 4 consumers
- [ ] **P1b**: Fix `DocumentStatusBadge` — replace hardcoded Tailwind semantic colors with CSS variable-backed tokens (add `--status-*` vars to `:root` and `.dark` in `index.css`)
- [ ] **P1c**: Fix activity `toneClasses` same way
- [ ] **P1d**: Wrap Upgrade page in `<Layout>` — remove the "Back to dashboard" button
- [ ] **P1e**: Fix hero footnote `prefers-reduced-motion` visibility bug (opacity 0 on reduced-motion)
- [ ] **P1f**: Add canvas `prefers-reduced-motion` rAF guard in `landing.tsx`

### Phase 2 — High / Polish (frontend-only, minimal risk)
> Estimated: ~2–3 hours

- [ ] **P2a**: Normalize page headers — standardize `text-xl font-semibold` for Ask, Activity
- [ ] **P2b**: Normalize empty state containers — use `rounded-xl` + `rounded-2xl` icon wrapper consistently
- [ ] **P2c**: Documents: use `extractedTextPreview` in card description
- [ ] **P2d**: Documents: wire up client-side search (filter by `doc.fileName`) or remove the dead UI
- [ ] **P2e**: Update chat placeholder text for hybrid behavior
- [ ] **P2f**: `ModeBadge` font size `text-[10px]` → `text-[11px]`

### Phase 3 — Medium / Interaction (frontend-only, very low risk)
> Estimated: ~2 hours

- [ ] **P3a**: Activity — add document `<Link>` to each event card; fix timestamp format
- [ ] **P3b**: Dashboard — add "Soon" badge to disabled sidebar items
- [ ] **P3c**: Landing — replace verticals emoji icons with small inline SVGs (matching feature section style)
- [ ] **P3d**: Landing — add `visibilitychange` pause to canvas rAF (performance)
- [ ] **P3e**: Landing — add mobile menu fade-in animation

### Phase 4 — Low / Nice-to-have (defer)
- [ ] Landing footer: add About and Team links
- [ ] Skip-to-content link for keyboard navigation
- [ ] App page transition: subtle opacity fade on `<main>` mount
- [ ] Activity event cards: `hover:border-primary/30` once links are added
- [ ] Document chat messages: optional slide-up entrance animation

---

*Report complete. No code changes have been made. Awaiting approval before proceeding.*
