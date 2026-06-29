import { beforeEach, describe, expect, it, vi } from "vitest";

const mockGrokCreate = vi.fn();
const mockOpenAiCreate = vi.fn();
const mockFetch = vi.fn();

vi.mock("openai", () => ({
  default: vi.fn().mockImplementation((opts: { baseURL?: string }) => {
    if (opts.baseURL === "https://api.x.ai/v1") {
      return { chat: { completions: { create: mockGrokCreate } } };
    }
    return { chat: { completions: { create: mockOpenAiCreate } } };
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
    mockOpenAiCreate.mockReset();
    mockFetch.mockReset();
    vi.stubGlobal("fetch", mockFetch);
    delete process.env.ALLOW_OPENAI;
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

  it("uses Grok first when configured", async () => {
    process.env.XAI_API_KEY = "xai-key";
    mockGrokCreate.mockResolvedValue({
      choices: [{ message: { content: "grok answer" } }],
    });

    const { aiRouter } = await import("../../lib/ai/router.js");
    const result = await aiRouter.runTask({
      taskType: "document_chat",
      userPrompt: "hello",
    });

    expect(result).toMatchObject({
      taskType: "document_chat",
      answer: "grok answer",
      providerUsed: "xai",
      fallbackUsed: false,
    });
    expect(mockFetch).not.toHaveBeenCalled();
    expect(mockOpenAiCreate).not.toHaveBeenCalled();
  });

  it("falls back to Gemini when Grok fails", async () => {
    process.env.GEMINI_API_KEY = "test-gemini-key";
    process.env.XAI_API_KEY = "xai-key";
    mockGrokCreate.mockRejectedValue(new Error("grok timeout"));
    mockFetch.mockResolvedValue(geminiResponse("gemini answer"));

    const { aiRouter } = await import("../../lib/ai/router.js");
    const result = await aiRouter.runTask({
      taskType: "multi_document_chat",
      userPrompt: "compare",
    });

    expect(result.providerUsed).toBe("google");
    expect(result.fallbackUsed).toBe(true);
    expect(result.answer).toBe("gemini answer");
    expect(mockOpenAiCreate).not.toHaveBeenCalled();
  });

  it("throws after Grok and Gemini fail without calling OpenAI", async () => {
    process.env.GEMINI_API_KEY = "test-gemini-key";
    process.env.OPENAI_API_KEY = "sk-openai";
    process.env.XAI_API_KEY = "xai-key";
    mockGrokCreate.mockRejectedValue(new Error("grok down"));
    mockFetch.mockResolvedValue({
      ok: false,
      status: 500,
      text: async () => "gemini down",
    });

    const { aiRouter } = await import("../../lib/ai/router.js");
    await expect(
      aiRouter.runTask({
        taskType: "document_chat",
        userPrompt: "hello",
      }),
    ).rejects.toThrow(/unavailable|failed/i);
    expect(mockOpenAiCreate).not.toHaveBeenCalled();
  });

  it("passes Grok task agents and formatting policy when Grok answers", async () => {
    process.env.XAI_API_KEY = "xai-key";
    mockGrokCreate.mockResolvedValue({
      choices: [{ message: { content: "formatted grok answer" } }],
    });

    const { aiRouter } = await import("../../lib/ai/router.js");
    await aiRouter.runTask({
      taskType: "diligence_memo",
      messages: [
        { role: "system", content: "Base diligence prompt" },
        { role: "user", content: "Review risks" },
      ],
    });

    const grokCall = mockGrokCreate.mock.calls[0]?.[0];
    const systemMessage = grokCall?.messages?.find((m: { role: string }) => m.role === "system");
    expect(systemMessage?.content).toContain("Base diligence prompt");
    expect(systemMessage?.content).toContain("Grok Diligence Agent");
    expect(systemMessage?.content).toContain("DOCUMENT READER CAPABILITIES");
    expect(systemMessage?.content).toContain("Sources");
  });

  it("parses structured output into structuredData via Grok", async () => {
    process.env.XAI_API_KEY = "xai-key";
    mockGrokCreate.mockResolvedValue({
      choices: [{ message: { content: "{\"title\":\"Brief\",\"sections\":[]}" } }],
    });

    const { aiRouter } = await import("../../lib/ai/router.js");
    const result = await aiRouter.generateStructuredOutput({
      taskType: "executive_brief",
      userPrompt: "generate",
    });

    expect(result.structuredData).toEqual({ title: "Brief", sections: [] });
    expect(result.providerUsed).toBe("xai");
  });
});