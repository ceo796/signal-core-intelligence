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
    if (
      opts.baseURL === "https://generativelanguage.googleapis.com/v1beta/openai/" ||
      opts.baseURL?.includes("aiplatform.googleapis.com")
    ) {
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
    delete process.env.GEMINI_SERVICE_ACCOUNT_PATH;
    delete process.env.GEMINI_SERVICE_ACCOUNT_JSON;
    delete process.env.AI_PRIMARY_REASONING_PROVIDER;
    delete process.env.AI_FINAL_FALLBACK_PROVIDER;
    delete process.env.AI_FALLBACK_PROVIDER_ORDER;
  });

  it("returns normalized response from Gemini when it is the primary provider", async () => {
    process.env.GEMINI_SERVICE_ACCOUNT_PATH = "./.local/gemini-service-account.json";
    mockGeminiCreate.mockResolvedValue({
      choices: [{ message: { content: "gemini answer" } }],
      usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
    });

    const { aiRouter } = await import("../../lib/ai/router.js");
    const result = await aiRouter.runTask({
      taskType: "document_chat",
      userPrompt: "hello",
    });

    expect(result).toMatchObject({
      taskType: "document_chat",
      answer: "gemini answer",
      providerUsed: "google",
      fallbackUsed: false,
      confidence: "high",
      tokenUsage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
    });
    expect(mockOpenAiCreate).not.toHaveBeenCalled();
  });

  it("falls back to GPT when Gemini fails with an eligible error", async () => {
    process.env.GEMINI_SERVICE_ACCOUNT_PATH = "./.local/gemini-service-account.json";
    process.env.OPENAI_API_KEY = "sk-openai";
    mockGeminiCreate.mockRejectedValue(new Error("gemini timeout"));
    mockOpenAiCreate.mockResolvedValue({
      choices: [{ message: { content: "gpt answer" } }],
    });

    const { aiRouter } = await import("../../lib/ai/router.js");
    const result = await aiRouter.runTask({
      taskType: "multi_document_chat",
      userPrompt: "compare",
    });

    expect(result.providerUsed).toBe("openai");
    expect(result.fallbackUsed).toBe(true);
    expect(result.answer).toBe("gpt answer");
  });

  it("uses Grok as the last fallback when Gemini and GPT fail", async () => {
    process.env.GEMINI_SERVICE_ACCOUNT_PATH = "./.local/gemini-service-account.json";
    process.env.OPENAI_API_KEY = "sk-openai";
    process.env.XAI_API_KEY = "xai-key";
    mockGeminiCreate.mockRejectedValue(new Error("gemini timeout"));
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
    process.env.GEMINI_SERVICE_ACCOUNT_PATH = "./.local/gemini-service-account.json";
    mockGeminiCreate.mockResolvedValue({
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