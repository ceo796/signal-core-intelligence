export interface ScoredChunk {
  id: number;
  documentId: number;
  chunkIndex: number;
  content: string;
  relevanceScore: number;
}

type RetrievalChunk = { id: number; documentId: number; chunkIndex: number; content: string };

const BM25_K1 = 1.5;
const BM25_B = 0.75;

const STOP_WORDS = new Set([
  "a",
  "an",
  "and",
  "are",
  "as",
  "at",
  "be",
  "been",
  "by",
  "did",
  "do",
  "for",
  "from",
  "has",
  "have",
  "how",
  "in",
  "is",
  "it",
  "many",
  "much",
  "of",
  "on",
  "or",
  "that",
  "the",
  "their",
  "there",
  "these",
  "this",
  "to",
  "was",
  "what",
  "when",
  "where",
  "which",
  "who",
  "why",
  "with",
]);

function tokenize(text: string): string[] {
  return (text.toLowerCase().match(/[a-z0-9]+/g) ?? []).filter(
    (term) => !STOP_WORDS.has(term) && (term.length > 2 || /^\d+$/.test(term)),
  );
}

function computeBm25Score(
  queryTerms: string[],
  docTerms: string[],
  avgDocLength: number,
  docFrequency: Map<string, number>,
  corpusSize: number,
): number {
  if (queryTerms.length === 0 || docTerms.length === 0) return 0;

  const termFrequency = new Map<string, number>();
  for (const term of docTerms) {
    termFrequency.set(term, (termFrequency.get(term) ?? 0) + 1);
  }

  const docLength = docTerms.length;
  let score = 0;

  for (const term of queryTerms) {
    const freq = termFrequency.get(term) ?? 0;
    if (freq === 0) continue;

    const df = docFrequency.get(term) ?? 0;
    const idf = Math.log(1 + (corpusSize - df + 0.5) / (df + 0.5));
    const numerator = freq * (BM25_K1 + 1);
    const denominator = freq + BM25_K1 * (1 - BM25_B + BM25_B * (docLength / Math.max(1, avgDocLength)));
    score += idf * (numerator / denominator);
  }

  return score;
}

function buildBm25Context(chunks: RetrievalChunk[]) {
  const docTerms = chunks.map((chunk) => tokenize(chunk.content));
  const lengths = docTerms.map((terms) => terms.length);
  const avgDocLength = lengths.reduce((sum, len) => sum + len, 0) / Math.max(1, lengths.length);
  const docFrequency = new Map<string, number>();

  for (const terms of docTerms) {
    for (const term of new Set(terms)) {
      docFrequency.set(term, (docFrequency.get(term) ?? 0) + 1);
    }
  }

  return { docTerms, avgDocLength, docFrequency, corpusSize: chunks.length };
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

  const stops = new Set([
    "how",
    "what",
    "when",
    "where",
    "who",
    "why",
    "much",
    "many",
    "often",
    "times",
    "was",
    "has",
    "been",
    "the",
    "a",
    "an",
    "is",
    "are",
    "to",
    "do",
    "did",
  ]);
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

function scoreChunksLocally(
  question: string,
  chunks: RetrievalChunk[],
  bm25Context: ReturnType<typeof buildBm25Context>,
  fallbacks: Set<string>,
): ScoredChunk[] {
  const queryTerms = [...new Set(tokenize(question))];

  return chunks
    .map((chunk, index) => {
      const bm25 = computeBm25Score(
        queryTerms,
        bm25Context.docTerms[index],
        bm25Context.avgDocLength,
        bm25Context.docFrequency,
        bm25Context.corpusSize,
      );
      const keyword = fallbacks.size > 0 ? keywordBoostScore(chunk.content, fallbacks) : 0;
      const maxBm25 = Math.max(1, bm25);
      const blended = (bm25 / maxBm25) * 0.75 + keyword * 0.25;
      return { ...chunk, relevanceScore: blended } satisfies ScoredChunk;
    })
    .filter((chunk) => chunk.relevanceScore > 0 || queryTerms.length === 0);
}

/**
 * Retrieve relevant chunks using local BM25-style keyword retrieval with optional
 * name/payment keyword boosts. No external embedding providers are called.
 */
export async function retrieveRelevantChunks(
  question: string,
  chunks: RetrievalChunk[],
  topK = 5,
): Promise<ScoredChunk[]> {
  const nonEmpty = chunks.filter((c) => c.content.trim().length > 0);
  if (nonEmpty.length === 0) return [];

  const fallbacks = extractKeywordFallbacks(question);
  const bm25Context = buildBm25Context(nonEmpty);
  const scored = scoreChunksLocally(question, nonEmpty, bm25Context, fallbacks);

  if (scored.length === 0) {
    return nonEmpty.slice(0, topK).map((chunk) => ({ ...chunk, relevanceScore: 0 }));
  }

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

// Multi-document retrieval: scores the question once per corpus, then selects the
// top-K chunks PER document so every selected document is represented.
export async function retrieveAcrossDocuments(
  question: string,
  groups: DocumentGroup[],
  perDocTopK = 3,
): Promise<DocumentRetrieval[]> {
  const allChunks = groups.flatMap((group) => group.chunks).filter((c) => c.content.trim().length > 0);
  const fallbacks = extractKeywordFallbacks(question);
  const bm25Context = allChunks.length > 0 ? buildBm25Context(allChunks) : null;
  const chunkOffsetById = new Map(allChunks.map((chunk, index) => [chunk.id, index]));

  return groups.map((group) => {
    const nonEmpty = group.chunks.filter((c) => c.content.trim().length > 0);
    if (nonEmpty.length === 0 || !bm25Context) {
      return {
        documentId: group.documentId,
        documentName: group.documentName,
        chunksSearched: group.chunks.length,
        retrieved: [],
      };
    }

    const scored = nonEmpty
      .map((chunk) => {
        const index = chunkOffsetById.get(chunk.id);
        if (index === undefined) return null;
        const bm25 = computeBm25Score(
          [...new Set(tokenize(question))],
          bm25Context.docTerms[index],
          bm25Context.avgDocLength,
          bm25Context.docFrequency,
          bm25Context.corpusSize,
        );
        const keyword = fallbacks.size > 0 ? keywordBoostScore(chunk.content, fallbacks) : 0;
        const maxBm25 = Math.max(1, bm25);
        const blended = (bm25 / maxBm25) * 0.75 + keyword * 0.25;
        return { ...chunk, relevanceScore: blended } satisfies ScoredChunk;
      })
      .filter((chunk): chunk is ScoredChunk => Boolean(chunk));

    scored.sort((a, b) => b.relevanceScore - a.relevanceScore);

    return {
      documentId: group.documentId,
      documentName: group.documentName,
      chunksSearched: group.chunks.length,
      retrieved: scored.slice(0, perDocTopK),
    };
  });
}

