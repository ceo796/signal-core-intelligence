import { beforeEach, describe, expect, it, vi } from "vitest";

const mockRunTask = vi.fn();

vi.mock("../../lib/ai/router.js", () => ({
  aiRouter: {
    runTask: mockRunTask,
  },
}));

vi.mock("../../lib/ai/index.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../lib/ai/index.js")>();
  return {
    ...actual,
    aiRouter: {
      runTask: mockRunTask,
    },
  };
});

describe("ai-provider compatibility shim", () => {
  beforeEach(() => {
    vi.resetModules();
    mockRunTask.mockReset();
  });

  it("maps createChatCompletion to aiRouter normalized response", async () => {
    mockRunTask.mockResolvedValue({
      taskType: "document_chat",
      answer: "mapped answer",
      structuredData: null,
      citations: [],
      evidenceItems: [],
      warnings: [],
      confidence: "high",
      providerUsed: "xai",
      modelUsed: "grok-4.3",
      fallbackUsed: true,
      fallbackReason: "Primary provider openai failed; used xai",
      latencyMs: 12,
      tokenUsage: null,
    });

    const { createChatCompletion } = await import("../../lib/ai-provider.js");
    const result = await createChatCompletion({
      messages: [{ role: "user", content: "hello" }],
    });

    expect(result).toEqual({
      content: "mapped answer",
      provider: "xai",
      model: "grok-4.3",
      fallbackUsed: true,
      primaryError: "Primary provider openai failed; used xai",
    });
  });
});