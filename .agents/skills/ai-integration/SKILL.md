---
name: ai-integration
description: Use for designing secure AI model integrations, multi-LLM routing, NVIDIA NIM and cloud provider setups, agentic workflows, RAG pipelines, and compliance-aware API connections in enterprise, defense, and intelligence platforms such as Signal87 AI. Triggers: LLM integration, multi-model router, Gemini, Grok, xAI, Vertex, NIM, RAG, citations, agent workflow, embedding, provider fallback, ALLOW_OPENAI, runtime-check.
---

# AI Integration

## Purpose
This skill provides specialized guidance for integrating AI capabilities into applications with a focus on security isolation, data sovereignty, compliance (CUI/PII/NOFORN/ITAR/FedRAMP), auditability, and production reliability. It is particularly tuned for dual-track development: accessible B2C features alongside hardened gov/defense capabilities.

## Activation Triggers
Activate when the user discusses or requests help with:
- Connecting LLMs, embedding models, rerankers, or agent frameworks to apps or platforms
- Multi-model orchestration, intelligent routing, or gateway patterns
- NVIDIA NIM, Google Vertex AI, xAI/Grok, or similar inference service integrations
- Secure RAG, knowledge graphs, entity resolution, or grounded conversational AI (e.g., ARIA-style)
- Chrome extension integrations, zero-leakage document processing, or DMS connectors (SharePoint, FileNet)
- Agent builder, autonomous workflows, tool use, or sandboxed execution
- Performance tuning, cost optimization, observability, or scaling AI components
- Compliance mapping, ATO preparation (SOCOM, NIST 800-53), or security architecture reviews for AI systems

## Core Directives
- Always begin by classifying data sensitivity and regulatory constraints before suggesting any architecture or code.
- Enforce zero external untrusted LLM exposure for sensitive or CUI data. Route exclusively through allow-listed, isolated, or on-prem inference (NVIDIA NIM in VPC preferred for classified workloads).
- Prioritize architectures that deliver full provenance, citations, audit logs, and explainability for every AI-generated output.
- Use strict allow-listing for models and providers; never hardcode keys or allow ad-hoc external calls.
- Balance rapid iteration (Lovable/Supabase patterns, React frontends, Edge Functions) with enterprise hardening (RLS, Row-Level Security, secret rotation, circuit breakers, rate limiting).
- For gov/defense tracks: map every component to NIST 800-53, FedRAMP, and ATO requirements; document data flows explicitly.
- Provide production-ready, copy-pasteable code with error handling, logging, retries, and security guardrails. Include fallback strategies and observability hooks.
- When user provides existing code or architecture, review it against these principles and suggest minimal, high-impact improvements first.

## Signal87 implementation map
Before proposing new architecture, read `references/signal87-router-map.md` in this skill folder. Signal87 already implements:
- Neutral router: `artifacts/api-server/src/lib/ai/router.ts`
- Provider adapters: `artifacts/api-server/src/lib/ai/providers/`
- Grok task agents + formatting: `grok-agents.ts`, `grok-postprocess.ts`
- Locked policy: Gemini → Grok → local; OpenAI gated by `ALLOW_OPENAI`
- Runtime diagnostics: `GET /api/runtime-check`

Extend these modules; do not add direct provider SDK calls from routes.

## Recommended Integration Patterns

### Multi-LLM Router & Gateway
- Implement a central router (e.g., Supabase Edge Function or lightweight proxy) that inspects task type, data classification, latency/cost targets, and capability requirements.
- Maintain an explicit allow-list of models/endpoints with metadata (context window, strengths, compliance tier).
- Apply intelligent routing rules: e.g., sensitive docs → NVIDIA NIM or self-hosted; general chat → Gemini/GPT via Vertex with sanitization; embeddings → dedicated model.
- Include circuit breakers, exponential backoff retries, token budgeting, and graceful degradation.
- Log every routing decision, model call, token usage, and response metadata for auditability.

### NVIDIA NIM & On-Prem Inference
- Leverage NVIDIA Inception program resources and NIM containers for optimized inference (TensorRT-LLM, vLLM, etc.).
- Deploy in isolated VPC or air-gapped environments for defense/intel use cases.
- Integrate NIM endpoints for document understanding, embedding generation, reranking, and generation while preserving data locality.
- Validate performance against SOCOM ATO and NIST controls; prefer NIM for workloads requiring predictable latency and hardware acceleration.
- Combine with pgvector or similar for hybrid search when full RAG is needed.

### Secure RAG, Knowledge Graphs & Agentic Systems
- Ground every response with inline citations and source provenance from the vector store or document corpus.
- Implement entity resolution, timeline construction, risk scoring, and relationship graphs with explainable paths back to source documents.
- For agents: define narrow tool schemas, enforce sandboxing, require human confirmation for high-impact actions, and maintain full execution traces.
- Use Supabase pgvector with Row-Level Security (RLS) policies tied to user/workspace isolation.
- Support multi-document synthesis, duplicate detection, and cross-document reasoning without leaking context across boundaries.

### Zero-Leakage & Client-Side Patterns (Chrome Extension / DMS)
- Process documents locally or via secure proxy when possible; avoid uploading raw CUI/PII to any external service.
- For Chrome extension integrations with existing DMS: perform extraction, classification, and embedding client-side or in isolated Edge Functions; transmit only sanitized metadata or embeddings when necessary.
- Implement strict content sanitization, PII redaction, and classification gates before any model inference.
- Maintain complete audit trails of all document access and AI processing events.

### Observability, Cost & Performance
- Instrument every integration with structured logging, tracing (correlation IDs), metrics (latency, tokens, error rates), and cost attribution.
- Implement caching strategies (semantic cache, exact match) and prompt compression where safe.
- Monitor for drift, hallucination indicators (via grounding checks), and anomalous usage patterns.
- Optimize for mobile/iOS constraints when relevant (reduced context, efficient models, offline-capable fallbacks).

## Common Pitfalls & Mitigations
- Never route sensitive data to consumer-facing public APIs (GPT, Gemini direct, etc.) without explicit classification, redaction, and approval gates.
- Avoid tight coupling to a single provider; always design for portability via abstraction layers or routers.
- Do not neglect secret management, key rotation, or network isolation — use environment-specific vaults and least-privilege IAM.
- Prevent silent failures in long-running agent workflows by adding timeouts, progress checkpoints, and human escalation paths.
- Ensure UI/UX for AI features (interactive text boxes, citation modals, graph visualizations) remains responsive and accessible even under high load or partial outages.

## Workflow When Assisting with AI Integration Tasks
1. Ask clarifying questions if scope, sensitivity level, target environment (B2C vs. gov/defense), or current stack details are ambiguous.
2. Map the request to one or more patterns above and outline a high-level architecture emphasizing isolation boundaries and compliance.
3. Deliver concrete, ready-to-implement code or configuration (TypeScript/Edge Functions, Python/FastAPI proxies, React components, Supabase migrations, etc.) with security annotations.
4. Include testing recommendations: unit tests for routing logic, integration tests with synthetic sensitive data, compliance checklist review.
5. For iterative refinement: propose smallest viable change that advances the integration while preserving or improving the security/compliance posture.
6. When user shares screenshots, code snippets, or error logs, analyze them through the lens of these directives and provide targeted fixes or enhancements.
7. Suggest related follow-on work: observability dashboards, cost dashboards, ATO evidence packages, or competitive positioning of the integration approach.

## Evolution
Update this skill whenever new integration patterns, provider capabilities (new NIM models, Vertex features), compliance requirements, or platform-specific lessons from Signal87 development emerge. Add concrete examples from real implementations to the `references/` directory as they stabilize.