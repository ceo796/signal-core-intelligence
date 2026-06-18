---
name: Hybrid answer grounding signal
description: How to tell, client-side, whether a hybrid-agent answer actually used the documents vs. general GPT reasoning.
---

# Hybrid answer grounding signal

The hybrid agent response (`POST /api/agent/hybrid` → `{ answer, mode, documentsUsed, citations, trace }`)
exposes `documentsUsed` and `citations` that reflect what **retrieval considered/returned**, NOT whether
the model actually grounded its answer in them. The backend always retrieves chunks whenever the user has
indexed documents, so `documentsUsed.length > 0` is true even for general / GPT-only answers that don't cite
anything.

**Rule:** to honestly show whether documents contributed to a *specific* answer (e.g. a "Document context
used / not used" badge), detect `[Source N]` in `result.answer` — `/\[Source\s+\d+\]/.test(result.answer)` —
optionally AND `result.citations.length > 0`. Do NOT key it off `documentsUsed.length`.

**Why:** a badge keyed off `documentsUsed` misrepresents GPT-only / general-reasoning answers as
document-grounded. The response shape intentionally does not expose per-answer grounding, and the citation
markers in the answer text are the only reliable signal — and changing the response shape is out of scope
(contract-first, citations/trace payload is a product invariant).

**How to apply:** any future "did the documents contribute?" UI (badges, filters, analytics) on a hybrid/
multi-doc/brief answer should derive from `[Source N]` presence in the answer text, not from retrieval-scope
fields. The "Searched:" chips that show retrieval *scope* may still use `documentsUsed` — that is accurate
for scope, just not for grounding.
