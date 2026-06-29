import { providerSupportsTask } from "./capabilities";
import { RUNTIME_DISABLED_PROVIDERS, loadAiConfig, resolveTaskProviderChain } from "./config";
import { AiRouterError, classifyProviderError } from "./errors";
import { buildMessages, buildNormalizedResponse } from "./normalize";
import { getProvider } from "./providers";
import type {
  AiRouterLogContext,
  AiTaskRequest,
  AiTaskResponse,
  ProviderAttemptLog,
  ProviderId,
} from "./types";

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

function providerDisplayName(providerId: string): string {
  if (providerId === "google") return "Gemini";
  if (providerId === "xai") return "Grok";
  return providerId;
}

function logProviderAttempt(attempt: ProviderAttemptLog, onAttempt?: (attempt: ProviderAttemptLog) => void): void {
  const label = providerDisplayName(attempt.provider);
  const event = attempt.success
    ? `${label} succeeded`
    : attempt.fallbackTarget
      ? `${label} failed; trying ${providerDisplayName(attempt.fallbackTarget)} next`
      : `${label} failed`;

  console.info("ai_router_provider_attempt", { ...attempt, event });
  onAttempt?.(attempt);
}

function withProviderTimeout<T>(promise: Promise<T>, ms: number, providerId: string): Promise<T> {
  let timeout: NodeJS.Timeout;
  const timer = new Promise<never>((_, reject) => {
    timeout = setTimeout(
      () => reject(new Error(`${providerId} timed out after ${ms}ms`)),
      ms,
    );
  });
  return Promise.race([promise, timer]).finally(() => clearTimeout(timeout!));
}

function hasUsableText(content: string | undefined | null): boolean {
  return Boolean(content?.trim());
}

async function invokeProviderTask(
  request: AiTaskRequest,
): Promise<{
  content: string;
  providerUsed: AiTaskResponse["providerUsed"];
  modelUsed: string;
  tokenUsage: AiTaskResponse["tokenUsage"];
  latencyMs: number;
  primary: ProviderId | undefined;
}> {
  const config = loadAiConfig();
  const chain = resolveTaskProviderChain(request.taskType, config).filter((providerId) =>
    providerSupportsTask(providerId, request.taskType),
  );
  const primary = chain[0];

  if (chain.length === 0) {
    throw new AiRouterError(`Task ${request.taskType} does not use an LLM provider`, "unsupported", false);
  }

  const messages = buildMessages(request);
  if (messages.length === 0) {
    throw new AiRouterError("AI task requires at least one message", "validation", false);
  }

  const errors: string[] = [];
  const started = Date.now();

  for (let i = 0; i < chain.length; i++) {
    const providerId = chain[i];
    if (RUNTIME_DISABLED_PROVIDERS.has(providerId)) {
      console.warn("ai_router_provider_skipped", {
        provider: providerId,
        reason: "OpenAI is disabled in Signal87 runtime",
      });
      continue;
    }
    const fallbackTarget = chain[i + 1];
    const provider = getProvider(providerId);

    if (!provider?.isAvailable()) {
      const message = `${providerId}: unavailable`;
      errors.push(message);
      console.info("ai_router_provider_attempt", {
        provider: providerId,
        event: `${providerDisplayName(providerId)} attempted`,
        success: false,
        error: message,
        fallbackTarget,
      });
      logProviderAttempt(
        { provider: providerId, success: false, error: message, fallbackTarget },
        request.onProviderAttempt,
      );
      continue;
    }

    console.info("ai_router_provider_attempt", {
      provider: providerId,
      event: `${providerDisplayName(providerId)} attempted`,
    });

    try {
      const result = await withProviderTimeout(
        provider.generateText({
          messages,
          maxTokens: request.maxTokens ?? config.maxTokens,
          responseFormat: request.structuredOutput ? "json_object" : "text",
        }),
        config.providerTimeoutMs,
        providerId,
      );

      if (!hasUsableText(result.content)) {
        const message = `${providerId}: empty response`;
        errors.push(message);
        logProviderAttempt(
          {
            provider: providerId,
            model: result.model,
            success: false,
            error: message,
            fallbackTarget,
          },
          request.onProviderAttempt,
        );
        continue;
      }

      logProviderAttempt(
        { provider: providerId, model: result.model, success: true },
        request.onProviderAttempt,
      );

      return {
        content: result.content,
        providerUsed: provider.id,
        modelUsed: result.model,
        tokenUsage: result.tokenUsage,
        latencyMs: Date.now() - started,
        primary,
      };
    } catch (err) {
      const classified = classifyProviderError(err);
      const message = `${providerId}: ${classified.message}`;
      errors.push(message);
      logProviderAttempt(
        {
          provider: providerId,
          success: false,
          error: classified.message,
          fallbackTarget,
        },
        request.onProviderAttempt,
      );
    }
  }

  console.warn("ai_router_local_fallback_eligible", {
    taskType: request.taskType,
    message: "Gemini and Grok failed; route may use local extractive fallback",
    errors,
  });

  throw new AiRouterError(
    errors.join("; ") || "No LLM providers available",
    "unavailable",
    false,
  );
}

export async function runTask(
  request: AiTaskRequest,
  logger: AiRouterLogger = defaultLogger,
): Promise<AiTaskResponse> {
  const started = Date.now();

  try {
    const result = await invokeProviderTask(request);
    const response = buildNormalizedResponse({
      request,
      answer: result.content,
      providerUsed: result.providerUsed,
      modelUsed: result.modelUsed,
      fallbackUsed: result.primary !== undefined && result.providerUsed !== result.primary,
      fallbackReason:
        result.primary !== undefined && result.providerUsed !== result.primary
          ? `Primary provider ${result.primary} failed; used ${result.providerUsed}`
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
      providerUsed: "local",
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