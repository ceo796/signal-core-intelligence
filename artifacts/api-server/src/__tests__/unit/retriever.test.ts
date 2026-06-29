import { describe, it, expect } from "vitest";
import { retrieveRelevantChunks, retrieveAcrossDocuments } from "../../lib/retriever.js";

const CHUNK_ID_BASE = 9_000_000;

function makeSampleChunks(count: number) {
  return Array.from({ length: count }, (_, i) => ({
    id: CHUNK_ID_BASE + i + 1,
    documentId: 1,
    chunkIndex: i,
    content: `Chunk ${i + 1} content about topic ${i + 1} and pricing details`,
  }));
}

describe("retrieveRelevantChunks", () => {
  it("returns top-K chunks by local BM25-style keyword relevance", async () => {
    const chunks = makeSampleChunks(5);
    const results = await retrieveRelevantChunks('"topic 3" pricing', chunks, 3);

    expect(results).toHaveLength(3);
    expect(results[0].content).toContain("topic 3");
    expect(results[0].relevanceScore).toBeGreaterThan(results[1].relevanceScore);
  });

  it("returns empty array when no chunks are provided", async () => {
    const results = await retrieveRelevantChunks("test question", [], 5);
    expect(results).toHaveLength(0);
  });

  it("returns empty array when all chunks have blank content", async () => {
    const blankChunks = [
      { id: 1, documentId: 1, chunkIndex: 0, content: "   " },
      { id: 2, documentId: 1, chunkIndex: 1, content: "\t" },
    ];
    const results = await retrieveRelevantChunks("test question", blankChunks, 5);
    expect(results).toHaveLength(0);
  });

  it("returns all chunks when topK >= chunk count", async () => {
    const chunks = makeSampleChunks(3);
    const results = await retrieveRelevantChunks("topic pricing", chunks, 10);
    expect(results).toHaveLength(3);
  });

  it("results are sorted by descending relevance score", async () => {
    const chunks = makeSampleChunks(4);
    const results = await retrieveRelevantChunks("topic 2 pricing", chunks, 4);

    for (let i = 0; i < results.length - 1; i++) {
      expect(results[i].relevanceScore).toBeGreaterThanOrEqual(results[i + 1].relevanceScore);
    }
  });

  it("includes chunkIndex and content on each result", async () => {
    const chunks = makeSampleChunks(2);
    const results = await retrieveRelevantChunks("topic pricing", chunks, 2);
    for (const r of results) {
      expect(r).toHaveProperty("chunkIndex");
      expect(r).toHaveProperty("content");
      expect(r).toHaveProperty("relevanceScore");
      expect(r).toHaveProperty("documentId");
    }
  });
});

describe("retrieveAcrossDocuments", () => {
  it("returns one DocumentRetrieval per group", async () => {
    const groups = [
      {
        documentId: 1,
        documentName: "Doc A",
        chunks: [{ id: CHUNK_ID_BASE + 101, documentId: 1, chunkIndex: 0, content: "Content A1 pricing" }],
      },
      {
        documentId: 2,
        documentName: "Doc B",
        chunks: [{ id: CHUNK_ID_BASE + 102, documentId: 2, chunkIndex: 0, content: "Content B1 pricing" }],
      },
    ];

    const results = await retrieveAcrossDocuments("pricing", groups, 3);
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

    const results = await retrieveAcrossDocuments("question", groups, 3);
    expect(results[0].retrieved).toHaveLength(0);
    expect(results[0].chunksSearched).toBe(0);
  });

  it("reports chunksSearched on each result", async () => {
    const chunks = Array.from({ length: 4 }, (_, i) => ({
      id: CHUNK_ID_BASE + 201 + i,
      documentId: 1,
      chunkIndex: i,
      content: `content ${i} pricing`,
    }));
    const groups = [{ documentId: 1, documentName: "Doc A", chunks }];

    const results = await retrieveAcrossDocuments("pricing", groups, 2);
    expect(results[0].chunksSearched).toBe(4);
    expect(results[0].retrieved).toHaveLength(2);
  });
});