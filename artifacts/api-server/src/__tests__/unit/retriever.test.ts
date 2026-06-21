import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../lib/ai-provider.js", () => ({
  openai: {
    embeddings: {
      create: vi.fn(),
    },
  },
  PROVIDER_CONFIG: {
    provider: "openai",
    model: "gpt-4o-mini",
    embeddingModel: "text-embedding-3-small",
    maxTokens: 2048,
  },
}));

import { retrieveRelevantChunks, retrieveAcrossDocuments } from "../../lib/retriever.js";
import { openai } from "../../lib/ai-provider.js";

const mockCreate = vi.mocked(openai.embeddings.create);

/** Build a unit vector of the given dimension with `1.0` at position `hotIndex`. */
function oneHotEmbedding(dimension: number, hotIndex: number): number[] {
  const v = new Array(dimension).fill(0);
  v[hotIndex] = 1;
  return v;
}

/** Sample chunks for tests — each has a distinct "topic" via hot-index embedding. */
function makeSampleChunks(count: number) {
  return Array.from({ length: count }, (_, i) => ({
    id: i + 1,
    documentId: 1,
    chunkIndex: i,
    content: `Chunk ${i + 1} content about topic ${i + 1}`,
  }));
}

describe("retrieveRelevantChunks", () => {
  const DIM = 10;

  beforeEach(() => {
    mockCreate.mockReset();
  });

  it("returns top-K chunks by cosine similarity", async () => {
    const chunks = makeSampleChunks(5);

    // Query embedding aligns with chunk index 2 (0-based)
    const queryEmbedding = oneHotEmbedding(DIM, 2);

    mockCreate
      .mockResolvedValueOnce({
        data: [{ embedding: queryEmbedding }],
      } as never)
      .mockResolvedValueOnce({
        data: chunks.map((_, i) => ({ embedding: oneHotEmbedding(DIM, i) })),
      } as never);

    const results = await retrieveRelevantChunks("test question", chunks, 3);

    expect(results).toHaveLength(3);
    // The top result should be chunk index 2 (perfect cosine alignment)
    expect(results[0].chunkIndex).toBe(2);
    // Blended score: 0.75 semantic + 0.25 keyword. No keyword match here, so 0.75.
    expect(results[0].relevanceScore).toBeCloseTo(0.75, 5);
  });

  it("returns empty array when no chunks are provided", async () => {
    const results = await retrieveRelevantChunks("test question", [], 5);
    expect(results).toHaveLength(0);
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it("returns empty array when all chunks have blank content", async () => {
    const blankChunks = [
      { id: 1, documentId: 1, chunkIndex: 0, content: "   " },
      { id: 2, documentId: 1, chunkIndex: 1, content: "\t" },
    ];
    const results = await retrieveRelevantChunks("test question", blankChunks, 5);
    expect(results).toHaveLength(0);
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it("returns all chunks when topK >= chunk count", async () => {
    const chunks = makeSampleChunks(3);
    const queryEmbedding = oneHotEmbedding(DIM, 0);

    mockCreate
      .mockResolvedValueOnce({ data: [{ embedding: queryEmbedding }] } as never)
      .mockResolvedValueOnce({
        data: chunks.map((_, i) => ({ embedding: oneHotEmbedding(DIM, i) })),
      } as never);

    const results = await retrieveRelevantChunks("question", chunks, 10);
    expect(results).toHaveLength(3);
  });

  it("results are sorted by descending relevance score", async () => {
    const chunks = makeSampleChunks(4);
    // Query aligns with chunk index 1
    const queryEmbedding = oneHotEmbedding(DIM, 1);

    mockCreate
      .mockResolvedValueOnce({ data: [{ embedding: queryEmbedding }] } as never)
      .mockResolvedValueOnce({
        data: chunks.map((_, i) => ({ embedding: oneHotEmbedding(DIM, i) })),
      } as never);

    const results = await retrieveRelevantChunks("question", chunks, 4);

    for (let i = 0; i < results.length - 1; i++) {
      expect(results[i].relevanceScore).toBeGreaterThanOrEqual(
        results[i + 1].relevanceScore
      );
    }
  });

  it("includes chunkIndex and content on each result", async () => {
    const chunks = makeSampleChunks(2);
    const queryEmbedding = oneHotEmbedding(DIM, 0);

    mockCreate
      .mockResolvedValueOnce({ data: [{ embedding: queryEmbedding }] } as never)
      .mockResolvedValueOnce({
        data: chunks.map((_, i) => ({ embedding: oneHotEmbedding(DIM, i) })),
      } as never);

    const results = await retrieveRelevantChunks("question", chunks, 2);
    for (const r of results) {
      expect(r).toHaveProperty("chunkIndex");
      expect(r).toHaveProperty("content");
      expect(r).toHaveProperty("relevanceScore");
      expect(r).toHaveProperty("documentId");
    }
  });
});

describe("retrieveAcrossDocuments", () => {
  const DIM = 6;

  beforeEach(() => {
    mockCreate.mockReset();
  });

  it("returns one DocumentRetrieval per group", async () => {
    const groups = [
      {
        documentId: 1,
        documentName: "Doc A",
        chunks: [{ id: 1, documentId: 1, chunkIndex: 0, content: "Content A1" }],
      },
      {
        documentId: 2,
        documentName: "Doc B",
        chunks: [{ id: 2, documentId: 2, chunkIndex: 0, content: "Content B1" }],
      },
    ];

    // Query embedding call + one embed-chunks call per document
    mockCreate
      .mockResolvedValueOnce({ data: [{ embedding: oneHotEmbedding(DIM, 0) }] } as never)
      .mockResolvedValueOnce({ data: [{ embedding: oneHotEmbedding(DIM, 0) }] } as never)
      .mockResolvedValueOnce({ data: [{ embedding: oneHotEmbedding(DIM, 1) }] } as never);

    const results = await retrieveAcrossDocuments("question", groups, 3);
    expect(results).toHaveLength(2);
    expect(results[0].documentId).toBe(1);
    expect(results[1].documentId).toBe(2);
  });

  it("returns empty retrieved array for a group with no chunks", async () => {
    const groups = [
      {
        documentId: 1,
        documentName: "Empty Doc",
        chunks: [],
      },
    ];
    mockCreate.mockResolvedValueOnce({
      data: [{ embedding: oneHotEmbedding(DIM, 0) }],
    } as never);

    const results = await retrieveAcrossDocuments("question", groups, 3);
    expect(results[0].retrieved).toHaveLength(0);
    expect(results[0].chunksSearched).toBe(0);
  });

  it("reports chunksSearched on each result", async () => {
    const chunks = Array.from({ length: 4 }, (_, i) => ({
      id: i + 1,
      documentId: 1,
      chunkIndex: i,
      content: `content ${i}`,
    }));
    const groups = [{ documentId: 1, documentName: "Doc A", chunks }];

    mockCreate
      .mockResolvedValueOnce({ data: [{ embedding: oneHotEmbedding(DIM, 0) }] } as never)
      .mockResolvedValueOnce({
        data: chunks.map((_, i) => ({ embedding: oneHotEmbedding(DIM, i) })),
      } as never);

    const results = await retrieveAcrossDocuments("question", groups, 2);
    expect(results[0].chunksSearched).toBe(4);
    expect(results[0].retrieved).toHaveLength(2);
  });
});
