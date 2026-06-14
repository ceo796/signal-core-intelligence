---
name: URL-seeded selection reconcile
description: Why a ?preselect deep-link must be validated against the loaded eligible list before it can be trusted as selected state.
---

When a page seeds selection state from a URL param (e.g. `/compare?preselect=<id>`) using a lazy `useState` initializer, that id is set *before* the document/list data loads. The selectable cards only render *eligible* items (e.g. `chunkCount > 0`), so an ineligible or nonexistent preselected id becomes **hidden but still counted in `selected`** — the user can't see it to deselect it, and submit can send invalid ids causing backend 400/404.

**Rule:** after the list loads, reconcile the seeded selection against the eligible set and drop anything that isn't present + eligible.

**Why:** caught in architect review of the Signal87 compare flow — preselecting a 0-chunk doc broke multi-doc comparison.

**How to apply:** add an effect keyed on the loaded data that filters `selected` to ids that exist AND meet the eligibility predicate; toast when something is removed. Depend only on the loaded list (not `selected`) so it runs once on load without looping.
