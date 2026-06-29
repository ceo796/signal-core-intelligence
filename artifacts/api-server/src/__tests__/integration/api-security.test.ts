import { describe, it, expect, vi, beforeAll, afterAll } from "vitest";
import request from "supertest";
import type { Express } from "express";

const clerkMocks = vi.hoisted(() => ({
  getAuth: vi.fn(() => ({ userId: null, sessionClaims: {} })),
}));

vi.mock("@clerk/express", () => ({
  clerkMiddleware: () => (_req: unknown, _res: unknown, next: () => void) => next(),
  getAuth: clerkMocks.getAuth,
  clerkClient: { users: { getUser: vi.fn() } },
}));

vi.mock("@clerk/shared/keys", () => ({
  publishableKeyFromHost: () => "pk_test_placeholder",
}));

vi.mock("../../lib/file-store.js", () => ({
  isConfigured: vi.fn(() => true),
  getStorageProviderName: vi.fn(() => "local"),
  getMimeType: vi.fn(() => "text/plain"),
  getRuntimeStorageStatus: vi.fn(() => ({
    provider: "local",
    configured: true,
    uploadsEnabled: true,
    storageProviderEnv: "local",
    fileStorageDir: "set",
    productionSafe: true,
  })),
  uploadFile: vi.fn(),
  downloadFile: vi.fn(),
  deleteFile: vi.fn(),
  logStorageStartupStatus: vi.fn(),
}));

describe("API security — public health routes", () => {
  let app: Express;

  beforeAll(async () => {
    const mod = await import("../../app.js");
    app = mod.default;
  });

  it("GET /health returns 200 without auth", async () => {
    const res = await request(app).get("/health");
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });

  it("GET /healthz returns 200 without auth", async () => {
    const res = await request(app).get("/healthz");
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });

  it("GET /api/healthz returns 200 without auth", async () => {
    const res = await request(app).get("/api/healthz");
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("ok");
  });

  it("GET /api/runtime-check returns JSON without auth", async () => {
    const res = await request(app).get("/api/runtime-check");
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("status");
    expect(JSON.stringify(res.body)).not.toMatch(/sk_|whsec_/);
  });

  it("same-origin style request without Origin header reaches /api/healthz", async () => {
    const res = await request(app).get("/api/healthz");
    expect(res.status).toBe(200);
    expect(res.headers["access-control-allow-origin"]).toBeUndefined();
  });
});

describe("API security — protected routes fail closed", () => {
  let app: Express;
  const savedBypass = process.env.CLERK_BYPASS_AUTH;
  const savedClerkSecret = process.env.CLERK_SECRET_KEY;

  beforeAll(async () => {
    vi.resetModules();
    delete process.env.CLERK_BYPASS_AUTH;
    process.env.CLERK_SECRET_KEY = "sk_test_security_gate";
    clerkMocks.getAuth.mockReturnValue({ userId: null, sessionClaims: {} });
    const mod = await import("../../app.js");
    app = mod.default;
  });

  afterAll(() => {
    if (savedBypass === undefined) delete process.env.CLERK_BYPASS_AUTH;
    else process.env.CLERK_BYPASS_AUTH = savedBypass;
    if (savedClerkSecret === undefined) delete process.env.CLERK_SECRET_KEY;
    else process.env.CLERK_SECRET_KEY = savedClerkSecret;
  });

  const protectedRoutes = [
    ["GET", "/api/documents"],
    ["GET", "/api/notes"],
    ["GET", "/api/trash"],
    ["POST", "/api/documents/multi-chat"],
    ["POST", "/api/agent/hybrid"],
    ["POST", "/api/skills/run"],
    ["GET", "/api/admin/stats"],
  ] as const;

  it.each(protectedRoutes)("%s %s returns 401 without authentication", async (method, path) => {
    const res = await request(app)[method.toLowerCase() as "get" | "post"](path).send({});
    expect(res.status).toBe(401);
  });
});