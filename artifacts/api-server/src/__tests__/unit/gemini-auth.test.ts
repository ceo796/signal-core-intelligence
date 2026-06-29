import { afterEach, describe, expect, it } from "vitest";
import { geminiAuthMode } from "../../lib/ai/providers/gemini-auth.js";

describe("geminiAuthMode", () => {
  const origApi = process.env.GEMINI_API_KEY;
  const origPath = process.env.GEMINI_SERVICE_ACCOUNT_PATH;

  afterEach(() => {
    if (origApi === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = origApi;
    if (origPath === undefined) delete process.env.GEMINI_SERVICE_ACCOUNT_PATH;
    else process.env.GEMINI_SERVICE_ACCOUNT_PATH = origPath;
  });

  it("uses service account when configured", () => {
    process.env.GEMINI_SERVICE_ACCOUNT_PATH = "./.local/gemini-service-account.json";
    expect(geminiAuthMode()).toBe("service_account");
  });

  it("ignores API keys and reports missing when no service account is configured", () => {
    delete process.env.GEMINI_SERVICE_ACCOUNT_PATH;
    process.env.GEMINI_API_KEY = "AIza-test-key";
    expect(geminiAuthMode()).toBe("missing");
  });
});