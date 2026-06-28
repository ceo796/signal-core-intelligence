import type { AiTaskRequest, AiTaskResponse, ChatMessage, ConfidenceLevel } from "./types";

export function buildMessages(request: AiTaskRequest): ChatMessage[] {
  if (request.messages && request.messages.length > 0) return request.messages;
  const messages: ChatMessage[] = [];
  if (request.systemPrompt?.trim()) {
    messages.push({ role: "system", content: request.systemPrompt });
  }
  if (request.userPrompt?.trim()) {
    messages.push({ role: "user", content: request.userPrompt });
  }
  return messages;
}

export function parseStructuredData(content: string): Record<string, unknown> | null {
  const trimmed = content.trim();
  if (!trimmed) return null;
  try {
    const parsed = JSON.parse(trimmed) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

export function inferConfidence(answer: string | null, fallbackUsed: boolean): ConfidenceLevel {
  if (!answer?.trim()) return "low";
  if (fallbackUsed) return "medium";
  return "high";
}

export function buildNormalizedResponse(opts: {
  request: AiTaskRequest;
  answer: string | null;
  structuredData?: Record<string, unknown> | null;
  providerUsed: AiTaskResponse["providerUsed"];
  modelUsed: string;
  fallbackUsed: boolean;
  fallbackReason: string | null;
  latencyMs: number;
  tokenUsage: AiTaskResponse["tokenUsage"];
  warnings?: string[];
}): AiTaskResponse {
  return {
    taskType: opts.request.taskType,
    answer: opts.answer,
    structuredData: opts.structuredData ?? (opts.request.structuredOutput ? parseStructuredData(opts.answer ?? "") : null),
    citations: opts.request.citations ?? [],
    evidenceItems: opts.request.evidenceItems ?? [],
    warnings: opts.warnings ?? [],
    confidence: inferConfidence(opts.answer, opts.fallbackUsed),
    providerUsed: opts.providerUsed,
    modelUsed: opts.modelUsed,
    fallbackUsed: opts.fallbackUsed,
    fallbackReason: opts.fallbackReason,
    latencyMs: opts.latencyMs,
    tokenUsage: opts.tokenUsage,
  };
}