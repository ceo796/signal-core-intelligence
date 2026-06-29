import { beforeEach, describe, expect, it, vi } from "vitest";

const mockGrokCreate = vi.fn();
const mockFetch = vi.fn();

vi.mock("openai", () => ({
  default: vi.fn().mockImplementation((opts: { baseURL?: string }) => {
    if (opts.baseURL === "https://api.x.ai/v1") {
      return { chat: { completions: { create: mockGrokCreate } } };
    }
    return { chat: { completions: { create: vi.fn() } } };
  }),
}));

function geminiResponse(text: string) {
  return {
    ok: true,
    status: 200,
    json: async () => ({
      candidates: [{ content: { parts: [{ text }] } }],
      usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 5, totalTokenCount: 15 },
    }),
    text: async () => "",
  };
}

describe("aiRouter", () => {
  beforeEach(() => {
    vi.resetModules();
    mockGrokCreate.mockReset();
    mockFetch.mockReset();
    vi.stubGlobal("fetch", mockFetch);
    delete process.env.XAI_API_KEY;
    delete process.env.GROK_API_KEY;
    delete process.env.OPENAI_API_KEY;
    delete process.env.GEMINI_API_KEY;
    delete process.env.GOOGLE_API_KEY;
    delete process.env.GEMINI_SERVICE_ACCOUNT_PATH;
    delete process.env.GEMINI_SERVICE_ACCOUNT_JSON;
    delete process.env.AI_PRIMARY_REASONING_PROVIDER;
    delete process.env.AI_FINAL_FALLBACK_PROVIDER;
    delete process.env.AI_FALLBACK_PROVIDER_ORDER;
    delete process.env.AI_PROVIDER_TIMEOUT_MS;
  });

  it("uses Gemini first when configured", async () => {
    process.env.GEMINI_API_KEY = "test-gemini-key";
    mockFetch.mockResolvedValue(geminiResponse("gemini answer"));

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
    });
    expect(mockGrokCreate).not.toHaveBeenCalled();
  });

  it("falls back to Grok when Gemini fails", async () => {
    process.env.GEMINI_API_KEY = "test-gemini-key";
    process.env.XAI_API_KEY = "xai-key";
    mockFetch.mockResolvedValue({
      ok: false,
      status: 500,
      text: async () => "gemini timeout",
    });
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

  it("throws after google and xai fail without calling OpenAI", async () => {
    process.env.GEMINI_API_KEY = "test-gemini-key";
    process.env.OPENAI_API_KEY = "sk-openai";
    process.env.XAI_API_KEY = "xai-key";
    mockFetch.mockResolvedValue({
      ok: false,
      status: 500,
      text: async () => "gemini down",
    });
    mockGrokCreate.mockRejectedValue(new Error("grok down"));

    const { aiRouter } = await import("../../lib/ai/router.js");
    await expect(
      aiRouter.runTask({
        taskType: "document_chat",
        userPrompt: "hello",
      }),
    ).rejects.toThrow(/unavailable|failed/i);
  });

  it("works when xai is primary", async () => {
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
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("parses structured output into structuredData via Gemini", async () => {
    process.env.GEMINI_API_KEY = "test-gemini-key";
    mockFetch.mockResolvedValue(geminiResponse("{\"title\":\"Brief\",\"sections\":[]}"));

    const { aiRouter } = await import("../../lib/ai/router.js");
    const result = await aiRouter.generateStructuredOutput({
      taskType: "executive_brief",
      userPrompt: "generate",
    });

    expect(result.structuredData).toEqual({ title: "Brief", sections: [] });
  });
});