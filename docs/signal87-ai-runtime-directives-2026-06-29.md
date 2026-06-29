# Signal87 AI Runtime and Product Directives

Date: 2026-06-29
Repository: Husky87/signal-core-intelligence

## Executive directive

Signal87 AI must be structured as a provider-agnostic document intelligence platform. The backend must not be built around any single LLM vendor. Gemini, Grok/xAI, and local extractive fallback must be interchangeable adapters behind one internal routing layer.

## Current runtime policy

1. Do not use OpenAI at runtime.
2. Do not consume OpenAI credits for reasoning, chat, extraction, embeddings, summaries, briefs, or analysis.
3. Do not blindly delete every historical OpenAI reference if it is unused, documented, or part of old comments.
4. Runtime chain must be:
   - Google/Gemini first
   - xAI/Grok second
   - Local extractive fallback third
5. Local fallback is only allowed after Gemini and Grok fail.
6. No core app route should call a provider SDK directly. All calls must pass through a neutral internal router.

## Required architecture

Create or preserve one internal model router with neutral provider contracts.

Required provider adapter pattern:

```text
core app route
  -> internal AI router
    -> google adapter
    -> xai adapter
    -> local extractive adapter
```

Required normalized response shape:

```ts
type NormalizedAIResponse = {
  answer: string;
  citations?: Citation[];
  provider: "google" | "xai" | "local";
  model?: string;
  confidence?: "high" | "medium" | "low";
  fallbackUsed: boolean;
  fallbackReason?: string;
  trace?: string[];
};
```

Required runtime health/debug output:

```json
{
  "resolvedReasoningChain": ["google", "xai", "local"],
  "embeddingMode": "local",
  "openaiRuntimeEnabled": false
}
```

## Document extraction and upload reliability

Uploads must not fail silently.

Implementation requirements:

1. Add clear server-side logging for upload, storage, extraction, chunking, and indexing.
2. Add user-facing error states when extraction fails.
3. Preserve the original uploaded file even when extraction fails.
4. Failed extraction should not break the document detail page.
5. For weak or scanned documents, use the fallback sequence below:
   - native text extraction
   - extraction quality check
   - Google OCR/layout extraction
   - Gemini document extraction if needed
   - Grok fallback if Gemini fails
   - local filename/metadata/text fallback if all model extraction fails
6. Store extraction status per document: `uploaded`, `extracting`, `indexed`, `partial`, `failed`.
7. Store extraction failure reason and provider trace.
8. Do not let dashboard thumbnails or document preview hammer the original-file endpoint.

## Embeddings and retrieval

1. Do not use OpenAI embeddings at runtime.
2. Use local embeddings or a non-OpenAI embedding adapter selected through config.
3. Retrieval should be provider-neutral and not tied to any one LLM vendor.
4. Citation grounding must survive provider fallback.

## Cross-document AI function

The cross-document AI function is the most important product capability.

Required behavior:

1. One text box should allow questions across one or many documents.
2. The router should gather relevant chunks across selected documents.
3. Answers must cite the underlying documents.
4. Provider fallback must preserve citations and trace.
5. Do not design the cross-document function around one provider-specific prompt format.
6. Add tests for multi-document synthesis across PDF, DOCX, and spreadsheet sources.

## Citation and source formatting

Replace raw inline labels such as `[Source 1]` with polished citation UI.

Required behavior:

1. Use citation chips, superscripts, or expandable source cards.
2. Citations should include document name and location where available.
3. Spreadsheet citations should include workbook, sheet, row range, and column range when available.
4. Answer formatting should feel clean and investor-grade, not developer/debug oriented.

## Product UI directives

### Document detail page

1. The page should primarily function as a clean document viewer.
2. Do not mount a persistent AI analysis panel by default.
3. Do not automatically trigger summary, key clause, risk, action, or citation queries on page load.
4. Keep the document viewer centered and give it more horizontal space.
5. Keep header actions:
   - Download
   - Open
   - Re-index
   - More menu
6. Replace the persistent AI panel with an `Ask AI` button in the top-right header.
7. `Ask AI` should either open a lightweight slide-over drawer or navigate to AI Chat with the document preselected.
8. AI analysis must be user-initiated only.

### Trash page

1. Add a Trash page in the sidebar.
2. Deleted documents should move to Trash instead of being immediately destroyed.
3. Trash must support restore, permanent delete, and empty trash.
4. Deleted documents should not appear in normal document search or dashboard views.

### Mobile polish

Signal87 should feel premium and app-like on mobile.

Required behavior:

1. Mobile-first layout for dashboard, document detail, upload, and AI chat.
2. Use polished cards, clean spacing, and non-cramped touch targets.
3. Avoid desktop side panels on small screens.
4. Use bottom-sheet AI interactions where appropriate.
5. Keep navigation simple and app-like.

## Deployment and platform stability

1. Confirm the production host is Render, not stale Replit/Railway deployments.
2. Add clear environment checks for required provider keys and storage settings.
3. Deployment should fail fast with explicit missing-config errors.
4. Add a lightweight `/api/health` or equivalent that reports app, database, storage, and AI-router readiness without exposing secrets.
5. Remove or clearly quarantine stale deployment assumptions.

## Acceptance criteria

The implementation is not complete until the following are true:

1. A runtime check shows `google -> xai -> local` as the reasoning chain.
2. No OpenAI API key is required for app startup or document analysis.
3. Uploading a PDF, DOCX, XLSX, and scanned PDF produces either indexed content or a visible partial/failed status with the original preserved.
4. Cross-document AI works across at least two documents with citations.
5. Document detail loads without auto-running AI analysis.
6. `Ask AI` is user-initiated.
7. Trash supports restore and permanent delete.
8. Mobile document view is usable without cramped side panels.
9. Production health check clearly shows deployment readiness.

## Build-terminal prompt

Use this prompt for the implementation agent:

```text
Audit the Signal87 AI repo and implement the directives in docs/signal87-ai-runtime-directives-2026-06-29.md. Prioritize provider-agnostic architecture, no OpenAI runtime usage, google -> xai -> local fallback, upload/extraction reliability, cross-document AI stability, clean citation formatting, document-detail simplification, Trash page, mobile polish, and production health checks. Do not blindly delete historical OpenAI references unless they are active runtime dependencies. Make changes in small commits and include tests or verification notes for every directive touched.
```
