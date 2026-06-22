# Signal87 — Complete Site Brief for OpenAI

**Purpose of this document:** A page-by-page description of the current Signal87 app so an LLM can understand the visual design, component structure, navigation, UX flow, and where the flow currently breaks. Intended to inform a redesign/restructure conversation.

---

## Tech stack & visual system

- **Framework:** React + Vite (TypeScript), Wouter router, React Query
- **Auth:** Clerk (Google SSO or email)
- **Component library:** shadcn/ui (Tailwind CSS)
- **Color system:** light theme under `.signal-app` CSS class
  - Background: white `#ffffff` / `--background`
  - Card surface: white `--card`
  - Sidebar: very light gray `--sidebar`
  - Borders: `--border` (light gray, ~`#e5e7eb`)
  - Primary accent: indigo `#4F3FF0` used for active nav, primary buttons, highlights
  - Muted text: gray `--muted-foreground`
  - Destructive: red `--destructive`
- **Typography:** Inter / system-ui sans-serif; tight compact sizing (11px labels, 13px body, sm/base headings)
- **Radius:** Compact — 6px cards, 8px inputs, 12px modals
- **Shell:** Desktop = 60px left sidebar + full-height main area. Mobile = full-width bottom nav bar (4 tabs + avatar)

---

## Global navigation

### Desktop (left sidebar, 240px wide)
```
┌────────────────────────┐
│  [Signal87 logo]       │  → /documents
├────────────────────────┤
│  📄 Documents          │  → /documents
│  ✨ AI Chat            │  → /agents/hybrid
│  🏠 Home               │  → /dashboard
│  📊 Activity           │  → /activity
├────────────────────────┤
│  ⚙ Settings            │  → /settings
│  [Avatar] Name         │
│           email        │
└────────────────────────┘
```
Active item: indigo background tint (`bg-primary/10`) + indigo text.
Inactive: gray muted text, hover shows subtle background.

### Mobile (bottom bar, full width, ~56px tall)
4 equal tabs: Documents | AI Chat | Home | Activity + avatar at far right.
Tab label is 10px below a 20px icon. Active tab is indigo.

### ⚠️ Flow issue #1 — nav order is wrong
"Home" is the 3rd item but is semantically the entry point. Users land on `/dashboard` after sign-in but navigate there via the 3rd tab. "Documents" is the primary workhorse and correctly comes first, but "Home" and "Activity" feel out of place.

---

## Page 1 — Public Landing `/`

**Visual style:** DARK. Near-black background `#0b0c0f`. Completely separate from the logged-in app light theme. Self-scoped under `.s87-landing` CSS.

**Layout:**
- Sticky nav: `Signal87 AI` wordmark + `Product / Governance / Use cases / Security` smooth-scroll anchors + `Sign in` / `Book a demo` / `Start for free` buttons (cream pill + green outline pill)
- Hero (two-column): Left = "Document intelligence" eyebrow pill, large off-white headline **"Extend your team with verifiable AI reasoning."**, subtext "Signal87 AI helps teams analyze, compare, and reason across private documents using GPT-powered intelligence, grounded citations, and a clear verification trace." + `Start for free` + `Book a demo` CTAs. Right = product collage showing 4 overlapping mock UI panels (diligence-overview stats, source library, comparison brief, verification trace).
- Scrolling ticker: horizontal marquee of feature labels
- Governance/security section: dark teal left panel, two columns of feature badges
- Three-step workflow section: purple-gradient cards
- Grounded AI Blocks section: split layout with dashed frame showing code/component mocks
- Partners strip: NVIDIA Inception + Google Cloud logos
- Footer

**What works:** Strong, premium dark landing. Clear product value prop. Good visual design.

---

## Page 2 — Sign-in `/sign-in`

**Visual:** Clerk's default modal component centered on a white/light-gray background (no dark theme here — slight visual disconnect from the dark landing). Rounded card, white background.

**Components:**
- "Sign in to Signal Core Intelligence" heading
- "Continue with Google" button (Google OAuth)
- Email field + "Continue" CTA
- "Don't have an account? Sign up" link
- "Development mode" footer note (dev env only)

**⚠️ Flow issue #2 — visual mismatch at auth boundary**
Landing is dark; sign-in appears on white. After sign-in, user lands on `/dashboard` which is light. The transition is: dark landing → white sign-in modal → light app. No smooth visual handoff.

---

## Page 3 — Dashboard/Home `/dashboard`

**After sign-in, this is where users land.** It uses the light-theme Layout shell.

**Layout (top-to-bottom scrollable):**

```
┌─ Top bar ──────────────────────────────────────────────────┐
│  [🔍 Search documents…  ⌘K]           [Avatar] Full name  │
└────────────────────────────────────────────────────────────┘
┌─ Scrollable content ───────────────────────────────────────┐
│  Welcome back, [FirstName]                                 │
│  Your AI workspace for documents and insights.             │
│                                                            │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ ✨ Ask Signal about your documents…        [→ button] │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                            │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐                   │
│  │ ↑ Upload │ │ 📜 Brief │ │ ⚖ Analyze│                   │
│  └──────────┘ └──────────┘ └──────────┘                   │
│                                                            │
│  ┌─ Recent documents ──────────────────────── View all → ┐ │
│  │  Name               Type      Updated                  │ │
│  │  ────────────────── ───────── ─────────                │ │
│  │  [icon] filename    PDF       Jun 20, 2026             │ │
│  │  [icon] filename    XLSX      Jun 19, 2026             │ │
│  └────────────────────────────────────────────────────────┘ │
└────────────────────────────────────────────────────────────┘
```

**Components:**
- **Top bar:** Fake search input (click → navigates to /documents), user avatar + name
- **Ask bar:** Rounded card with sparkles icon, "Ask Signal about your documents…" text, indigo → button. Clicking navigates to `/agents/hybrid`
- **Quick actions:** 3 card-buttons in a grid: Upload → `/documents`, Brief → `/brief`, Analyze → `/compare`
- **Recent documents table:** Shows last 5 uploaded docs. Columns: Name (with colored file-type icon), Type, Updated date. Click → `/documents/:id`. Empty state: FileText icon + "No documents yet" + "Upload your first document →"

**⚠️ Flow issue #3 — Dashboard is redundant with Documents**
The dashboard has a search bar (fake, just navigates to /documents), recent docs list, and upload shortcut. The Documents page has actual search, full list, and upload. Users will quickly bypass Dashboard and live in Documents. The dashboard doesn't provide unique value.

**⚠️ Flow issue #4 — Three entry points to AI**
Dashboard has an Ask bar (→ /agents/hybrid). Nav has "AI Chat" (→ /agents/hybrid). Documents page has a CTA banner (→ /agents/hybrid). They all go to the same place, but the Ask bar on the dashboard also creates confusion with /ask (single-doc picker) and /compare (multi-doc comparison). Users don't know which "ask" surface to use for what.

---

## Page 4 — Documents List `/documents`

**The primary workhorse of the app.** Full document library management.

**Layout:**
```
┌─ Header bar ───────────────────────────────────────────────┐
│  Documents                          [Upload] [⊞ Grid/List] │
│  [🔍 Search…] [Status ▾] [Type ▾] [Sort ▾] [↺ Reset]     │
└────────────────────────────────────────────────────────────┘
┌─ Content area ─────────────────────────────────────────────┐
│  [AI Chat CTA banner — if ≥1 doc exists]                   │
│  ─────────────────────────────────────────────────         │
│  LIST VIEW: Table rows                                      │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ ☐ [thumb] Filename.pdf    PDF  Ready  14 chunks  ... │  │
│  │ ☐ [thumb] Report.xlsx    XLSX  Ready  22 chunks  ... │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                            │
│  GRID VIEW: Cards (thumbnail + name + type + status)       │
│  ┌──────┐ ┌──────┐ ┌──────┐                               │
│  │ PDF  │ │ XLSX │ │ TXT  │                               │
│  │ thumb│ │ thumb│ │ icon │                               │
│  │ name │ │ name │ │ name │                               │
│  └──────┘ └──────┘ └──────┘                               │
└────────────────────────────────────────────────────────────┘
```

**Features:**
- **View toggle:** List (table rows) / Grid (cards). Persisted in localStorage.
- **Search:** Live client-side filter on filename.
- **Filters:** Status (All/Ready/Processing/Error), File type (All/PDF/XLSX/etc.). Persisted.
- **Sort:** Name, Status, Chunks, Uploaded — asc/desc. Persisted.
- **Multi-select:** Checkboxes; up to 5 docs for Compare. When ≥2 selected, "Compare N documents →" banner appears.
- **Upload button:** Opens `FileUploadModal` dialog. Supports drag-and-drop. Multi-file queue with per-file progress.
- **Per-row actions (list):** Click row → detail. Row actions: Ask (→ single-doc chat), Re-Index (if failed/0-chunk), Print, Download, Delete.
- **Per-card actions (grid):** Hover overlay with Ask, Re-Index, Delete.
- **AI Chat CTA:** Banner at top when ≥1 doc exists: "Ask a question across your documents" → `/agents/hybrid`.
- **Pagination:** Prev/Next when >page size.

**Status badges:** `Ready` (green), `Processing` (blue), `Failed` (red), `No text` (yellow), etc.
**File-type pills:** Color-coded — PDF (orange-red), DOCX (blue), XLSX/CSV (green), TXT (gray).

**Empty state:** FileText icon, "No documents yet", "Upload your first document" button.

---

## Page 5 — Document Detail `/documents/:id`

**Viewer-only page** (AI panel was removed). Shows the document and its metadata.

**Layout:**
```
┌─ Header ───────────────────────────────────────────────────┐
│  ← Back    [PDF] Filename.pdf    [Ready ✓]   [Ask AI] [⋯] │
│  2.4 MB · Uploaded 2 days ago                              │
│  [alert banner if not ready]                               │
└────────────────────────────────────────────────────────────┘
┌─ Full-width content area ──────────────────────────────────┐
│                                                            │
│  IF PDF with stored original:                              │
│    Embedded PDF viewer (react-pdf) with pagination,        │
│    zoom controls, page count. Highlight mode available.    │
│                                                            │
│  IF text document (TXT/DOCX/CSV):                         │
│    Scrollable extracted text display                       │
│                                                            │
│  IF no original stored / extraction failed:               │
│    "Source not available" message                          │
│                                                            │
└────────────────────────────────────────────────────────────┘
```

**Header details:**
- ← Back (to /documents)
- File-type pill badge (color-coded, e.g., "PDF" in orange)
- Document filename (truncated)
- `DocumentStatusBadge` (Ready/Processing/Failed/etc.)
- **"Ask AI" primary button** (indigo) → navigates to `/documents/:id/chat`
- **"⋯ More" dropdown:** Download, Open Original (new tab), Re-Index, Print (PDF only), Highlight Mode (PDF only), separator, Delete

**PDF viewer (when PDF + original available):**
- react-pdf embed; first page loads, pagination controls (Page X of N)
- Zoom in/out
- Highlight mode: click-drag to highlight text, highlights persist in session
- Print via browser iframe

**⚠️ Flow issue #5 — The document detail is now a dead end**
The page shows the document but clicking "Ask AI" navigates away entirely to `/documents/:id/chat`, breaking context. The user loses the PDF view when they ask a question. There is no way to see the document and chat simultaneously anymore. Previously the page had a right-side AI panel; now it has nothing.

**⚠️ Flow issue #6 — Tabs were removed but content still warrants them**
Prior version had tabs: Preview / Extracted Text / Citations / History / System. Now it's just the viewer. "Extracted Text" and document metadata (chunk count, extraction status) are no longer accessible on the detail page.

---

## Page 6 — Single-Document Chat `/documents/:id/chat`

**Persisted, per-document conversation.** Grounded in one document with `[Source N]` citations.

**Layout:**
```
┌─ Header ───────────────────────────────────────────────────┐
│  ← Back    [icon] Filename.pdf                             │
└────────────────────────────────────────────────────────────┘
┌─ Chat history (scrollable) ────────────────────────────────┐
│  [if empty: empty state with document name + prompt]       │
│                                                            │
│  User question bubble (right-aligned, indigo bg)           │
│                                                            │
│  AI answer (left-aligned, card):                           │
│    Markdown-rendered answer text                           │
│    [Source 1] [Source 2] inline citation markers           │
│    ─────────────────────────────────────────────           │
│    Citations panel (collapsible):                          │
│      Source 1: "excerpt text" — filename, page/chunk       │
│    Verification Trace (collapsible):                       │
│      Provider: openai | Model: gpt-4o-mini                 │
│      Chunks considered: N | Latency: Xms                  │
│                                                            │
└────────────────────────────────────────────────────────────┘
┌─ Composer (fixed bottom) ──────────────────────────────────┐
│  [Ask a question about this document…           ] [→ Send] │
└────────────────────────────────────────────────────────────┘
```

**Features:**
- Chat history persisted to backend (unlike multi/hybrid which are ephemeral)
- `[Source N]` citation markers inline in answer text; clicking shows the cited excerpt
- Verification Trace: provider, model, chunk count, latency
- "Clear chat" action
- If document not ready: shows warning, blocks question submission

---

## Page 7 — Hybrid AI Chat `/agents/hybrid`

**The main cross-document AI assistant.** ChatGPT-style composer layout.

**Pre-answer state (centered composer):**
```
┌─ Page ─────────────────────────────────────────────────────┐
│                                                            │
│         ✨ Hybrid AI Chat                                  │
│         Ask one question across all your documents.        │
│         Grounded in your documents + GPT reasoning.        │
│         No web research.                                   │
│                                                            │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ Ask anything about your documents…                  │   │
│  │                                                     │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                            │
│  [Auto ▾]  [All documents ▾]  [Web · Soon] (disabled)     │
│                                                            │
│                                          [↑ Send]          │
│                                                            │
└────────────────────────────────────────────────────────────┘
```

**Post-answer state (composer docks to bottom):**
```
┌─ Answer area (top) ────────────────────────────────────────┐
│  User question (right bubble)                              │
│                                                            │
│  Thinking… (skeleton while loading)                        │
│  — then —                                                  │
│  Markdown answer with [Source N] markers                   │
│                                                            │
│  Source labels:                                            │
│    [● Document context]  [● GPT reasoning]  [○ Web · Soon]│
│    "Searched: filename1.pdf, filename2.xlsx"               │
│                                                            │
│  [Citations ▾] (collapsible)                              │
│    Source 1: excerpt — filename                            │
│                                                            │
│  [Verification Trace ▾] (collapsible)                     │
│    Provider: openai | Model: gpt-4o-mini | N chunks        │
└────────────────────────────────────────────────────────────┘
┌─ Composer (docked bottom) ─────────────────────────────────┐
│  [Type your follow-up…                         ] [↑ Send]  │
│  [Auto ▾]  [All documents ▾]  [Web · Soon]                 │
└────────────────────────────────────────────────────────────┘
```

**Mode dropdown options:** Auto / Summarize / Compare / Extract / Diligence (with descriptions)
**Documents dropdown:** Popover checkbox list; "All documents" when none selected; "N selected" otherwise; "Clear" resets
**Disabled "Web · Soon" pill:** Non-interactive, no network calls

**⚠️ Flow issue #7 — Ephemeral answers**
Multi-chat answers are NOT persisted. Refreshing the page loses all answers. Only single-doc chat (`/documents/:id/chat`) persists history.

**⚠️ Flow issue #8 — Mode selector is hidden complexity**
Auto/Summarize/Compare/Extract/Diligence modes exist but most users won't know what they do. "Compare" mode here overlaps with the `/compare` route.

---

## Page 8 — Ask (Document Picker) `/ask`

**A simple intermediate page** that shows a list of ready documents and lets you pick one to start single-doc chat.

**Layout:**
```
  Pick a document
  ┌─────────────────────────────┐
  │ [icon] Filename.pdf   Ready │  → /documents/:id/chat
  │ [icon] Report.xlsx    Ready │  → /documents/:id/chat
  └─────────────────────────────┘
```

If no ready documents: empty state "No ready documents" + upload CTA.

**⚠️ Flow issue #9 — /ask is mostly redundant**
Users could just go to Documents and click "Ask" on any row. This intermediate picker page has minimal unique value and adds a navigation step.

---

## Page 9 — Executive Brief `/brief`

**Generate a structured AI brief over 1–5 documents.**

**Layout (two-column on desktop):**
```
┌─ Left: Setup ──────────┐ ┌─ Right: Result ────────────────┐
│ Select Documents       │ │ [empty until generated]        │
│ ☐ filename.pdf  Ready  │ │                                │
│ ☐ report.xlsx   Ready  │ │ — after generation —           │
│ (max 5)                │ │                                │
│                        │ │ Brief type label               │
│ Brief type:            │ │ ─────────────────              │
│ ○ Executive Summary    │ │ ## Section heading             │
│ ○ Risk Brief           │ │ Markdown answer text...        │
│ ○ Diligence Brief      │ │ [Source 1] [Source 2]          │
│ ○ Contract Review      │ │                                │
│ ○ Comparison Brief     │ │ [Citations ▾]                  │
│   (requires ≥2 docs)   │ │ [Verification Trace ▾]         │
│                        │ │                                │
│ Focus (optional):      │ │ [📋 Copy Brief]                │
│ [textarea]             │ │                                │
│                        │ └────────────────────────────────┘
│ [Generate Brief ↑]     │
└────────────────────────┘
```

**Brief types:** Executive Summary, Risk, Diligence, Contract Review, Comparison (≥2 docs)
**Citations:** Same `[Source N]` system as hybrid chat
**Not persisted** — generating a new brief replaces the current one

---

## Page 10 — Compare `/compare`

**Multi-document Q&A** (2–5 docs required). Very similar to Executive Brief but question-focused rather than brief-type-focused.

**Layout:**
```
┌─ Left: Setup ──────────┐ ┌─ Right: Answer ────────────────┐
│ Select 2–5 Documents   │ │ [empty until submitted]        │
│ ☐ filename.pdf  Ready  │ │                                │
│ ☐ report.xlsx   Ready  │ │ — after submission —           │
│                        │ │ Markdown answer                │
│ [Question textarea]    │ │ [Source N] citations           │
│ Ask a question across  │ │ [Citations ▾]                  │
│ selected documents     │ │ [Trace ▾]                      │
│                        │ └────────────────────────────────┘
│ [Compare Documents →]  │
└────────────────────────┘
```

**⚠️ Flow issue #10 — Brief and Compare are too similar**
Both `/brief` and `/compare` let you pick 2-5 docs and get an AI-generated answer with citations and a trace. The distinction (structured brief vs open question) isn't clear from the nav. Users don't know which to use. "Compare" in the nav also conflicts with the "Compare" mode inside Hybrid Chat.

---

## Page 11 — Activity `/activity`

**Read-only upload/processing feed** derived from existing document data (no separate activity store).

**Layout:**
```
  📊 Activity

  ┌───────────────────────────────────────────────────────────┐
  │ [✓] filename.pdf                              Jun 20      │
  │     Uploaded and ready · 14 chunks indexed               │
  │                                                           │
  │ [●] report.xlsx                               Jun 19      │
  │     Processing — document is being processed             │
  │                                                           │
  │ [✗] old-doc.docx                              Jun 18      │
  │     Extraction failed — no text could be extracted       │
  └───────────────────────────────────────────────────────────┘
```

**Events derived from:** `uploadedAt`, `extractionStatus`, chunk count. Two events per doc (upload + extraction outcome).
**Not a real event log** — synthetic events computed from document state each page load.

**⚠️ Flow issue #11 — Activity adds little value as a primary nav item**
It shows the same info visible in the Documents list (status badges, timestamps). It's essentially a filtered view of upload history, not a meaningful activity feed. Occupying a primary nav slot feels wasteful.

---

## Page 12 — Settings `/settings`

Standard account/preferences page. Not core to the primary flow.

---

## Overall flow map

```
Public:
  /  (dark landing) → /sign-in → /sign-up

Logged-in shell (light theme, left sidebar):
  /dashboard         ← first page after auth
    → /agents/hybrid (Ask bar)
    → /documents (quick action + search)
    → /brief (quick action)
    → /compare (quick action)

  /documents         ← primary library
    → /documents/:id       (click doc)
    → /documents/:id/chat  (Ask button on row)
    → /agents/hybrid       (CTA banner)
    → /compare             (multi-select + compare button)
    [Upload modal]

  /documents/:id     ← viewer only
    → /documents/:id/chat  (Ask AI button)
    [No AI on page]

  /documents/:id/chat  ← single-doc chat (persisted)

  /agents/hybrid     ← cross-doc ChatGPT-style (ephemeral)
    [Covers all-docs and multi-select]

  /ask               ← doc picker → single-doc chat (redundant)

  /brief             ← structured brief generator (ephemeral)

  /compare           ← multi-doc Q&A (ephemeral)

  /activity          ← upload history feed (synthetic)
```

---

## Summary of flow problems

| # | Problem | Impact |
|---|---------|--------|
| 1 | Nav order: Documents \| AI Chat \| Home \| Activity — "Home" is 3rd | Confusing hierarchy |
| 2 | Dark landing → white Clerk sign-in → light app — visual whiplash | First-impression friction |
| 3 | Dashboard duplicates Documents (search bar, doc list, upload) | Unnecessary page |
| 4 | Three AI entry points (dashboard Ask bar, /ask picker, /agents/hybrid) that aren't clearly differentiated | User confusion |
| 5 | Document detail → Ask AI navigates AWAY from the document | Loses context |
| 6 | Document detail has no tabs — no way to see extracted text, chunk count, or metadata | Lost functionality |
| 7 | Hybrid AI answers are ephemeral (refresh = gone); only single-doc chat persists | Surprising loss of work |
| 8 | Hybrid Chat "Compare" mode duplicates the /compare route | Conceptual overlap |
| 9 | /ask picker page is an extra navigation step with no unique value | Friction |
| 10 | /brief and /compare have almost identical UI/UX; difference unclear | Redundant surfaces |
| 11 | Activity page shows synthetic events derivable from the Documents list | Low-value nav item |

---

## What a restructured flow could look like (suggestions, not implemented)

**Navigation (simplified):**
```
  Documents | AI Chat | Brief | Settings
```
- Remove "Home" (or make it Documents)
- Remove "Activity" from primary nav (move to Settings or remove)
- Remove "/ask" (access single-doc chat from document detail or documents list)

**Document detail (two-column workspace):**
```
  Left: PDF viewer (current)
  Right: Chat panel (single-doc, pinned) with ability to switch to Hybrid (all-docs)
```
This was the previous design and made sense — remove the forced navigation to `/documents/:id/chat` and keep chat in-context.

**Merge Brief + Compare:**
Single "Analyze" page with tabs or mode selector: Open Q&A | Executive Brief | Risk | Contract | Comparison.

**Persist Hybrid Chat answers** (at least session-level, or optionally save as a "brief").

**Dashboard = Documents:**
Remove `/dashboard` as a separate route. Make `/documents` the post-auth landing page. The dashboard's "Ask bar" can live at the top of the Documents page.
