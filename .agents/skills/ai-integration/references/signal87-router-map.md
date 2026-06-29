# Signal87 AI router map (production)

Use this reference when applying the ai-integration skill to this repo. Do not bypass these paths.

## Runtime policy (locked)

| Rule | Implementation |
|------|----------------|
| Provider chain | Grok (`xai`) → Gemini (`google`) → local extractive |
| OpenAI | Disabled unless `ALLOW_OPENAI=true` |
| Same-origin API | No `VITE_API_BASE_URL` on unified Render deploy |
| Embeddings | Local BM25 fallback (`embeddingStatus: local`) |

Verify: `GET /api/runtime-check` → `resolvedReasoningChain`, `openaiEnabled`, `geminiAuthMode`.

## Router stack

```
Route (chat, agent, brief, skills, multi-chat)
  → aiRouter.runTask({ taskType, messages })
    → resolveTaskProviderChain(taskType)
    → provider.generateText({ messages, taskType })
      → google: geminiProvider.ts (?key= or Vertex SA)
      → xai: grokProvider.ts (task agents + postProcess)
```

Key files:
- `artifacts/api-server/src/lib/ai/router.ts`
- `artifacts/api-server/src/lib/ai/config.ts`
- `artifacts/api-server/src/lib/ai/providers/grok-agents.ts`
- `artifacts/api-server/src/lib/ai/providers/grok-postprocess.ts`

## Task types → app surfaces

| Task type | UI / route |
|-----------|------------|
| `document_chat` | `POST /api/documents/:id/chat` |
| `multi_document_chat` | `POST /api/documents/multi-chat` |
| `document_summary` | Hybrid agent mode `summarize`, skills |
| `document_compare` | Hybrid `compare`, compare page |
| `fact_extraction` | Hybrid `extract`, extract skills |
| `diligence_memo` | Hybrid `diligence`, risk skills |
| `executive_brief` | `POST /api/brief` |
| `document_extraction` | Local parser only (not LLM) |

## Grok strengthening (B2C track)

When Grok is primary or fallback:
1. Task-specific agent persona appended to system prompt (`grok-agents.ts`).
2. Formatting policy: citations at end of bullets, `Sources` footer.
3. `postProcessGrokAnswer()` enforces layout server-side.
4. Min 2048 output tokens on Grok calls.

Default primary (code + `render.yaml`): `AI_PRIMARY_REASONING_PROVIDER=xai`

## Gov/defense track (future)

For CUI/NOFORN workloads, do **not** send raw corpus to public Gemini/Grok APIs. Plan:
- Classification gate before `runTask`
- NIM or VPC-isolated inference adapter (new `ProviderId`)
- Redaction layer on chunks before LLM

## Render secrets (B2C)

| Variable | Purpose |
|----------|---------|
| `GEMINI_API_KEY` | Gemini API key (`AIza...` or `AQ...`) |
| `XAI_API_KEY` | Grok fallback / primary |
| `GEMINI_SERVICE_ACCOUNT_JSON` | Optional Vertex path (overrides API key when valid) |

## Tests

```bash
pnpm --filter @workspace/api-server test
pnpm smoke:production https://www.signal87.ai
```

AI smoke passes when `runtime-check` shows `google` + `xai` in `availableProviders`.