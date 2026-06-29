import { describe, expect, it, afterEach, vi } from "vitest";
import express from "express";
import request from "supertest";

describe("resolveAllowedOrigins", () => {
  const originalEnv = process.env.CORS_ALLOWED_ORIGINS;
  const originalDev = process.env.CORS_DEV_ORIGINS;

  afterEach(() => {
    if (originalEnv === undefined) delete process.env.CORS_ALLOWED_ORIGINS;
    else process.env.CORS_ALLOWED_ORIGINS = originalEnv;
    if (originalDev === undefined) delete process.env.CORS_DEV_ORIGINS;
    else process.env.CORS_DEV_ORIGINS = originalDev;
    vi.resetModules();
  });

  it("returns empty list in production when CORS_ALLOWED_ORIGINS is unset", async () => {
    delete process.env.CORS_ALLOWED_ORIGINS;
    const { resolveAllowedOrigins } = await import("../../lib/cors-config.js");
    expect(resolveAllowedOrigins("production")).toEqual([]);
  });

  it("returns empty list in test when CORS_ALLOWED_ORIGINS is unset", async () => {
    delete process.env.CORS_ALLOWED_ORIGINS;
    const { resolveAllowedOrigins } = await import("../../lib/cors-config.js");
    expect(resolveAllowedOrigins("test")).toEqual([]);
  });

  it("returns local dev origins in development", async () => {
    delete process.env.CORS_ALLOWED_ORIGINS;
    delete process.env.CORS_DEV_ORIGINS;
    const { resolveAllowedOrigins } = await import("../../lib/cors-config.js");
    expect(resolveAllowedOrigins("development")).toContain("http://localhost:5173");
    expect(resolveAllowedOrigins("development")).toContain("http://127.0.0.1:8080");
  });

  it("prefers CORS_ALLOWED_ORIGINS over development defaults", async () => {
    process.env.CORS_ALLOWED_ORIGINS = "https://app.example.com";
    const { resolveAllowedOrigins } = await import("../../lib/cors-config.js");
    expect(resolveAllowedOrigins("development")).toEqual(["https://app.example.com"]);
  });
});

describe("applyCorsIfConfigured", () => {
  const original = process.env.CORS_ALLOWED_ORIGINS;
  const originalNodeEnv = process.env.NODE_ENV;

  afterEach(() => {
    if (original === undefined) delete process.env.CORS_ALLOWED_ORIGINS;
    else process.env.CORS_ALLOWED_ORIGINS = original;
    if (originalNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = originalNodeEnv;
    vi.resetModules();
  });

  it("does not attach CORS headers in test/production without allowlist", async () => {
    delete process.env.CORS_ALLOWED_ORIGINS;
    process.env.NODE_ENV = "test";
    const app = express();
    const { applyCorsIfConfigured } = await import("../../lib/cors-config.js");
    applyCorsIfConfigured(app);
    app.get("/test", (_req, res) => res.json({ ok: true }));

    const res = await request(app)
      .get("/test")
      .set("Origin", "https://other.example");

    expect(res.headers["access-control-allow-origin"]).toBeUndefined();
  });

  it("allows configured origins when CORS_ALLOWED_ORIGINS is set", async () => {
    process.env.CORS_ALLOWED_ORIGINS = "https://app.example.com";
    process.env.NODE_ENV = "production";
    const app = express();
    const { applyCorsIfConfigured } = await import("../../lib/cors-config.js");
    applyCorsIfConfigured(app);
    app.get("/test", (_req, res) => res.json({ ok: true }));

    const allowed = await request(app)
      .get("/test")
      .set("Origin", "https://app.example.com");
    expect(allowed.headers["access-control-allow-origin"]).toBe("https://app.example.com");

    const blocked = await request(app)
      .get("/test")
      .set("Origin", "https://evil.example");
    expect(blocked.headers["access-control-allow-origin"]).toBeUndefined();
  });

  it("allows localhost dev origins in development", async () => {
    delete process.env.CORS_ALLOWED_ORIGINS;
    process.env.NODE_ENV = "development";
    const app = express();
    const { applyCorsIfConfigured } = await import("../../lib/cors-config.js");
    applyCorsIfConfigured(app);
    app.get("/test", (_req, res) => res.json({ ok: true }));

    const res = await request(app)
      .get("/test")
      .set("Origin", "http://localhost:5173");

    expect(res.headers["access-control-allow-origin"]).toBe("http://localhost:5173");
  });
});