import { describe, expect, it, afterEach } from "vitest";
import express from "express";
import request from "supertest";

describe("applyCorsIfConfigured", () => {
  const original = process.env.CORS_ALLOWED_ORIGINS;

  afterEach(() => {
    if (original === undefined) delete process.env.CORS_ALLOWED_ORIGINS;
    else process.env.CORS_ALLOWED_ORIGINS = original;
  });

  it("does not attach CORS headers when CORS_ALLOWED_ORIGINS is unset", async () => {
    delete process.env.CORS_ALLOWED_ORIGINS;
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
    const app = express();
    const { applyCorsIfConfigured } = await import("../../lib/cors-config.js");
    applyCorsIfConfigured(app);
    app.get("/test", (_req, res) => res.json({ ok: true }));

    const res = await request(app)
      .get("/test")
      .set("Origin", "https://app.example.com");

    expect(res.headers["access-control-allow-origin"]).toBe("https://app.example.com");
  });
});