import type { AiTaskType, ProviderId } from "./types";
import { isOpenAiAllowed } from "./openai-policy";

function parseBool(value: string | undefined, defaultValue: boolean): boolean {
  if (value === undefined || value.trim() === "") return defaultValue;
  return ["1", "true", "yes", "on"].includes(value.trim().toLowerCase());
}

function parseProviderId(value: string | undefined, fallback: ProviderId): ProviderId {
  const normalized = (value ?? "").trim().toLowerCase();
  if (normalized === "openai" || normalized === "gpt") return "openai";
  if (normalized === "xai" || normalized === "grok") return "xai";
  if (normalized === "google" || normalized === "gemini") return "google";
  return fallback;
}

function parseProviderOrder(value: string | undefined, fallback: ProviderId[] = []): ProviderId[] {
  if (!value?.trim()) return fallback;
  return value
    .split(",")
    .map((part) => parseProviderId(part, "xai"))
    .filter((id, index, all) => all.indexOf(id) === index);
}

function applyOpenAiPolicy(providerId: ProviderId): ProviderId | null {
  if (providerId === "openai" && !isOpenAiAllowed()) return null;
  return providerId;
}

function effectiveProviderId(providerId: ProviderId, fallback: ProviderId): ProviderId {
  return applyOpenAiPolicy(providerId) ?? fallback;
}

function filterOpenAiFromChain(chain: ProviderId[]): ProviderId[] {
  if (isOpenAiAllowed()) return chain;
  return chain.filter((providerId) => providerId !== "openai");
}

const REASONING_TASKS = new Set<AiTaskType>([
  "document_chat",
  "multi_document_chat",
  "document_summary",
  "document_compare",
  "diligence_memo",
  "executive_brief",
]);

const LOCAL_TASKS = new Set<AiTaskType>(["document_extraction", "table_extraction"]);

/** Default runtime chain: Gemini → Grok (OpenAI excluded unless ALLOW_OPENAI=true). */
const DEFAULT_FALLBACK_ORDER: ProviderId[] = ["xai"];

export interface AiRuntimeConfig {
  routingEnabled: boolean;
  primaryReasoningProvider: ProviderId;
  primaryExtractionProvider: ProviderId;
  finalFallbackProvider: ProviderId;
  evidenceCompilerProvider: ProviderId;
  qualityReviewProvider: ProviderId;
  embeddingProvider: ProviderId;
  fallbackProviderOrder: ProviderId[];
  providerTimeoutMs: number;
  models: Record<ProviderId, { chat: string; embedding?: string }>;
  maxTokens: number;
}

export function loadAiConfig(): AiRuntimeConfig {
  const rawEmbeddingProvider = parseProviderId(process.env.AI_EMBEDDING_PROVIDER, "google");
  return {
    routingEnabled: parseBool(process.env.AI_PROVIDER_ROUTING_ENABLED, true),
    primaryReasoningProvider: effectiveProviderId(
      parseProviderId(process.env.AI_PRIMARY_REASONING_PROVIDER, "google"),
      "google",
    ),
    primaryExtractionProvider: effectiveProviderId(
      parseProviderId(process.env.AI_PRIMARY_EXTRACTION_PROVIDER, "google"),
      "google",
    ),
    finalFallbackProvider: effectiveProviderId(
      parseProviderId(process.env.AI_FINAL_FALLBACK_PROVIDER, "xai"),
      "xai",
    ),
    evidenceCompilerProvider: effectiveProviderId(
      parseProviderId(process.env.AI_EVIDENCE_COMPILER_PROVIDER, "google"),
      "google",
    ),
    qualityReviewProvider: effectiveProviderId(
      parseProviderId(process.env.AI_QUALITY_REVIEW_PROVIDER, "google"),
      "google",
    ),
    embeddingProvider: effectiveProviderId(rawEmbeddingProvider, "google"),
    fallbackProviderOrder: filterOpenAiFromChain(
      parseProviderOrder(process.env.AI_FALLBACK_PROVIDER_ORDER, DEFAULT_FALLBACK_ORDER),
    ),
    providerTimeoutMs: Number(process.env.AI_PROVIDER_TIMEOUT_MS ?? "12000"),
    models: {
      openai: {
        chat: process.env.OPENAI_MODEL?.trim() || "gpt-4o-mini",
        embedding: process.env.OPENAI_EMBEDDING_MODEL?.trim() || "text-embedding-3-small",
      },
      xai: {
        chat: process.env.GROK_MODEL?.trim() || "grok-4.3",
      },
      google: {
        chat: process.env.GEMINI_MODEL?.trim() || "gemini-2.5-flash",
        embedding: process.env.GEMINI_EMBEDDING_MODEL?.trim() || "text-embedding-004",
      },
    },
    maxTokens: Number(process.env.AI_MAX_TOKENS ?? "2048"),
  };
}

export function resolveTaskProviderChain(taskType: AiTaskType, config: AiRuntimeConfig): ProviderId[] {
  if (LOCAL_TASKS.has(taskType)) return [];

  let primary: ProviderId;
  if (REASONING_TASKS.has(taskType)) {
    primary = config.primaryReasoningProvider;
  } else if (taskType === "evidence_compilation") {
    primary = config.evidenceCompilerProvider;
  } else if (taskType === "citation_validation" || taskType === "answer_quality_review") {
    primary = config.qualityReviewProvider;
  } else {
    primary = config.primaryReasoningProvider;
  }

  const chain: ProviderId[] = [primary];
  if (!config.routingEnabled) {
    return filterOpenAiFromChain(chain);
  }

  for (const provider of config.fallbackProviderOrder) {
    if (!chain.includes(provider)) {
      chain.push(provider);
    }
  }

  if (!chain.includes(config.finalFallbackProvider)) {
    chain.push(config.finalFallbackProvider);
  }

  return filterOpenAiFromChain(chain);
}

export function getResolvedProviderChain(
  config: AiRuntimeConfig = loadAiConfig(),
): Record<"document_chat" | "multi_document_chat" | "executive_brief" | "extraction", ProviderId[]> {
  return {
    document_chat: resolveTaskProviderChain("document_chat", config),
    multi_document_chat: resolveTaskProviderChain("multi_document_chat", config),
    executive_brief: resolveTaskProviderChain("executive_brief", config),
    extraction: resolveTaskProviderChain("document_extraction", config),
  };
}

/** @deprecated Use getResolvedProviderChain */
export function getTaskProviderChains(
  config: AiRuntimeConfig = loadAiConfig(),
): Record<"document_chat" | "multi_document_chat" | "executive_brief" | "extraction", ProviderId[]> {
  return getResolvedProviderChain(config);
}

export function isOpenAiEnabled(): boolean {
  return isOpenAiAllowed();
}

/** @deprecated Use isOpenAiEnabled */
export function isOpenAiRuntimeEnabled(_config: AiRuntimeConfig = loadAiConfig()): boolean {
  return isOpenAiEnabled();
}

/** @deprecated OpenAI calls are disabled unless ALLOW_OPENAI=true */
export function isOpenAiCallsEnabled(_config: AiRuntimeConfig = loadAiConfig()): boolean {
  return isOpenAiAllowed() && Boolean(process.env.OPENAI_API_KEY?.trim());
}

export function getResolvedReasoningChain(
  taskType: AiTaskType = "document_chat",
  config: AiRuntimeConfig = loadAiConfig(),
): ProviderId[] {
  return resolveTaskProviderChain(taskType, config);
}

export function getEmbeddingModel(config: AiRuntimeConfig, providerId: ProviderId): string {
  return config.models[providerId].embedding ?? config.models.openai.embedding ?? "text-embedding-3-small";
}

export function getChatModel(config: AiRuntimeConfig, providerId: ProviderId): string {
  return config.models[providerId].chat;
}