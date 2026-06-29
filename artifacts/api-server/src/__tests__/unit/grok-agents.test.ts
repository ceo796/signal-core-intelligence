import { describe, expect, it } from "vitest";
import {
  augmentMessagesForGrok,
  buildGrokSystemAugmentation,
  getGrokAgentPrompt,
  GROK_CHAT_FORMATTING_POLICY,
  GROK_FORMATTING_POLICY,
} from "../../lib/ai/providers/grok-agents";

describe("grok-agents", () => {
  it("returns task-specific agent personas", () => {
    expect(getGrokAgentPrompt("document_chat")).toContain("Grok Document Analyst");
    expect(getGrokAgentPrompt("multi_document_chat")).toContain("Cross-Document Analyst");
    expect(getGrokAgentPrompt("diligence_memo")).toContain("Diligence Agent");
    expect(getGrokAgentPrompt("fact_extraction")).toContain("Extraction Agent");
  });

  it("includes formatting policy in augmentation", () => {
    expect(buildGrokSystemAugmentation("document_summary")).toContain(GROK_FORMATTING_POLICY);
    expect(buildGrokSystemAugmentation("document_chat")).toContain(GROK_CHAT_FORMATTING_POLICY);
    expect(buildGrokSystemAugmentation("fact_extraction")).toContain("DOCUMENT READER CAPABILITIES");
    expect(buildGrokSystemAugmentation("document_summary")).toContain("Sources");
  });

  it("appends augmentation to an existing system message", () => {
    const messages = augmentMessagesForGrok(
      [
        { role: "system", content: "Route prompt" },
        { role: "user", content: "What are the payment terms?" },
      ],
      "document_chat",
    );

    expect(messages).toHaveLength(2);
    expect(messages[0]?.content).toContain("Route prompt");
    expect(messages[0]?.content).toContain("Grok Document Analyst");
    expect(messages[0]?.content).toContain("no inline citations");
  });

  it("creates a system message when none exists", () => {
    const messages = augmentMessagesForGrok([{ role: "user", content: "hello" }], "document_compare");
    expect(messages[0]?.role).toBe("system");
    expect(messages[0]?.content).toContain("Grok Comparison Agent");
  });
});