import { loadAiConfig } from "./config";
import { isOpenAiAllowed } from "./openai-policy";
import { getProvider } from "./providers";
import type { ProviderId } from "./types";

const LOCAL_EMBEDDING_MODEL = "local-bm25";

export type EmbeddingStatus = "disabled" | "local" | "gemini" | "openai";

export async function generateEmbeddings(texts: string[]): Promise<{
  embeddings: number[][];
  providerUsed: string;
  modelUsed: string;
}> {
  if (texts.length === 0) {
    return { embeddings: [], providerUsed: "local", modelUsed: LOCAL_EMBEDDING_MODEL };
  }

  const config = loadAiConfig();
  const chain = getEmbeddingProviderChain(config);

  const errors: string[] = [];
  for (const providerId of chain) {
    const provider = getProvider(providerId);
    if (!provider?.isAvailable() || !provider.generateEmbeddings) continue;
    try {
      const result = await provider.generateEmbeddings(texts);
      return {
        embeddings: result.embeddings,
        providerUsed: provider.id,
        modelUsed: result.model,
      };
    } catch (err) {
      errors.push(`${provider.id}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  console.warn("embedding_local_fallback", {
    message: "No remote embedding provider available; using local keyword retrieval",
    errors,
  });

  return {
    embeddings: texts.map(() => []),
    providerUsed: "local",
    modelUsed: LOCAL_EMBEDDING_MODEL,
  };
}

export async function generateEmbedding(text: string): Promise<number[]> {
  const result = await generateEmbeddings([text]);
  return result.embeddings[0] ?? [];
}

export function getEmbeddingProviderChain(config = loadAiConfig()): ProviderId[] {
  const candidates = [config.embeddingProvider, "google", "openai", "xai"] as ProviderId[];
  return candidates
    .filter((id) => id !== "openai" || isOpenAiAllowed())
    .filter((id, index, all) => all.indexOf(id) === index);
}

export function getEmbeddingStatus(): EmbeddingStatus {
  if (!isOpenAiAllowed() && loadAiConfig().embeddingProvider === "openai") {
    return "disabled";
  }

  const chain = getEmbeddingProviderChain();
  for (const providerId of chain) {
    const provider = getProvider(providerId);
    if (!provider?.isAvailable() || !provider.generateEmbeddings) continue;
    if (providerId === "google") return "gemini";
    if (providerId === "openai") return "openai";
  }

  return "local";
}

export function getEmbeddingModelName(): string {
  const status = getEmbeddingStatus();
  if (status === "gemini") {
    const config = loadAiConfig();
    return config.models.google.embedding ?? "text-embedding-004";
  }
  if (status === "openai") {
    const config = loadAiConfig();
    return config.models.openai.embedding ?? "text-embedding-3-small";
  }
  return LOCAL_EMBEDDING_MODEL;
}

/** @deprecated Use getEmbeddingStatus */
export function getEmbeddingMode(): "openai" | "local" {
  const status = getEmbeddingStatus();
  return status === "openai" ? "openai" : "local";
}

export function isRemoteEmbeddingEnabled(): boolean {
  const status = getEmbeddingStatus();
  return status === "gemini" || status === "openai";
}