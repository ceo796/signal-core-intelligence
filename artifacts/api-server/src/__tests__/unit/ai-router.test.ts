import { beforeEach, describe, expect, it, vi } from "vitest";

const mockOpenAiCreate = vi.fn();
const mockGrokCreate = vi.fn();
const mockGeminiCreate = vi.fn();
const mockOpenAiEmbeddings = vi.fn();

vi.mock("openai", () => ({
  default: vi.fn().mockImplementation((opts: { baseURL?: string }) => {
    if (opts.baseURL === "https://api.x.ai/v1") {
      return { chat: { completions: { create: mockGrokCreate } } };
    }
    if (opts.baseURL === "https://generativelanguage.googleapis.com/v1beta/openai/") {
      return { chat: { completions: { create: mockGeminiCreate } } };
    }
    return {
      chat: { completions: { create: mockOpenAiCreate } },
      embeddings: { create: mockOpenAiEmbeddings },
    };
  }),
}));

describe("aiRouter", () => {
  beforeEach(() => {
    vi.resetModules();
    mockOpenAiCreate.mockReset();
    mockGrokCreate.mockReset();
    mockGeminiCreate.mockReset();
    mockOpenAiEmbeddings.mockReset();
    delete process.env.XAI_API_KEY;
    delete process.env.GROK_API_KEY;
    delete process.env.GEMINI_API_KEY;
    delete process.env.GOOGLE_API_KEY;
    delete process.env.AI_PRIMARY_REASONING_PROVIDER;
    delete process.env.AI_FINAL_FALLBACK_PROVIDER;
  });

  it("returns normalized response from primary provider", async () => {
    process.env.OPENAI_API_KEY = "sk-openai";
    mockOpenAiCreate.mockResolvedValue({
      choices: [{ message: { content: "answer text" } }],
      usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
    });

    const { aiRouter } = await import("../../lib/ai/router.js");
    const result = await aiRouter.runTask({
      taskType: "document_chat",
      userPrompt: "hello",
    });

    expect(result).toMatchObject({
      taskType: "document_chat",
      answer: "answer text",
      providerUsed: "openai",
      fallbackUsed: false,
      confidence: "high",
      tokenUsage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
    });
  });

  it("falls back when primary provider fails with eligible error", async () => {
    process.env.OPENAI_API_KEY = "sk-openai";
    process.env.XAI_API_KEY = "xai-key";
    process.env.AI_FINAL_FALLBACK_PROVIDER = "xai";
    mockOpenAiCreate.mockRejectedValue(new Error("openai timeout"));
    mockGrokCreate.mockResolvedValue({
      choices: [{ message: { content: "grok answer" } }],
    });

    const { aiRouter } = await import("../../lib/ai/router.js");
    const result = await aiRouter.runTask({
      taskType: "multi_document_chat",
      userPrompt: "compare",
    });

    expect(result.providerUsed).toBe("xai");
    expect(result.fallbackUsed).toBe(true);
    expect(result.answer).toBe("grok answer");
  });

  it("works when openai is disabled and xai is primary", async () => {
    process.env.AI_PRIMARY_REASONING_PROVIDER = "xai";
    process.env.XAI_API_KEY = "xai-key";
    mockGrokCreate.mockResolvedValue({
      choices: [{ message: { content: "grok only" } }],
    });

    const { aiRouter } = await import("../../lib/ai/router.js");
    const result = await aiRouter.runTask({
      taskType: "document_chat",
      userPrompt: "hello",
    });

    expect(result.providerUsed).toBe("xai");
    expect(mockOpenAiCreate).not.toHaveBeenCalled();
  });

  it("parses structured output into structuredData", async () => {
    process.env.OPENAI_API_KEY = "sk-openai";
    mockOpenAiCreate.mockResolvedValue({
      choices: [{ message: { content: "{\"title\":\"Brief\",\"sections\":[]}" } }],
    });

    const { aiRouter } = await import("../../lib/ai/router.js");
    const result = await aiRouter.generateStructuredOutput({
      taskType: "executive_brief",
      userPrompt: "generate",
    });

    expect(result.structuredData).toEqual({ title: "Brief", sections: [] });
  });
});