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

/**
 * Extract keyword fallback variants from a name-based query.
 * Returns a set of lowercase keywords to boost in retrieval.
 */
function extractKeywordFallbacks(question: string): Set<string> {
  const lower = question.toLowerCase().trim();
  const fallbacks = new Set<string>();

  // Extract quoted names (exact match)
  const quoted = lower.match(/"([^"]+)"/g);
  if (quoted) {
    for (const q of quoted) {
      fallbacks.add(q.replace(/"/g, ""));
    }
  }

  // Look for capitalized words (likely names) — extract first + last
  const nameWords = question.match(/\b[A-Z][a-z]+\b/g);
  if (nameWords && nameWords.length >= 2) {
    const first = nameWords[0].toLowerCase();
    const last = nameWords[nameWords.length - 1].toLowerCase();
    fallbacks.add(first);
    fallbacks.add(last);
    fallbacks.add(`${first} ${last}`);
  } else if (nameWords && nameWords.length === 1) {
    fallbacks.add(nameWords[0].toLowerCase());
  }

  // Add financial-related terms if the question is about payment/amount
  const paymentTerms = ["paid", "amount", "payment", "expenditure", "cost", "price", "salary", "fee"];
  if (paymentTerms.some((t) => lower.includes(t))) {
    for (const t of paymentTerms) {
      if (lower.includes(t)) {
        fallbacks.add(t);
      }
    }
  }

  // Remove stop words and generic terms
  const stops = new Set(["how", "what", "when", "where", "who", "why", "much", "many", "often", "times", "was", "has", "been", "the", "a", "an", "is", "are", "to", "do", "did"]);
  for (const word of [...fallbacks]) {
    if (stops.has(word)) {
      fallbacks.delete(word);
    }
  }

  return fallbacks;
}

function keywordBoostScore(chunk: string, fallbacks: Set<string>): number {
  const lower = chunk.toLowerCase();
  let score = 0;
  for (const kw of fallbacks) {
    if (lower.includes(kw)) {
      score += 1.0;
    }
  }
  return score / Math.max(1, fallbacks.size);
}

/**
 * Retrieve relevant chunks using semantic search, then boost chunks that contain
 * keyword matches from the query. For name-based or financial queries, this
 * improves recall of partial-name matches and row-level data.
 */
export async function retrieveRelevantChunks(
  question: string,
  chunks: { id: number; documentId: number; chunkIndex: number; content: string }[],
  topK = 5
): Promise<ScoredChunk[]> {
  const nonEmpty = chunks.filter((c) => c.content.trim().length > 0);
  if (nonEmpty.length === 0) {
    return [];
  }

  const questionEmbedding = await getEmbedding(question);

  const embedResponse = await openai.embeddings.create({
    model: PROVIDER_CONFIG.embeddingModel,
    input: nonEmpty.map((c) => c.content),
  });

  const fallbacks = extractKeywordFallbacks(question);

  const scored: ScoredChunk[] = nonEmpty.map((chunk, i) => {
    const semantic = cosineSimilarity(questionEmbedding, embedResponse.data[i].embedding);
    const keyword = fallbacks.size > 0 ? keywordBoostScore(chunk.content, fallbacks) : 0;
    // Blend: 75% semantic + 25% keyword. For small keyword sets, give a small boost.
    const blended = semantic * 0.75 + keyword * 0.25;
    return {
      ...chunk,
      relevanceScore: blended,
    };
  });

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

    const nonEmpty = group.chunks.filter((c) => c.content.trim().length > 0);
    if (nonEmpty.length === 0) {
      results.push({
        documentId: group.documentId,
        documentName: group.documentName,
        chunksSearched: group.chunks.length,
        retrieved: [],
      });
      continue;
    }

    const embedResponse = await openai.embeddings.create({
      model: PROVIDER_CONFIG.embeddingModel,
      input: nonEmpty.map((c) => c.content),
    });

    const fallbacks = extractKeywordFallbacks(question);

    const scored: ScoredChunk[] = nonEmpty.map((chunk, i) => {
      const semantic = cosineSimilarity(questionEmbedding, embedResponse.data[i].embedding);
      const keyword = fallbacks.size > 0 ? keywordBoostScore(chunk.content, fallbacks) : 0;
      const blended = semantic * 0.75 + keyword * 0.25;
      return {
        ...chunk,
        relevanceScore: blended,
      };
    });

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
