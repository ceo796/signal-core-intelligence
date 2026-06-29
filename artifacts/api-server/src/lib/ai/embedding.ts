import type { ProviderId } from "./types";

const LOCAL_EMBEDDING_MODEL = "local-bm25";

export async function generateEmbeddings(texts: string[]): Promise<{
  embeddings: number[][];
  providerUsed: string;
  modelUsed: string;
}> {
  if (texts.length === 0) {
    return { embeddings: [], providerUsed: "local", modelUsed: LOCAL_EMBEDDING_MODEL };
  }

  return {
    embeddings: texts.map(() => []),
    providerUsed: "local",
    modelUsed: LOCAL_EMBEDDING_MODEL,
  };
}

export async function generateEmbedding(_text: string): Promise<number[]> {
  return [];
}

export function getEmbeddingModelName(): string {
  return LOCAL_EMBEDDING_MODEL;
}

export function getEmbeddingMode(): "local" {
  return "local";
}

export function isRemoteEmbeddingEnabled(): boolean {
  return false;
}

export function getEmbeddingProviderChain(): ProviderId[] {
  return [];
}