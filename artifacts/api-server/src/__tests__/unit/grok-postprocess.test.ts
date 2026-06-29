import { describe, expect, it } from "vitest";
import { postProcessChatAnswer, postProcessGrokAnswer } from "../../lib/ai/providers/grok-postprocess";

describe("postProcessChatAnswer", () => {
  it("removes inline citations from the body", () => {
    const input = "Payment is due in 30 days. [Source 2] Late fees apply. [Source 2]";
    expect(postProcessChatAnswer(input)).toBe(
      "Payment is due in 30 days. Late fees apply.\n\n- [Source 2]",
    );
  });

  it("limits the Sources footer to five markers", () => {
    const input = [
      "Summary line. [Source 1] [Source 2] [Source 3] [Source 4] [Source 5] [Source 6]",
    ].join("");
    const output = postProcessChatAnswer(input);
    expect(output).not.toMatch(/\[Source [1-5]\].*\[Source [1-5]\]/);
    expect((output.match(/\[Source \d+\]/g) ?? []).length).toBe(5);
    expect(output).not.toContain("[Source 6]");
  });
});

describe("postProcessGrokAnswer", () => {
  it("uses chat formatting for document_chat", () => {
    const input = "The term is 12 months. [Source 1]";
    expect(postProcessGrokAnswer(input, { taskType: "document_chat" })).toBe(
      "The term is 12 months.\n\n- [Source 1]",
    );
  });

  it("moves leading bullet citations to the end of the line for non-chat tasks", () => {
    const input = "- [Source 2] Payment is due in 30 days.";
    expect(postProcessGrokAnswer(input, { taskType: "document_summary" })).toBe(
      "- Payment is due in 30 days. [Source 2]\n\nSources\n- [Source 2]",
    );
  });

  it("appends a Sources section when citations exist for non-chat tasks", () => {
    const input = "The term is 12 months. [Source 1]";
    expect(postProcessGrokAnswer(input, { taskType: "document_summary" })).toContain("Sources\n- [Source 1]");
  });

  it("skips post-processing for structured JSON output", () => {
    const json = '{"title":"Brief","sections":[]}';
    expect(postProcessGrokAnswer(json, { structuredOutput: true })).toBe(json);
  });
});