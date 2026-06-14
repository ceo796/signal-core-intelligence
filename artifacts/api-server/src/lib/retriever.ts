import { openai, PROVIDER_CONFIG } from "./ai-provider";

export interface ScoredChunk {
  id: number;
  documentId: number;
  chunkIndex: number;
  content: string;
  relevanceScore: number;
}

export async function getEmbedding(text: string): Promise<number[]> {
  const response = await openai.embeddings.create({
    model: PROVIDER_CONFIG.embeddingModel,
    input: text,
  });
  return response.data[0].embedding;
}

function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}

export async function retrieveRelevantChunks(
  question: string,
  chunks: { id: number; documentId: number; chunkIndex: number; content: string }[],
  topK = 5
): Promise<ScoredChunk[]> {
  const questionEmbedding = await getEmbedding(question);

  const chunkTexts = chunks.map((c) => c.content);
  const embedResponse = await openai.embeddings.create({
    model: PROVIDER_CONFIG.embeddingModel,
    input: chunkTexts,
  });

  const scored: ScoredChunk[] = chunks.map((chunk, i) => ({
    ...chunk,
    relevanceScore: cosineSimilarity(questionEmbedding, embedResponse.data[i].embedding),
  }));

  scored.sort((a, b) => b.relevanceScore - a.relevanceScore);
  return scored.slice(0, topK);
}

export interface DocumentGroup {
  documentId: number;
  documentName: string;
  chunks: { id: number; documentId: number; chunkIndex: number; content: string }[];
}

export interface DocumentRetrieval {
  documentId: number;
  documentName: string;
  chunksSearched: number;
  retrieved: ScoredChunk[];
}

// Multi-document retrieval: embeds the question once, then scores and selects the
// top-K chunks PER document so every selected document is represented and we can
// report a per-document breakdown. Document identity is preserved on every chunk.
export async function retrieveAcrossDocuments(
  question: string,
  groups: DocumentGroup[],
  perDocTopK = 3
): Promise<DocumentRetrieval[]> {
  const questionEmbedding = await getEmbedding(question);

  const results: DocumentRetrieval[] = [];
  for (const group of groups) {
    if (group.chunks.length === 0) {
      results.push({
        documentId: group.documentId,
        documentName: group.documentName,
        chunksSearched: 0,
        retrieved: [],
      });
      continue;
    }

    const embedResponse = await openai.embeddings.create({
      model: PROVIDER_CONFIG.embeddingModel,
      input: group.chunks.map((c) => c.content),
    });

    const scored: ScoredChunk[] = group.chunks.map((chunk, i) => ({
      ...chunk,
      relevanceScore: cosineSimilarity(questionEmbedding, embedResponse.data[i].embedding),
    }));

    scored.sort((a, b) => b.relevanceScore - a.relevanceScore);

    results.push({
      documentId: group.documentId,
      documentName: group.documentName,
      chunksSearched: group.chunks.length,
      retrieved: scored.slice(0, perDocTopK),
    });
  }

  return results;
}
