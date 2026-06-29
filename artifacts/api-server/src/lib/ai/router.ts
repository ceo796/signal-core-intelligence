import { providerSupportsTask } from "./capabilities";
import { loadAiConfig, resolveTaskProviderChain } from "./config";
import { AiRouterError, classifyProviderError } from "./errors";
import { buildMessages, buildNormalizedResponse } from "./normalize";
import { getProvider } from "./providers";
import type { AiRouterLogContext, AiTaskRequest, AiTaskResponse, ProviderGenerateTextResult } from "./types";

export type AiRouterLogger = (context: AiRouterLogContext) => void;

function defaultLogger(context: AiRouterLogContext): void {
  const payload = {
    taskType: context.taskType,
    providerUsed: context.providerUsed,
    modelUsed: context.modelUsed,
    fallbackUsed: context.fallbackUsed,
    latencyMs: context.latencyMs,
    errorClass: context.errorClass,
    tokenUsage: context.tokenUsage,
  };
  if (context.errorClass) {
    console.error("ai_router_task_failed", payload);
  } else {
    console.info("ai_router_task_completed", payload);
  }
}

function providerTimeoutMs(): number {
  const parsed = Number(process.env.AI_PROVIDER_TIMEOUT_MS ?? "18000");
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 18_000;
}

function withProviderTimeout<T>(promise: Promise<T>, ms: number, providerId: string): Promise<T> {
  let timeout: NodeJS.Timeout;
  const timer = new Promise<never>((_, reject) => {
    timeout = setTimeout(() => reject(new Error(`${providerId} provider timed out after ${ms}ms`)), ms);
  });
  return Promise.race([promise, timer]).finally(() => clearTimeout(timeout!));
}

async function invokeProviderTask(
  request: AiTaskRequest,
): Promise<{
  content: string;
  providerUsed: AiTaskResponse["providerUsed"];
  modelUsed: string;
  tokenUsage: AiTaskResponse["tokenUsage"];
  latencyMs: number;
}> {
  const config = loadAiConfig();
  const chain = resolveTaskProviderChain(request.taskType, config).filter((providerId) =>
    providerSupportsTask(providerId, request.taskType),
  );

  if (chain.length === 0) {
    throw new AiRouterError(`Task ${request.taskType} does not use an LLM provider`, "unsupported", false);
  }

  const messages = buildMessages(request);
  if (messages.length === 0) {
    throw new AiRouterError("AI task requires at least one message", "validation", false);
  }

  const errors: string[] = [];
  const timeoutMs = providerTimeoutMs();

  for (let i = 0; i < chain.length; i++) {
    const providerId = chain[i];
    const provider = getProvider(providerId);
    if (!provider?.isAvailable()) {
      errors.push(`${providerId}: unavailable`);
      continue;
    }

    try {
      const result = await withProviderTimeout<ProviderGenerateTextResult>(
        provider.generateText({
          messages,
          maxTokens: request.maxTokens ?? config.maxTokens,
          responseFormat: request.structuredOutput ? "json_object" : "text",
        }),
        timeoutMs,
        providerId,
      );
      return {
        content: result.content,
        providerUsed: provider.id,
        modelUsed: result.model,
        tokenUsage: result.tokenUsage,
        latencyMs: result.latencyMs,
      };
    } catch (err) {
      const classified = classifyProviderError(err);
      errors.push(`${providerId}: ${classified.message}`);
      const hasAnotherProvider = chain.slice(i + 1).some((nextId) => getProvider(nextId)?.isAvailable());

      // Do not drop to the local extractive fallback while another configured LLM is available.
      // Provider auth, quota, timeout, model, network, and permission failures should all advance
      // to the next provider in the chain: Gemini -> OpenAI -> Grok. Local extraction is last resort.
      if (hasAnotherProvider && classified.errorClass !== "validation" && classified.errorClass !== "unsupported") {
        continue;
      }

      throw new AiRouterError(errors.join("; "), classified.errorClass, false);
    }
  }

  throw new AiRouterError(errors.join("; ") || "No providers available", "unavailable", false);
}

export async function runTask(
  request: AiTaskRequest,
  logger: AiRouterLogger = defaultLogger,
): Promise<AiTaskResponse> {
  const started = Date.now();
  const config = loadAiConfig();
  const primary = resolveTaskProviderChain(request.taskType, config)[0];

  try {
    const result = await invokeProviderTask(request);
    const response = buildNormalizedResponse({
      request,
      answer: result.content || null,
      providerUsed: result.providerUsed,
      modelUsed: result.modelUsed,
      fallbackUsed: primary !== undefined && result.providerUsed !== primary,
      fallbackReason:
        primary !== undefined && result.providerUsed !== primary
          ? `Primary provider ${primary} failed; used ${result.providerUsed}`
          : null,
      latencyMs: Date.now() - started,
      tokenUsage: result.tokenUsage,
    });

    logger({
      taskType: request.taskType,
      providerUsed: response.providerUsed,
      modelUsed: response.modelUsed,
      fallbackUsed: response.fallbackUsed,
      latencyMs: response.latencyMs,
      tokenUsage: response.tokenUsage,
    });

    return response;
  } catch (err) {
    const classified = err instanceof AiRouterError ? err : classifyProviderError(err);
    logger({
      taskType: request.taskType,
      providerUsed: primary ?? "local",
      modelUsed: "none",
      fallbackUsed: true,
      latencyMs: Date.now() - started,
      errorClass: classified.errorClass,
      tokenUsage: null,
    });
    throw classified;
  }
}

function withTaskType(request: AiTaskRequest, taskType: AiTaskRequest["taskType"]): AiTaskRequest {
  return { ...request, taskType };
}

/** Neutral aliases required by the platform contract. */
export const aiRouter = {
  runTask,
  generateText: (request: AiTaskRequest, logger?: AiRouterLogger) =>
    runTask({ ...request, structuredOutput: false }, logger),
  generateStructuredOutput: (request: AiTaskRequest, logger?: AiRouterLogger) =>
    runTask({ ...request, structuredOutput: true }, logger),
  generateChatAnswer: (request: AiTaskRequest, logger?: AiRouterLogger) => runTask(request, logger),
  generateEvidenceMap: (request: AiTaskRequest, logger?: AiRouterLogger) =>
    runTask(withTaskType(request, "evidence_compilation"), logger),
  validateCitations: (request: AiTaskRequest, logger?: AiRouterLogger) =>
    runTask(withTaskType(request, "citation_validation"), logger),
  extractDocumentText: (_request: AiTaskRequest) =>
    Promise.reject(
      new AiRouterError(
        "document_extraction uses Signal87 text-extractor (local parsing), not an LLM provider",
        "unsupported",
        false,
      ),
    ),
  extractTables: (_request: AiTaskRequest) =>
    Promise.reject(
      new AiRouterError(
        "table_extraction uses Signal87 spreadsheet parser (local parsing), not an LLM provider",
        "unsupported",
        false,
      ),
    ),
};
