import { describe, expect, it, beforeEach } from "vitest";
import { loadAiConfig, resolveTaskProviderChain } from "../../lib/ai/config.js";

describe("ai config", () => {
  beforeEach(() => {
    delete process.env.AI_PRIMARY_REASONING_PROVIDER;
    delete process.env.AI_FINAL_FALLBACK_PROVIDER;
    delete process.env.AI_FALLBACK_PROVIDER_ORDER;
    delete process.env.OPENAI_MODEL;
    delete process.env.GROK_MODEL;
    delete process.env.GEMINI_MODEL;
  });

  it("loads provider routing from environment", () => {
    process.env.AI_PRIMARY_REASONING_PROVIDER = "google";
    process.env.AI_FINAL_FALLBACK_PROVIDER = "xai";
    process.env.OPENAI_MODEL = "custom-openai";
    process.env.GROK_MODEL = "custom-grok";
    process.env.GEMINI_MODEL = "custom-gemini";

    const config = loadAiConfig();
    expect(config.primaryReasoningProvider).toBe("google");
    expect(config.finalFallbackProvider).toBe("xai");
    expect(config.models.openai.chat).toBe("custom-openai");
    expect(config.models.xai.chat).toBe("custom-grok");
    expect(config.models.google.chat).toBe("custom-gemini");
  });

  it("orders fallbacks as primary, configured middle providers, then final fallback", () => {
    process.env.AI_PRIMARY_REASONING_PROVIDER = "openai";
    process.env.AI_FINAL_FALLBACK_PROVIDER = "google";
    process.env.AI_FALLBACK_PROVIDER_ORDER = "xai";

    const chain = resolveTaskProviderChain("document_chat", loadAiConfig());
    expect(chain).toEqual(["openai", "xai", "google"]);
  });

  it("defaults reasoning chain to Gemini, then GPT, then Grok", () => {
    const chain = resolveTaskProviderChain("document_chat", loadAiConfig());
    expect(chain).toEqual(["google", "openai", "xai"]);
  });
});