import type { AiTaskType, ProviderId } from "./types";

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

function parseProviderOrder(value: string | undefined): ProviderId[] {
  if (!value?.trim()) return [];
  return value
    .split(",")
    .map((part) => parseProviderId(part, "openai"))
    .filter((id, index, all) => all.indexOf(id) === index);
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

export interface AiRuntimeConfig {
  routingEnabled: boolean;
  primaryReasoningProvider: ProviderId;
  primaryExtractionProvider: ProviderId;
  finalFallbackProvider: ProviderId;
  evidenceCompilerProvider: ProviderId;
  qualityReviewProvider: ProviderId;
  embeddingProvider: ProviderId;
  fallbackProviderOrder: ProviderId[];
  models: Record<ProviderId, { chat: string; embedding?: string }>;
  maxTokens: number;
}

export function loadAiConfig(): AiRuntimeConfig {
  return {
    routingEnabled: parseBool(process.env.AI_PROVIDER_ROUTING_ENABLED, true),
    primaryReasoningProvider: parseProviderId(process.env.AI_PRIMARY_REASONING_PROVIDER, "google"),
    primaryExtractionProvider: parseProviderId(process.env.AI_PRIMARY_EXTRACTION_PROVIDER, "google"),
    finalFallbackProvider: parseProviderId(process.env.AI_FINAL_FALLBACK_PROVIDER, "xai"),
    evidenceCompilerProvider: parseProviderId(process.env.AI_EVIDENCE_COMPILER_PROVIDER, "google"),
    qualityReviewProvider: parseProviderId(process.env.AI_QUALITY_REVIEW_PROVIDER, "xai"),
    embeddingProvider: parseProviderId(process.env.AI_EMBEDDING_PROVIDER, "openai"),
    fallbackProviderOrder: parseProviderOrder(process.env.AI_FALLBACK_PROVIDER_ORDER),
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
  if (!config.routingEnabled) return chain;

  const defaultOrder: ProviderId[] = ["openai", "google", "xai"];
  const orderedFallbacks: ProviderId[] = [];
  for (const provider of [...config.fallbackProviderOrder, ...defaultOrder]) {
    if (!orderedFallbacks.includes(provider)) {
      orderedFallbacks.push(provider);
    }
  }

  for (const provider of orderedFallbacks) {
    if (provider !== primary && provider !== config.finalFallbackProvider && !chain.includes(provider)) {
      chain.push(provider);
    }
  }

  if (config.finalFallbackProvider !== primary && !chain.includes(config.finalFallbackProvider)) {
    chain.push(config.finalFallbackProvider);
  }

  return chain;
}

export function getEmbeddingModel(config: AiRuntimeConfig, providerId: ProviderId): string {
  return config.models[providerId].embedding ?? config.models.openai.embedding ?? "text-embedding-3-small";
}

export function getChatModel(config: AiRuntimeConfig, providerId: ProviderId): string {
  return config.models[providerId].chat;
}