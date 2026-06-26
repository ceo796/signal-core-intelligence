import { and, eq, inArray } from "drizzle-orm";
import { db, chunkEmbeddingsTable } from "@workspace/db";
import { openai, PROVIDER_CONFIG } from "./ai-provider";

export interface ScoredChunk {
  id: number;
  documentId: number;
  chunkIndex: number;
  content: string;
  relevanceScore: number;
}

type RetrievalChunk = { id: number; documentId: number; chunkIndex: number; content: string };

export async function getEmbedding(text: string): Promise<number[]> {
  const response = await openai.embeddings.create({
    model: PROVIDER_CONFIG.embeddingModel,
    input: text,
  });
  return response.data[0].embedding;
}

async function getEmbeddings(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];
  const response = await openai.embeddings.create({
    model: PROVIDER_CONFIG.embeddingModel,
    input: texts,
  });
  return response.data.map((item) => item.embedding);
}

function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  const len = Math.min(a.length, b.length);
  for (let i = 0; i < len; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}

function isMissingEmbeddingsTable(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  const message = err.message.toLowerCase();
  return message.includes("chunk_embeddings") && (message.includes("does not exist") || message.includes("relation"));
}

async function readPersistedEmbeddings(chunkIds: number[]): Promise<Map<number, number[]>> {
  if (chunkIds.length === 0) return new Map();

  const rows = await db
    .select({ chunkId: chunkEmbeddingsTable.chunkId, embedding: chunkEmbeddingsTable.embedding })
    .from(chunkEmbeddingsTable)
    .where(and(inArray(chunkEmbeddingsTable.chunkId, chunkIds), eq(chunkEmbeddingsTable.model, PROVIDER_CONFIG.embeddingModel)));

  return new Map(rows.map((row) => [row.chunkId, row.embedding]));
}

async function persistEmbeddings(chunks: RetrievalChunk[], embeddings: number[][]): Promise<void> {
  if (chunks.length === 0) return;

  const now = new Date();
  const values = chunks.map((chunk, i) => ({
    chunkId: chunk.id,
    model: PROVIDER_CONFIG.embeddingModel,
    dimensions: embeddings[i].length,
    embedding: embeddings[i],
    createdAt: now,
    updatedAt: now,
  }));

  await db
    .insert(chunkEmbeddingsTable)
    .values(values)
    .onConflictDoUpdate({
      target: [chunkEmbeddingsTable.chunkId, chunkEmbeddingsTable.model],
      set: {
        dimensions: values[0].dimensions,
        embedding: values[0].embedding,
        updatedAt: now,
      },
    });
}

async function getOrCreateChunkEmbeddings(chunks: RetrievalChunk[]): Promise<Map<number, number[]>> {
  const nonEmpty = chunks.filter((c) => c.content.trim().length > 0);
  if (nonEmpty.length === 0) return new Map();

  const byId = new Map(nonEmpty.map((chunk) => [chunk.id, chunk]));
  let existing = new Map<number, number[]>();

  try {
    existing = await readPersistedEmbeddings([...byId.keys()]);
  } catch (err) {
    if (!isMissingEmbeddingsTable(err)) throw err;
    // Safe migration path: until the DB schema is pushed, fall back to live embeddings.
    const embeddings = await getEmbeddings(nonEmpty.map((chunk) => chunk.content));
    return new Map(nonEmpty.map((chunk, i) => [chunk.id, embeddings[i]]));
  }

  const missing = nonEmpty.filter((chunk) => !existing.has(chunk.id));
  if (missing.length === 0) return existing;

  const generated = await getEmbeddings(missing.map((chunk) => chunk.content));
  generated.forEach((embedding, i) => existing.set(missing[i].id, embedding));

  try {
    await persistEmbeddings(missing, generated);
  } catch (err) {
    // Retrieval must not fail because cache persistence failed.
    if (!isMissingEmbeddingsTable(err)) {
      console.warn("Failed to persist chunk embeddings; continuing with live embeddings", err);
    }
  }

  return existing;
}

/**
 * Extract keyword fallback variants from a name-based query.
 * Returns a set of lowercase keywords to boost in retrieval.
 */
function extractKeywordFallbacks(question: string): Set<string> {
  const lower = question.toLowerCase().trim();
  const fallbacks = new Set<string>();

  const quoted = lower.match(/"([^"]+)"/g);
  if (quoted) {
    for (const q of quoted) {
      fallbacks.add(q.replace(/"/g, ""));
    }
  }

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

  const paymentTerms = ["paid", "amount", "payment", "expenditure", "cost", "price", "salary", "fee"];
  if (paymentTerms.some((t) => lower.includes(t))) {
    for (const t of paymentTerms) {
      if (lower.includes(t)) {
        fallbacks.add(t);
      }
    }
  }

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

function scoreChunks(questionEmbedding: number[], chunks: RetrievalChunk[], embeddingsByChunkId: Map<number, number[]>, fallbacks: Set<string>): ScoredChunk[] {
  return chunks
    .map((chunk) => {
      const embedding = embeddingsByChunkId.get(chunk.id);
      if (!embedding) return null;
      const semantic = cosineSimilarity(questionEmbedding, embedding);
      const keyword = fallbacks.size > 0 ? keywordBoostScore(chunk.content, fallbacks) : 0;
      const blended = semantic * 0.75 + keyword * 0.25;
      return { ...chunk, relevanceScore: blended } satisfies ScoredChunk;
    })
    .filter((chunk): chunk is ScoredChunk => Boolean(chunk));
}

/**
 * Retrieve relevant chunks using semantic search, then boost chunks that contain
 * keyword matches from the query. Chunk embeddings are persisted in Postgres when
 * the chunk_embeddings table exists; until then retrieval falls back safely.
 */
export async function retrieveRelevantChunks(
  question: string,
  chunks: RetrievalChunk[],
  topK = 5
): Promise<ScoredChunk[]> {
  const nonEmpty = chunks.filter((c) => c.content.trim().length > 0);
  if (nonEmpty.length === 0) return [];

  const questionEmbedding = await getEmbedding(question);
  const embeddingsByChunkId = await getOrCreateChunkEmbeddings(nonEmpty);
  const fallbacks = extractKeywordFallbacks(question);

  const scored = scoreChunks(questionEmbedding, nonEmpty, embeddingsByChunkId, fallbacks);
  scored.sort((a, b) => b.relevanceScore - a.relevanceScore);
  return scored.slice(0, topK);
}

export interface DocumentGroup {
  documentId: number;
  documentName: string;
  chunks: RetrievalChunk[];
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
  const fallbacks = extractKeywordFallbacks(question);
  const allChunks = groups.flatMap((group) => group.chunks).filter((c) => c.content.trim().length > 0);
  const embeddingsByChunkId = await getOrCreateChunkEmbeddings(allChunks);

  return groups.map((group) => {
    const nonEmpty = group.chunks.filter((c) => c.content.trim().length > 0);
    const scored = scoreChunks(questionEmbedding, nonEmpty, embeddingsByChunkId, fallbacks);
    scored.sort((a, b) => b.relevanceScore - a.relevanceScore);

    return {
      documentId: group.documentId,
      documentName: group.documentName,
      chunksSearched: group.chunks.length,
      retrieved: scored.slice(0, perDocTopK),
    };
  });
}
