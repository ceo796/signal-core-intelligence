import { describe, expect, it } from "vitest";

function wantsLongSummary(query: string): boolean {
  const q = query.toLowerCase();
  return (
    /\b(detailed|comprehensive|long|full|in-depth|in depth|thorough|extended|elaborate)\b/.test(q) ||
    /\b(more|extra)\s+(detail|points|bullets)\b/.test(q)
  );
}

describe("summary length detection", () => {
  it("defaults to short summary for plain summarize requests", () => {
    expect(wantsLongSummary("Summarize this contract")).toBe(false);
    expect(wantsLongSummary("Key points from my uploads")).toBe(false);
  });

  it("detects explicit requests for longer summaries", () => {
    expect(wantsLongSummary("Give me a detailed summary")).toBe(true);
    expect(wantsLongSummary("Comprehensive overview please")).toBe(true);
    expect(wantsLongSummary("I need more detail and extra bullets")).toBe(true);
  });
});