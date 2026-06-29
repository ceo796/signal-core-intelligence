/**
 * @deprecated Import from `./ai` instead. This shim preserves backward compatibility
 * for tests and legacy imports while the platform migrates to aiRouter.
 */
import { aiRouter, generateEmbedding, getEmbeddingModelName, loadAiConfig, listAvailableProviders } from "./ai";
import type { ProviderId } from "./ai/types";

const config = loadAiConfig();

export const PROVIDER_CONFIG = {
  provider: config.primaryReasoningProvider,
  model: config.models[config.primaryReasoningProvider].chat,
  fallbackProvider: config.finalFallbackProvider,
  fallbackModel: config.models[config.finalFallbackProvider].chat,
  geminiProvider: "google" as ProviderId,
  geminiModel: config.models.google.chat,
  embeddingModel: getEmbeddingModelName(),
  maxTokens: config.maxTokens,
};

export type LlmProviderName = ProviderId;

export interface CreateChatCompletionOptions {
  messages: Array<{ role: "system" | "user" | "assistant"; content: string }>;
  max_tokens?: number;
  response_format?: { type: "json_object" };
}

export interface ChatCompletionResult {
  content: string;
  provider: ProviderId;
  model: string;
  fallbackUsed: boolean;
  primaryError: string | null;
}

export async function createChatCompletion(
  opts: CreateChatCompletionOptions,
): Promise<ChatCompletionResult> {
  const result = await aiRouter.runTask({
    taskType: "document_chat",
    messages: opts.messages,
    maxTokens: opts.max_tokens,
    structuredOutput: opts.response_format?.type === "json_object",
  });

  return {
    content: result.answer ?? "",
    provider: result.providerUsed === "local" ? config.primaryReasoningProvider : result.providerUsed,
    model: result.modelUsed,
    fallbackUsed: result.fallbackUsed,
    primaryError: result.fallbackReason,
  };
}

export const grokAvailable = listAvailableProviders().includes("xai");
export const geminiAvailable = listAvailableProviders().includes("google");

/** @deprecated Provider SDKs are only used inside ai/providers adapters. */
export const openai = undefined;
/** @deprecated Provider SDKs are only used inside ai/providers adapters. */
export const grok = undefined;
/** @deprecated Provider SDKs are only used inside ai/providers adapters. */
export const gemini = undefined;

export async function getEmbedding(text: string): Promise<number[]> {
  return generateEmbedding(text);
}