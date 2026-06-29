import { beforeEach, describe, it, expect, vi } from "vitest";
import request from "supertest";

vi.mock("@clerk/express", () => ({
  clerkMiddleware: () => (_req: unknown, _res: unknown, next: () => void) => next(),
  getAuth: () => ({ userId: null, sessionClaims: {} }),
  clerkClient: { users: { getUser: vi.fn() } },
}));

vi.mock("@clerk/shared/keys", () => ({
  publishableKeyFromHost: () => "pk_test_placeholder",
}));

import app from "../../app.js";

beforeEach(() => {
  process.env.AI_PRIMARY_REASONING_PROVIDER = "xai";
  process.env.AI_FINAL_FALLBACK_PROVIDER = "google";
  delete process.env.AI_FALLBACK_PROVIDER_ORDER;
});

describe("GET /api/healthz", () => {
  it("returns 200 with status ok", async () => {
    const res = await request(app).get("/api/healthz");
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: "ok" });
  });

  it("does not require authentication", async () => {
    const res = await request(app).get("/api/healthz");
    expect(res.status).not.toBe(401);
    expect(res.status).not.toBe(403);
  });
});

describe("GET /api/health", () => {
  it("returns readiness checks without exposing secret values", async () => {
    const res = await request(app).get("/api/health");
    expect([200, 503]).toContain(res.status);
    expect(res.body).toMatchObject({
      service: "signal87-api",
      checks: {
        database: {
          configured: expect.any(Boolean),
          ready: expect.any(Boolean),
        },
        storage: {
          configured: expect.any(Boolean),
          ready: expect.any(Boolean),
        },
        aiRouter: {
          resolvedReasoningChain: ["xai", "google"],
          resolvedProviderChain: {
            document_chat: ["xai", "google"],
            multi_document_chat: ["xai", "google"],
            executive_brief: ["xai", "google"],
            extraction: [],
          },
          openaiEnabled: false,
          embeddingStatus: "local",
        },
      },
    });
    expect(JSON.stringify(res.body)).not.toMatch(/sk_|whsec_|BEGIN PRIVATE KEY/);
  });

  it("does not require authentication", async () => {
    const res = await request(app).get("/api/health");
    expect(res.status).not.toBe(401);
    expect(res.status).not.toBe(403);
  });
});

describe("GET /api/runtime-check", () => {
  it("reports Grok-first provider chains and disabled OpenAI", async () => {
    const res = await request(app).get("/api/runtime-check");
    expect(res.status).toBe(200);
    expect(res.body.ai).toMatchObject({
      openaiEnabled: false,
      resolvedProviderChain: {
        document_chat: ["xai", "google"],
        multi_document_chat: ["xai", "google"],
        executive_brief: ["xai", "google"],
        extraction: [],
      },
      embeddingProvider: "google",
      embeddingStatus: "local",
    });
  });
});