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

  it("prefers service account over API key when both are set", () => {
    process.env.GEMINI_API_KEY = "AIza-test-key";
    process.env.GEMINI_SERVICE_ACCOUNT_PATH = "./.local/gemini-service-account.json";
    expect(geminiAuthMode()).toBe("service_account");
  });

  it("uses api_key when only API key is configured", () => {
    delete process.env.GEMINI_SERVICE_ACCOUNT_PATH;
    process.env.GEMINI_API_KEY = "AIza-test-key";
    expect(geminiAuthMode()).toBe("api_key");
  });
});