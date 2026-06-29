/**
 * User isolation integration tests.
 *
 * These tests verify that ownerUserId scoping prevents one user from reading,
 * deleting, or querying another user's documents. The ownership module is mocked
 * so we can control exactly which userId each request sees — the same mechanism
 * the real codebase uses (getCurrentUserId) is exercised, just with a controllable
 * return value instead of a live Clerk session.
 */
import { describe, it, expect, vi, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { randomUUID } from "crypto";

vi.mock("@clerk/express", () => ({
  clerkMiddleware: () => (_req: unknown, _res: unknown, next: () => void) => next(),
  getAuth: () => ({ userId: null, sessionClaims: {} }),
  clerkClient: { users: { getUser: vi.fn() } },
}));
vi.mock("@clerk/shared/keys", () => ({
  publishableKeyFromHost: () => "pk_test_placeholder",
}));
vi.mock("../../lib/file-store.js", () => ({
  isConfigured: vi.fn(() => true),
  getStorageProviderName: vi.fn(() => "local"),
  getMimeType: vi.fn(() => "text/plain"),
  uploadFile: vi.fn(async () => `/test-bucket/documents/${randomUUID()}`),
  downloadFile: vi.fn(async () => Buffer.from("content")),
  deleteFile: vi.fn(async () => undefined),
  logStorageStartupStatus: vi.fn(),
}));

// Mock ownership so we can swap the active userId per-test
vi.mock("../../lib/ownership.js", () => ({
  getCurrentUserId: vi.fn(() => "user-a-default"),
}));

import app from "../../app.js";
import { getCurrentUserId } from "../../lib/ownership.js";
import { db, documentsTable, chunksTable } from "@workspace/db";
import { eq, inArray } from "drizzle-orm";

const USER_A = `isolation-user-a-${randomUUID()}`;
const USER_B = `isolation-user-b-${randomUUID()}`;

const userADocIds: number[] = [];
const userBDocIds: number[] = [];

function txtBuffer(text: string) {
  return Buffer.from(text, "utf-8");
}

async function uploadAs(userId: string, fileName: string): Promise<number> {
  vi.mocked(getCurrentUserId).mockReturnValue(userId);
  const res = await request(app)
    .post("/api/documents/upload")
    .attach("file", txtBuffer("word ".repeat(50)), {
      filename: fileName,
      contentType: "text/plain",
    });
  if (res.status !== 201) {
    throw new Error(`Upload failed for ${fileName}: ${JSON.stringify(res.body)}`);
  }
  return res.body.id as number;
}

describe("User isolation — ownerUserId scoping", () => {
  beforeAll(async () => {
    // Seed: user A uploads two documents, user B uploads one
    const a1 = await uploadAs(USER_A, "user-a-doc1.txt");
    const a2 = await uploadAs(USER_A, "user-a-doc2.txt");
    const b1 = await uploadAs(USER_B, "user-b-doc1.txt");
    userADocIds.push(a1, a2);
    userBDocIds.push(b1);
  });

  afterAll(async () => {
    // Clean up test data for both users
    const allIds = [...userADocIds, ...userBDocIds];
    if (allIds.length > 0) {
      await db.delete(chunksTable).where(inArray(chunksTable.documentId, allIds));
      await db.delete(documentsTable).where(inArray(documentsTable.id, allIds));
    }
  });

  describe("GET /api/documents (list)", () => {
    it("user A only sees their own documents", async () => {
      vi.mocked(getCurrentUserId).mockReturnValue(USER_A);
      const res = await request(app).get("/api/documents");
      expect(res.status).toBe(200);
      const ids = (res.body.items as Array<{ id: number }>).map((d) => d.id);
      for (const aId of userADocIds) {
        expect(ids).toContain(aId);
      }
      for (const bId of userBDocIds) {
        expect(ids).not.toContain(bId);
      }
    });

    it("user B only sees their own documents", async () => {
      vi.mocked(getCurrentUserId).mockReturnValue(USER_B);
      const res = await request(app).get("/api/documents");
      expect(res.status).toBe(200);
      const ids = (res.body.items as Array<{ id: number }>).map((d) => d.id);
      for (const bId of userBDocIds) {
        expect(ids).toContain(bId);
      }
      for (const aId of userADocIds) {
        expect(ids).not.toContain(aId);
      }
    });
  });

  describe("GET /api/documents/:id (detail)", () => {
    it("user A cannot access user B's document — returns 404", async () => {
      vi.mocked(getCurrentUserId).mockReturnValue(USER_A);
      const bDocId = userBDocIds[0];
      const res = await request(app).get(`/api/documents/${bDocId}`);
      expect(res.status).toBe(404);
    });

    it("user B cannot access user A's document — returns 404", async () => {
      vi.mocked(getCurrentUserId).mockReturnValue(USER_B);
      const aDocId = userADocIds[0];
      const res = await request(app).get(`/api/documents/${aDocId}`);
      expect(res.status).toBe(404);
    });

    it("user A can access their own document", async () => {
      vi.mocked(getCurrentUserId).mockReturnValue(USER_A);
      const res = await request(app).get(`/api/documents/${userADocIds[0]}`);
      expect(res.status).toBe(200);
      expect(res.body.id).toBe(userADocIds[0]);
    });
  });

  describe("GET /api/documents/:id/chunks (chunks)", () => {
    it("user A cannot read user B's chunks — returns 404", async () => {
      vi.mocked(getCurrentUserId).mockReturnValue(USER_A);
      const bDocId = userBDocIds[0];
      const res = await request(app).get(`/api/documents/${bDocId}/chunks`);
      expect(res.status).toBe(404);
    });
  });

  describe("DELETE /api/documents/:id", () => {
    it("user A cannot delete user B's document — returns 404", async () => {
      vi.mocked(getCurrentUserId).mockReturnValue(USER_A);
      const bDocId = userBDocIds[0];
      const res = await request(app).delete(`/api/documents/${bDocId}`);
      expect(res.status).toBe(404);
    });

    it("user B's document still exists after user A's failed delete attempt", async () => {
      vi.mocked(getCurrentUserId).mockReturnValue(USER_B);
      const bDocId = userBDocIds[0];
      const res = await request(app).get(`/api/documents/${bDocId}`);
      expect(res.status).toBe(200);
    });
  });

  describe("POST /api/documents/:id/reindex", () => {
    it("user A cannot reindex user B's document — returns 404", async () => {
      vi.mocked(getCurrentUserId).mockReturnValue(USER_A);
      const bDocId = userBDocIds[0];
      const res = await request(app).post(`/api/documents/${bDocId}/reindex`);
      expect(res.status).toBe(404);
    });
  });
});
