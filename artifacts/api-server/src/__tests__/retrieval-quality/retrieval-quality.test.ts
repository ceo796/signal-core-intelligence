/**
 * Retrieval quality tests.
 *
 * These tests verify that the retriever surfaces the correct source text for
 * known questions against known document fixtures, and that the system does NOT
 * fabricate grounded answers when the document contains no relevant information.
 *
 * Retrieval uses local BM25-style keyword scoring — no external embedding APIs.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

import { chunkText } from "../../lib/chunker.js";
import { extractSpreadsheet } from "../../lib/spreadsheet.js";
import { retrieveRelevantChunks } from "../../lib/retriever.js";
import { makeXlsxBuffer } from "../helpers/make-xlsx.js";

const __dir = dirname(fileURLToPath(import.meta.url));
const FIXTURES_DIR = join(__dir, "../fixtures");

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

  it("retrieves a chunk containing pricing information when asked about price", async () => {
    const question = "What is the price of the platform?";
    const results = await retrieveRelevantChunks(question, indexedChunks, 3);
    expect(results.length).toBeGreaterThan(0);

    const topResult = results[0];
    expect(topResult.content.toLowerCase()).toMatch(/\$99|\$499|month|pricing/);
  });

  it("retrieves a chunk describing the AI stack when asked about the AI model", async () => {
    const question = "Which AI model does the platform use?";
    const results = await retrieveRelevantChunks(question, indexedChunks, 3);
    expect(results.length).toBeGreaterThan(0);

    const combinedText = results.map((r) => r.content).join(" ").toLowerCase();
    expect(combinedText).toMatch(/openai|gpt|embedding|model/);
  });

  it("retrieves a chunk mentioning chunking strategy when asked about it", async () => {
    const question = "How are document chunks created?";
    const results = await retrieveRelevantChunks(question, indexedChunks, 3);
    const combinedText = results.map((r) => r.content).join(" ").toLowerCase();
    expect(combinedText).toMatch(/chunk|sliding|500|overlap/);
  });

  it("returns results sorted by relevance score (descending)", async () => {
    const question = "What is Signal87?";
    const results = await retrieveRelevantChunks(question, indexedChunks, 5);
    for (let i = 0; i < results.length - 1; i++) {
      expect(results[i].relevanceScore).toBeGreaterThanOrEqual(results[i + 1].relevanceScore);
    }
  });

  it("each result includes required citation fields", async () => {
    const question = "What features does Signal87 offer?";
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

  it("retrieves a chunk with sheet and row context (not just raw text)", async () => {
    const question = "What products are available?";
    const results = await retrieveRelevantChunks(question, indexedChunks, 3);
    expect(results.length).toBeGreaterThan(0);

    const topContent = results[0].content;
    expect(topContent).toContain("Sheet: Products");
    expect(topContent).toMatch(/Rows \d+/);
  });

  it("retrieved chunks include column headers for context", async () => {
    const question = "What are the prices and categories?";
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

  it("preserves Worrell payment rows in at least one chunk (line-aware chunking)", () => {
    const combined = chunks.join("\n");
    expect(combined).toContain("Shaquille Worrell");
    expect(combined).toContain("$500.00");
    expect(combined).toContain("January 15, 2024");
    const fullRowChunk = chunks.find(
      (c) =>
        c.includes("Shaquille Worrell") &&
        c.includes("$500.00") &&
        c.includes("January 15, 2024"),
    );
    expect(fullRowChunk).toBeTruthy();
  });

  it("retrieves Worrell chunks when asked by full name", async () => {
    const question = "How much has Shaquille Worrell been paid?";
    const results = await retrieveRelevantChunks(question, indexedChunks, 5);
    const combined = results.map((r) => r.content).join("\n");
    expect(combined.toLowerCase()).toContain("shaquille");
    expect(combined.toLowerCase()).toContain("worrell");
  });

  it("retrieves Worrell chunks when asked by last name only", async () => {
    const question = "How much has Worrell been paid?";
    const results = await retrieveRelevantChunks(question, indexedChunks, 5);
    const combined = results.map((r) => r.content).join("\n");
    expect(combined.toLowerCase()).toContain("worrell");
  });

  it("retrieves Worrell chunks when asked by first name only", async () => {
    const question = "How much has Shaquille been paid?";
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

  it("unrelated question has lower top-chunk score than a directly relevant question", async () => {
    const relevantQuestion = "What is the monthly pricing for the platform?";
    const unrelatedQuestion = "What is the capital of France?";

    const relevantResults = await retrieveRelevantChunks(relevantQuestion, indexedChunks, 3);
    const unrelatedResults = await retrieveRelevantChunks(unrelatedQuestion, indexedChunks, 3);

    const topRelevantScore = relevantResults[0]?.relevanceScore ?? 0;
    const topUnrelatedScore = unrelatedResults[0]?.relevanceScore ?? 0;

    expect(topRelevantScore).toBeGreaterThan(topUnrelatedScore);
  });

  it("unrelated question still returns chunks (retriever does not drop empty results)", async () => {
    const unrelated = "What is the weather forecast for Tokyo tomorrow?";
    const results = await retrieveRelevantChunks(unrelated, indexedChunks, 3);
    expect(results.length).toBeGreaterThan(0);
    for (const r of results) {
      expect(r.relevanceScore).toBeGreaterThanOrEqual(0);
      expect(r.relevanceScore).toBeLessThanOrEqual(1);
    }
  });

  it("retrieved chunks for an unrelated question do not contain the expected answer", async () => {
    const unrelated = "What is the boiling point of nitrogen in Kelvin?";
    const results = await retrieveRelevantChunks(unrelated, indexedChunks, 5);
    const combined = results.map((r) => r.content).join(" ").toLowerCase();

    expect(combined).not.toMatch(/nitrogen|boiling|kelvin|77k/);
  });
});