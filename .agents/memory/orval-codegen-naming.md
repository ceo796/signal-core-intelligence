---
name: Orval codegen schema/operationId naming collision
description: Why an OpenAPI response schema must not be named <OperationIdPascal>Response or Body in this repo's codegen
---

In this repo, the API contract is OpenAPI-first (`lib/api-spec/openapi.yaml`) and Orval generates Zod schemas (`@workspace/api-zod`) and React Query hooks/types (`@workspace/api-client-react`) via `pnpm --filter @workspace/api-spec run codegen`.

Rule: a `components.schemas` entry must NOT be named `<OperationIdPascal>Response` or `<OperationIdPascal>Body` for any operation.

**Why:** Orval auto-generates symbols from the operationId — for `operationId: multiChat` it emits a `MultiChatResponse` const/type and a `MultiChatBody` (request body) symbol. If you also declare a schema literally named `MultiChatResponse`, the generated files collide on that identifier and codegen output is broken.

**How to apply:** Name the response payload schema something distinct, e.g. `MultiChatResult` (used for the multi-doc comparison endpoint), not `MultiChatResponse`. Request-body schemas similarly should avoid `<Op>Body`. After adding/renaming, run codegen and confirm `useXxx` hook + types generate without duplicate-identifier errors.
