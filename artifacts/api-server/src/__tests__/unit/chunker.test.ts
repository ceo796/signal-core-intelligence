import { describe, it, expect } from "vitest";
import { chunkText } from "../../lib/chunker.js";

describe("chunkText", () => {
  it("returns empty array for empty input", () => {
    expect(chunkText("")).toEqual([]);
  });

  it("returns empty array for whitespace-only input", () => {
    expect(chunkText("   \n\t  ")).toEqual([]);
  });

  it("returns a single chunk for text shorter than the window", () => {
    const text = "word ".repeat(100).trim();
    const chunks = chunkText(text);
    expect(chunks).toHaveLength(1);
    expect(chunks[0]).toContain("word");
  });

  it("returns exactly the original words for a small document", () => {
    const words = ["alpha", "beta", "gamma", "delta"];
    const chunks = chunkText(words.join(" "));
    expect(chunks).toHaveLength(1);
    expect(chunks[0]).toBe(words.join(" "));
  });

  it("creates multiple chunks for a long document", () => {
    const text = "word ".repeat(1200).trim();
    const chunks = chunkText(text);
    expect(chunks.length).toBeGreaterThan(1);
  });

  it("each chunk does not exceed the window size (500 words)", () => {
    const text = "word ".repeat(2000).trim();
    const chunks = chunkText(text);
    for (const chunk of chunks) {
      const wordCount = chunk.split(/\s+/).length;
      expect(wordCount).toBeLessThanOrEqual(500);
    }
  });

  it("consecutive chunks overlap by approximately 50 words", () => {
    const words: string[] = [];
    for (let i = 1; i <= 1000; i++) {
      words.push(`w${i}`);
    }
    const text = words.join(" ");
    const chunks = chunkText(text);
    expect(chunks.length).toBeGreaterThanOrEqual(2);

    const chunk0Words = chunks[0].split(/\s+/);
    const chunk1Words = chunks[1].split(/\s+/);

    const tail = chunk0Words.slice(-50);
    const head = chunk1Words.slice(0, 50);

    expect(tail).toEqual(head);
  });

  it("all words in the original text appear in at least one chunk", () => {
    const words: string[] = [];
    for (let i = 1; i <= 600; i++) {
      words.push(`unique${i}`);
    }
    const text = words.join(" ");
    const chunks = chunkText(text);
    const allChunkText = chunks.join(" ");

    for (const word of words) {
      expect(allChunkText).toContain(word);
    }
  });

  it("handles single-word input", () => {
    const chunks = chunkText("hello");
    expect(chunks).toHaveLength(1);
    expect(chunks[0]).toBe("hello");
  });

  it("handles text with multiple whitespace variants", () => {
    const text = "alpha  beta\tgamma\ndelta";
    const chunks = chunkText(text);
    expect(chunks).toHaveLength(1);
    expect(chunks[0].split(/\s+/)).toHaveLength(4);
  });
});
