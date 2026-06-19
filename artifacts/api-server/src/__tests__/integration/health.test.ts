import { describe, it, expect, vi } from "vitest";
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
