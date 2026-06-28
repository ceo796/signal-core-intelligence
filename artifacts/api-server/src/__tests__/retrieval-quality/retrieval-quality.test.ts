/**
 * Retrieval quality tests.
 *
 * These tests verify that the retriever surfaces the correct source text for
 * known questions against known document fixtures, and that the system does NOT
 * fabricate grounded answers when the document contains no relevant information.
 *
 * OpenAI embeddings are mocked so tests are deterministic and fast. The mock
 * assigns each chunk an embedding that encodes its content as a simple hash
 * so semantically similar questions naturally score higher than unrelated ones.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const { mockGenerateEmbedding, mockGenerateEmbeddings } = vi.hoisted(() => ({
  mockGenerateEmbedding: vi.fn(),
  mockGenerateEmbeddings: vi.fn(),
}));

vi.mock("../../lib/ai/embedding.js", () => ({
  generateEmbedding: mockGenerateEmbedding,
  generateEmbeddings: mockGenerateEmbeddings,
  getEmbeddingModelName: vi.fn(() => "text-embedding-3-small"),
}));

import { chunkText } from "../../lib/chunker.js";
import { extractSpreadsheet } from "../../lib/spreadsheet.js";
import { retrieveRelevantChunks } from "../../lib/retriever.js";
import { makeXlsxBuffer } from "../helpers/make-xlsx.js";

const __dir = dirname(fileURLToPath(import.meta.url));
const FIXTURES_DIR = join(__dir, "../fixtures");

/**
 * Produce a deterministic pseudo-embedding for a string.
 *
 * We use a 64-dimension vector where each dimension is the normalised frequency
 * of a trigram group.  Two strings that share many trigrams will have a high
 * cosine similarity, which is a good proxy for semantic similarity without
 * calling a real embedding API.
 */
function pseudoEmbed(text: string, dim = 64): number[] {
  const lower = text.toLowerCase();
  const vec = new Array<number>(dim).fill(0);
  for (let i = 0; i < lower.length - 2; i++) {
    const tri = lower.slice(i, i + 3);
    let h = 0;
    for (let j = 0; j < tri.length; j++) {
      h = (h * 31 + tri.charCodeAt(j)) & 0xffffffff;
    }
    vec[Math.abs(h) % dim] += 1;
  }
  // L2-normalise
  const norm = Math.sqrt(vec.reduce((s, v) => s + v * v, 0)) || 1;
  return vec.map((v) => v / norm);
}

function setupMockForChunks(question: string, chunks: string[]) {
  const questionEmbedding = pseudoEmbed(question);
  const chunkEmbeddings = chunks.map((c) => pseudoEmbed(c));

  mockGenerateEmbedding.mockResolvedValueOnce(questionEmbedding);
  mockGenerateEmbeddings.mockResolvedValueOnce({
    embeddings: chunkEmbeddings,
    providerUsed: "openai",
    modelUsed: "text-embedding-3-small",
  });
}

// ─── TXT fixture ─────────────────────────────────────────────────────────────

describe("TXT fixture — sample.txt retrieval quality", () => {
  const fixtureText = readFileSync(join(FIXTURES_DIR, "sample.txt"), "utf-8");
  const chunks = chunkText(fixtureText);
  const indexedChunks = chunks.map((c, i) => ({
    id: i + 1,
    documentId: 1,
    chunkIndex: i,
    content: c,
  }));

  beforeEach(() => {
    mockGenerateEmbedding.mockReset();
    mockGenerateEmbeddings.mockReset();
  });

  it("retrieves a chunk containing pricing information when asked about price", async () => {
    const question = "What is the price of the platform?";
    setupMockForChunks(question, chunks);

    const results = await retrieveRelevantChunks(question, indexedChunks, 3);
    expect(results.length).toBeGreaterThan(0);

    const topResult = results[0];
    expect(topResult.content.toLowerCase()).toMatch(/\$99|\$499|month|pricing/);
  });

  it("retrieves a chunk describing the AI stack when asked about the AI model", async () => {
    const question = "Which AI model does the platform use?";
    setupMockForChunks(question, chunks);

    const results = await retrieveRelevantChunks(question, indexedChunks, 3);
    expect(results.length).toBeGreaterThan(0);

    const combinedText = results.map((r) => r.content).join(" ").toLowerCase();
    expect(combinedText).toMatch(/openai|gpt|embedding/);
  });

  it("retrieves a chunk mentioning chunking strategy when asked about it", async () => {
    const question = "How are document chunks created?";
    setupMockForChunks(question, chunks);

    const results = await retrieveRelevantChunks(question, indexedChunks, 3);
    const combinedText = results.map((r) => r.content).join(" ").toLowerCase();
    expect(combinedText).toMatch(/chunk|sliding|500|overlap/);
  });

  it("returns results sorted by relevance score (descending)", async () => {
    const question = "What is Signal87?";
    setupMockForChunks(question, chunks);

    const results = await retrieveRelevantChunks(question, indexedChunks, 5);
    for (let i = 0; i < results.length - 1; i++) {
      expect(results[i].relevanceScore).toBeGreaterThanOrEqual(
        results[i + 1].relevanceScore
      );
    }
  });

  it("each result includes required citation fields", async () => {
    const question = "What features does Signal87 offer?";
    setupMockForChunks(question, chunks);

    const results = await retrieveRelevantChunks(question, indexedChunks, 3);
    for (const r of results) {
      expect(r).toHaveProperty("id");
      expect(r).toHaveProperty("documentId");
      expect(r).toHaveProperty("chunkIndex");
      expect(r).toHaveProperty("content");
      expect(r).toHaveProperty("relevanceScore");
      expect(typeof r.relevanceScore).toBe("number");
      expect(r.relevanceScore).toBeGreaterThanOrEqual(0);
      expect(r.relevanceScore).toBeLessThanOrEqual(1);
    }
  });
});

// ─── Spreadsheet fixture ──────────────────────────────────────────────────────

describe("Spreadsheet fixture — XLSX retrieval quality", () => {
  const xlsxRows = [
    { product: "Widget A", category: "Electronics", price: 29.99, quantity: 150 },
    { product: "Widget B", category: "Electronics", price: 49.99, quantity: 80 },
    { product: "Gadget X", category: "Hardware", price: 89.99, quantity: 35 },
    { product: "Gadget Y", category: "Hardware", price: 129.99, quantity: 20 },
    { product: "Service Plan", category: "Support", price: 199.99, quantity: 500 },
    { product: "Premium Support", category: "Support", price: 499.99, quantity: 45 },
  ];
  const xlsxBuf = makeXlsxBuffer("Products", xlsxRows);
  const { chunks } = extractSpreadsheet(xlsxBuf, "xlsx", "products.xlsx");
  const indexedChunks = chunks.map((c, i) => ({
    id: i + 100,
    documentId: 2,
    chunkIndex: i,
    content: c,
  }));

  beforeEach(() => {
    mockGenerateEmbedding.mockReset();
    mockGenerateEmbeddings.mockReset();
  });

  it("retrieves a chunk with sheet and row context (not just raw text)", async () => {
    const question = "What products are available?";
    setupMockForChunks(question, chunks);

    const results = await retrieveRelevantChunks(question, indexedChunks, 3);
    expect(results.length).toBeGreaterThan(0);

    const topContent = results[0].content;
    // Chunks must carry sheet provenance prefix — this is the core invariant
    expect(topContent).toContain("Sheet: Products");
    expect(topContent).toMatch(/Rows \d+/);
  });

  it("retrieved chunks include column headers for context", async () => {
    const question = "What are the prices and categories?";
    setupMockForChunks(question, chunks);

    const results = await retrieveRelevantChunks(question, indexedChunks, 3);
    const combined = results.map((r) => r.content).join(" ");
    expect(combined).toContain("Columns:");
    expect(combined).toMatch(/product|category|price/i);
  });
});

// ─── Worrell fixture ─────────────────────────────────────────────────────────

describe("Worrell fixture — tabular expenditure retrieval quality", () => {
  const fixtureText = readFileSync(join(FIXTURES_DIR, "worrell-expenditures.txt"), "utf-8");
  const chunks = chunkText(fixtureText);
  const indexedChunks = chunks.map((c, i) => ({
    id: i + 1,
    documentId: 4,
    chunkIndex: i,
    content: c,
  }));

  beforeEach(() => {
    mockGenerateEmbedding.mockReset();
    mockGenerateEmbeddings.mockReset();
  });

  it("preserves Worrell payment rows in at least one chunk (line-aware chunking)", () => {
    const combined = chunks.join("\n");
    expect(combined).toContain("Shaquille Worrell");
    expect(combined).toContain("$500.00");
    expect(combined).toContain("January 15, 2024");
    const fullRowChunk = chunks.find((c) =>
      c.includes("Shaquille Worrell") &&
      c.includes("$500.00") &&
      c.includes("January 15, 2024")
    );
    expect(fullRowChunk).toBeTruthy();
  });

  it("retrieves Worrell chunks when asked by full name", async () => {
    const question = "How much has Shaquille Worrell been paid?";
    setupMockForChunks(question, chunks);
    const results = await retrieveRelevantChunks(question, indexedChunks, 5);
    const combined = results.map((r) => r.content).join("\n");
    expect(combined.toLowerCase()).toContain("shaquille");
    expect(combined.toLowerCase()).toContain("worrell");
  });

  it("retrieves Worrell chunks when asked by last name only", async () => {
    const question = "How much has Worrell been paid?";
    setupMockForChunks(question, chunks);
    const results = await retrieveRelevantChunks(question, indexedChunks, 5);
    const combined = results.map((r) => r.content).join("\n");
    expect(combined.toLowerCase()).toContain("worrell");
  });

  it("retrieves Worrell chunks when asked by first name only", async () => {
    const question = "How much has Shaquille been paid?";
    setupMockForChunks(question, chunks);
    const results = await retrieveRelevantChunks(question, indexedChunks, 5);
    const combined = results.map((r) => r.content).join("\n");
    expect(combined.toLowerCase()).toContain("shaquille");
  });

  it("chunks contain enough payment data to aggregate totals", () => {
    const combined = chunks.join("\n");
    const matches = Array.from(combined.matchAll(/\$[\d,]+\.\d{2}/g));
    expect(matches.length).toBeGreaterThanOrEqual(6);
  });

  it("chunks contain enough dates to reason about frequency", () => {
    const combined = chunks.join("\n");
    const dateMatches = Array.from(combined.matchAll(/January \d+, \d{4}/g));
    expect(dateMatches.length).toBeGreaterThanOrEqual(2);
    const febMatches = Array.from(combined.matchAll(/February \d+, \d{4}/g));
    expect(febMatches.length).toBeGreaterThanOrEqual(2);
  });
});

// ─── Insufficient evidence test ───────────────────────────────────────────────

describe("Insufficient evidence — unrelated question", () => {
  const fixtureText = readFileSync(join(FIXTURES_DIR, "sample.txt"), "utf-8");
  const chunks = chunkText(fixtureText);
  const indexedChunks = chunks.map((c, i) => ({
    id: i + 200,
    documentId: 3,
    chunkIndex: i,
    content: c,
  }));

  beforeEach(() => {
    mockGenerateEmbedding.mockReset();
    mockGenerateEmbeddings.mockReset();
  });

  /**
   * When a question is completely unrelated to the document, the retriever should
   * return chunks with near-zero relevance scores.  The system must not fabricate
   * a high-confidence grounded answer — the retrieved content will not contain
   * the expected information, forcing the model to acknowledge insufficient evidence.
   *
   * Here we assert the retrieval layer property: top-chunk score for an unrelated
   * question is materially lower than for a directly matched question, ensuring the
   * signal going into the LLM is weak and the LLM has no grounded basis for a
   * confident answer.
   */
  it("unrelated question has lower top-chunk score than a directly relevant question", async () => {
    const relevantQuestion = "What is the monthly pricing for the platform?";
    const unrelatedQuestion = "What is the capital of France?";

    // Score for relevant question
    setupMockForChunks(relevantQuestion, chunks);
    const relevantResults = await retrieveRelevantChunks(
      relevantQuestion,
      indexedChunks,
      3
    );

    mockGenerateEmbedding.mockReset();
    mockGenerateEmbeddings.mockReset();

    // Score for unrelated question
    setupMockForChunks(unrelatedQuestion, chunks);
    const unrelatedResults = await retrieveRelevantChunks(
      unrelatedQuestion,
      indexedChunks,
      3
    );

    const topRelevantScore = relevantResults[0]?.relevanceScore ?? 0;
    const topUnrelatedScore = unrelatedResults[0]?.relevanceScore ?? 0;

    // The relevant question should score meaningfully higher
    expect(topRelevantScore).toBeGreaterThan(topUnrelatedScore);
  });

  it("unrelated question still returns chunks (retriever does not drop empty results)", async () => {
    const unrelated = "What is the weather forecast for Tokyo tomorrow?";
    setupMockForChunks(unrelated, chunks);

    const results = await retrieveRelevantChunks(unrelated, indexedChunks, 3);
    // Retriever always returns top-K; the burden of detecting insufficient evidence
    // belongs to the LLM prompt layer, not the retriever
    expect(results.length).toBeGreaterThan(0);
    // All scores are valid numbers in [0, 1]
    for (const r of results) {
      expect(r.relevanceScore).toBeGreaterThanOrEqual(0);
      expect(r.relevanceScore).toBeLessThanOrEqual(1);
    }
  });

  it("retrieved chunks for an unrelated question do not contain the expected answer", async () => {
    const unrelated = "What is the boiling point of nitrogen in Kelvin?";
    setupMockForChunks(unrelated, chunks);

    const results = await retrieveRelevantChunks(unrelated, indexedChunks, 5);
    const combined = results.map((r) => r.content).join(" ").toLowerCase();

    // The sample.txt document says nothing about nitrogen or boiling points
    expect(combined).not.toMatch(/nitrogen|boiling|kelvin|77k/);
  });
});
