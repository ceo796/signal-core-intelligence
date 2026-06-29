import { describe, expect, it } from "vitest";
import { postProcessGrokAnswer } from "../../lib/ai/providers/grok-postprocess";

describe("postProcessGrokAnswer", () => {
  it("moves leading bullet citations to the end of the line", () => {
    const input = "- [Source 2] Payment is due in 30 days.";
    expect(postProcessGrokAnswer(input)).toBe(
      "- Payment is due in 30 days. [Source 2]\n\nSources\n- [Source 2]",
    );
  });

  it("appends a Sources section when citations exist", () => {
    const input = "The term is 12 months. [Source 1]";
    expect(postProcessGrokAnswer(input)).toContain("Sources\n- [Source 1]");
  });

  it("skips post-processing for structured JSON output", () => {
    const json = '{"title":"Brief","sections":[]}';
    expect(postProcessGrokAnswer(json, { structuredOutput: true })).toBe(json);
  });
});