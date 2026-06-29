export interface ScoredChunk {
  id: number;
  documentId: number;
  chunkIndex: number;
  content: string;
  relevanceScore: number;
}

type RetrievalChunk = { id: number; documentId: number; chunkIndex: number; content: string };

const STOP_WORDS = new Set([
  "a", "an", "and", "are", "as", "at", "be", "been", "by", "can", "did", "do", "does", "for", "from",
  "had", "has", "have", "how", "i", "if", "in", "is", "it", "many", "much", "of", "on", "or", "that",
  "the", "their", "this", "to", "was", "were", "what", "when", "where", "which", "who", "why", "with", "you",
]);

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9$.,%-]+/g, " ")
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 2 && !STOP_WORDS.has(token));
}

function extractQuotedPhrases(text: string): string[] {
  return [...text.toLowerCase().matchAll(/"([^"]+)"/g)]
    .map((match) => match[1]?.trim())
    .filter((phrase): phrase is string => Boolean(phrase));
}

function extractNameTerms(question: string): string[] {
  const nameWords = question.match(/\b[A-Z][a-z]+\b/g) ?? [];
  if (nameWords.length === 0) return [];
  const lowered = nameWords.map((word) => word.toLowerCase());
  const terms = new Set(lowered);
  if (lowered.length >= 2) {
    terms.add(`${lowered[0]} ${lowered[lowered.length - 1]}`);
  }
  return [...terms];
}

function extractQueryTerms(question: string): string[] {
  const terms = new Set<string>();
  for (const token of tokenize(question)) terms.add(token);
  for (const phrase of extractQuotedPhrases(question)) terms.add(phrase);
  for (const name of extractNameTerms(question)) terms.add(name);
  return [...terms];
}

function countOccurrences(haystack: string, needle: string): number {
  if (!needle) return 0;
  let count = 0;
  let index = 0;
  while ((index = haystack.indexOf(needle, index)) !== -1) {
    count += 1;
    index += needle.length;
  }
  return count;
}

function scoreChunk(question: string, chunk: RetrievalChunk): number {
  const terms = extractQueryTerms(question);
  const text = chunk.content.toLowerCase();
  if (terms.length === 0) return 0;

  let exactHits = 0;
  let weightedHits = 0;
  for (const term of terms) {
    const hits = countOccurrences(text, term);
    if (hits > 0) {
      exactHits += 1;
      weightedHits += Math.min(hits, 5) * (term.includes(" ") ? 2.5 : 1);
    }
  }

  const coverage = exactHits / terms.length;
  const density = weightedHits / Math.max(1, tokenize(chunk.content).length);
  const earlyBoost = chunk.chunkIndex < 3 ? 0.05 : 0;
  return coverage + density + earlyBoost;
}

function localRetrieve(question: string, chunks: RetrievalChunk[], topK: number): ScoredChunk[] {
  const scored = chunks
    .filter((chunk) => chunk.content.trim().length > 0)
    .map((chunk) => ({
      ...chunk,
      relevanceScore: scoreChunk(question, chunk),
    }))
    .sort((a, b) => b.relevanceScore - a.relevanceScore || a.chunkIndex - b.chunkIndex);

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

export async function retrieveRelevantChunks(
  question: string,
  chunks: RetrievalChunk[],
  topK = 5,
): Promise<ScoredChunk[]> {
  return localRetrieve(question, chunks, topK);
}

export async function retrieveAcrossDocuments(
  question: string,
  groups: DocumentGroup[],
  perDocTopK = 3,
): Promise<DocumentRetrieval[]> {
  return groups.map((group) => ({
    documentId: group.documentId,
    documentName: group.documentName,
    chunksSearched: group.chunks.length,
    retrieved: localRetrieve(question, group.chunks, perDocTopK),
  }));
}
