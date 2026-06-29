import { beforeEach, describe, expect, it } from "vitest";
import { OPENAI_DISABLED_ERROR, assertOpenAiAllowed, isOpenAiAllowed } from "../../lib/ai/openai-policy.js";
import { createOpenAiProvider } from "../../lib/ai/providers/openaiProvider.js";

describe("openai policy", () => {
  beforeEach(() => {
    delete process.env.ALLOW_OPENAI;
    delete process.env.OPENAI_API_KEY;
  });

  it("defaults OpenAI to disabled", () => {
    expect(isOpenAiAllowed()).toBe(false);
    expect(() => assertOpenAiAllowed()).toThrow(OPENAI_DISABLED_ERROR);
  });

  it("enables OpenAI only when ALLOW_OPENAI=true", () => {
    process.env.ALLOW_OPENAI = "true";
    expect(isOpenAiAllowed()).toBe(true);
    expect(() => assertOpenAiAllowed()).not.toThrow();
  });

  it("throws when OpenAI provider methods are invoked without ALLOW_OPENAI", async () => {
    process.env.OPENAI_API_KEY = "sk-test";
    const provider = createOpenAiProvider();
    expect(provider.isAvailable()).toBe(false);

    await expect(
      provider.generateText({
        messages: [{ role: "user", content: "hello" }],
      }),
    ).rejects.toThrow(OPENAI_DISABLED_ERROR);

    await expect(provider.generateEmbeddings(["hello"])).rejects.toThrow(OPENAI_DISABLED_ERROR);
  });
});