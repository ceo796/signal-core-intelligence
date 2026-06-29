import { loadAiConfig } from "./config";
import { getProvider } from "./providers";
import type { ProviderId } from "./types";

export async function generateEmbeddings(texts: string[]): Promise<{
  embeddings: number[][];
  providerUsed: string;
  modelUsed: string;
}> {
  if (texts.length === 0) return { embeddings: [], providerUsed: "local", modelUsed: "none" };

  const config = loadAiConfig();
  const chain = ([config.embeddingProvider, "openai", "google", "xai"] as ProviderId[]).filter(
    (id, index, all) => all.indexOf(id) === index,
  );

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

  throw new Error(`Embedding generation failed: ${errors.join("; ") || "no embedding providers configured"}`);
}

export async function generateEmbedding(text: string): Promise<number[]> {
  const result = await generateEmbeddings([text]);
  return result.embeddings[0] ?? [];
}

export function getEmbeddingModelName(): string {
  const config = loadAiConfig();
  return config.models[config.embeddingProvider].embedding ?? config.models.openai.embedding ?? "text-embedding-3-small";
}