/**
 * Full API surface smoke test — hits every mounted route once with auth bypassed.
 * LLM routes use a mocked aiRouter; file uploads use a mocked file-store.
 */
import { afterAll, describe, expect, it, vi } from "vitest";
import request from "supertest";
import { randomUUID } from "crypto";
import { db, documentsTable, chunksTable, notesTable } from "@workspace/db";
import { eq, inArray } from "drizzle-orm";

const { mockRunTask } = vi.hoisted(() => ({
  mockRunTask: vi.fn(),
}));

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
  getRuntimeStorageStatus: vi.fn(() => ({
    provider: "local",
    configured: true,
    fileStorageDir: "set",
    productionSafe: true,
  })),
  getMimeType: vi.fn((type: string) => {
    const m: Record<string, string> = {
      pdf: "application/pdf",
      txt: "text/plain",
      csv: "text/csv",
    };
    return m[type.toLowerCase()] ?? "text/plain";
  }),
  uploadFile: vi.fn(async () => `/test-bucket/documents/${randomUUID()}`),
  downloadFile: vi.fn(async () => Buffer.from("stored original file content for smoke test")),
  deleteFile: vi.fn(async () => undefined),
}));

vi.mock("../../lib/ai/router.js", () => ({
  aiRouter: { runTask: mockRunTask },
  runTask: mockRunTask,
}));

import app from "../../app.js";

const TEST_USER_ID = "test-user-bypass";
const createdDocIds: number[] = [];
const createdNoteIds: number[] = [];

function txt(content: string, name: string) {
  return Buffer.from(content, "utf-8");
}

function mockAiAnswer(answer = "Smoke test AI answer with [Source 1] citation.") {
  mockRunTask.mockResolvedValue({
    taskType: "document_chat",
    answer,
    structuredData: null,
    citations: [],
    evidenceItems: [],
    warnings: [],
    confidence: "high",
    providerUsed: "google",
    modelUsed: "google/gemini-2.5-flash",
    fallbackUsed: false,
    fallbackReason: null,
    latencyMs: 12,
    tokenUsage: null,
  });
}

function mockAiBrief() {
  mockRunTask.mockResolvedValue({
    taskType: "executive_brief",
    answer: JSON.stringify({
      title: "Smoke Brief",
      sections: [{ heading: "Summary", body: "Grounded finding [Source 1]." }],
    }),
    structuredData: null,
    citations: [],
    evidenceItems: [],
    warnings: [],
    confidence: "high",
    providerUsed: "google",
    modelUsed: "google/gemini-2.5-flash",
    fallbackUsed: false,
    fallbackReason: null,
    latencyMs: 20,
    tokenUsage: null,
  });
}

describe("Full API smoke (every route)", () => {
  afterAll(async () => {
    if (createdNoteIds.length > 0) {
      await db.delete(notesTable).where(inArray(notesTable.id, createdNoteIds));
    }
    if (createdDocIds.length > 0) {
      await db.delete(chunksTable).where(inArray(chunksTable.documentId, createdDocIds));
      await db.delete(documentsTable).where(inArray(documentsTable.id, createdDocIds));
    }
  });

  // ─── Public health ─────────────────────────────────────────────────────────

  it("GET /health", async () => {
    const res = await request(app).get("/health");
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ ok: true, service: "signal87-api" });
  });

  it("GET /healthz (root)", async () => {
    const res = await request(app).get("/healthz");
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });

  it("GET /api/healthz", async () => {
    const res = await request(app).get("/api/healthz");
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("ok");
  });

  it("GET /api/runtime-check", async () => {
    const res = await request(app).get("/api/runtime-check");
    expect(res.status).toBe(200);
    expect(res.body.ai).toMatchObject({
      resolvedReasoningChain: ["google", "xai"],
      openaiRuntimeEnabled: false,
      openaiCallsEnabled: false,
      embeddingMode: "local",
      geminiAuthMode: "service_account",
      googleServiceAccount: "set",
      xai: "set",
    });
  });

  it("GET /api/demo/qa", async () => {
    const res = await request(app).get("/api/demo/qa");
    expect(res.status).toBe(200);
    expect(res.body.question).toBeTypeOf("string");
    expect(res.body.answer).toBeTypeOf("string");
  });

  it("GET /api/billing/status returns 401 without Clerk session", async () => {
    const res = await request(app).get("/api/billing/status");
    expect(res.status).toBe(401);
  });

  it("POST /api/billing/checkout returns 401 without Clerk session", async () => {
    const res = await request(app).post("/api/billing/checkout").send({});
    expect(res.status).toBe(401);
  });

  it("POST /api/billing/webhook rejects unsigned payload", async () => {
    const res = await request(app)
      .post("/api/billing/webhook")
      .set("Content-Type", "application/json")
      .send(JSON.stringify({ type: "ping" }));
    expect([400, 401, 503]).toContain(res.status);
  });

  // ─── Documents ───────────────────────────────────────────────────────────

  it("POST /api/documents/upload", async () => {
    const content = "Signal87 smoke test document alpha. Pricing is $99 per month. ".repeat(20);
    const res = await request(app)
      .post("/api/documents/upload")
      .attach("file", txt(content, "alpha.txt"), {
        filename: "smoke-alpha.txt",
        contentType: "text/plain",
      });
    expect(res.status).toBe(201);
    expect(res.body.chunkCount).toBeGreaterThan(0);
    createdDocIds.push(res.body.id);
  });

  it("POST /api/documents/upload (second doc for multi-chat)", async () => {
    const content = "Signal87 smoke test document beta. Contract obligations and liability terms. ".repeat(20);
    const res = await request(app)
      .post("/api/documents/upload")
      .attach("file", txt(content, "beta.txt"), {
        filename: "smoke-beta.txt",
        contentType: "text/plain",
      });
    expect(res.status).toBe(201);
    createdDocIds.push(res.body.id);
  });

  it("GET /api/documents", async () => {
    const res = await request(app).get("/api/documents");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.items)).toBe(true);
    expect(res.body.items.length).toBeGreaterThanOrEqual(2);
  });

  it("GET /api/documents/:id", async () => {
    const res = await request(app).get(`/api/documents/${createdDocIds[0]}`);
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(createdDocIds[0]);
  });

  it("GET /api/documents/:id/chunks", async () => {
    const res = await request(app).get(`/api/documents/${createdDocIds[0]}/chunks`);
    expect(res.status).toBe(200);
    expect(res.body.length).toBeGreaterThan(0);
  });

  it("GET /api/documents/:id/original", async () => {
    const res = await request(app).get(`/api/documents/${createdDocIds[0]}/original`);
    expect(res.status).toBe(200);
  });

  it("PUT /api/documents/:id/original replaces stored file", async () => {
    const content = "Replacement smoke test document content. ".repeat(30);
    const res = await request(app)
      .put(`/api/documents/${createdDocIds[0]}/original`)
      .attach("file", txt(content, "replace.txt"), {
        filename: "smoke-replace.txt",
        contentType: "text/plain",
      });
    expect(res.status).toBe(200);
    expect(res.body.originalFileAvailable).toBe(true);
  });

  it("POST /api/documents/:id/reindex", async () => {
    const res = await request(app).post(`/api/documents/${createdDocIds[0]}/reindex`);
    expect(res.status).toBe(200);
    expect(res.body.extractionStatus).toBe("success");
  });

  // ─── AI routes (mocked LLM) ──────────────────────────────────────────────

  it("POST /api/documents/:id/chat", async () => {
    mockAiAnswer();
    const res = await request(app)
      .post(`/api/documents/${createdDocIds[0]}/chat`)
      .send({ question: "What is the monthly pricing?" });
    expect(res.status).toBe(200);
    expect(res.body.answer).toContain("Smoke test AI answer");
    expect(res.body.debug.provider).toBe("google");
  });

  it("GET /api/documents/:id/history", async () => {
    const res = await request(app).get(`/api/documents/${createdDocIds[0]}/history`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);
  });

  it("POST /api/documents/multi-chat", async () => {
    mockAiAnswer("Comparison answer citing [Source 1] and [Source 2].");
    const res = await request(app)
      .post("/api/documents/multi-chat")
      .send({
        documentIds: [createdDocIds[0], createdDocIds[1]],
        question: "Compare obligations across these documents",
      });
    expect(res.status).toBe(200);
    expect(res.body.answer).toBeTypeOf("string");
    expect(res.body.citations.length).toBeGreaterThan(0);
  });

  it("POST /api/documents/brief", async () => {
    mockAiBrief();
    const res = await request(app)
      .post("/api/documents/brief")
      .send({
        documentIds: [createdDocIds[0]],
        briefType: "executive_summary",
      });
    expect(res.status).toBe(200);
    expect(res.body.title).toBe("Smoke Brief");
    expect(res.body.sections.length).toBeGreaterThan(0);
  });

  it("POST /api/agent/hybrid", async () => {
    mockAiAnswer("Hybrid answer with [Source 1] from your documents.");
    const res = await request(app)
      .post("/api/agent/hybrid")
      .send({
        query: "Summarize pricing and obligations",
        documentIds: createdDocIds,
        mode: "auto",
      });
    expect(res.status).toBe(200);
    expect(res.body.answer).toBeTypeOf("string");
    expect(res.body.trace.provider).toBe("google");
    expect(mockRunTask).toHaveBeenCalled();
  });

  it("GET /api/skills", async () => {
    const res = await request(app).get("/api/skills");
    expect(res.status).toBe(200);
    expect(res.body.skills.length).toBeGreaterThan(0);
  });

  it("POST /api/skills/run", async () => {
    mockAiAnswer("Skill summary with [Source 1].");
    const res = await request(app)
      .post("/api/skills/run")
      .send({
        skillId: "summarize-document",
        documentIds: [createdDocIds[0]],
      });
    expect(res.status).toBe(200);
    expect(res.body.answer).toBeTypeOf("string");
    expect(res.body.skill.skillId).toBe("summarize-document");
  });

  // ─── Notes ─────────────────────────────────────────────────────────────────

  it("POST /api/notes", async () => {
    const res = await request(app)
      .post("/api/notes")
      .send({ title: "Smoke note", content: "API smoke test note body" });
    expect(res.status).toBe(201);
    createdNoteIds.push(res.body.id);
  });

  it("GET /api/notes", async () => {
    const res = await request(app).get("/api/notes");
    expect(res.status).toBe(200);
    expect(res.body.items.length).toBeGreaterThan(0);
  });

  it("GET /api/notes/:id", async () => {
    const res = await request(app).get(`/api/notes/${createdNoteIds[0]}`);
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(createdNoteIds[0]);
  });

  it("PATCH /api/notes/:id", async () => {
    const res = await request(app)
      .patch(`/api/notes/${createdNoteIds[0]}`)
      .send({ title: "Updated smoke note" });
    expect(res.status).toBe(200);
    expect(res.body.title).toBe("Updated smoke note");
  });

  // ─── System / admin ────────────────────────────────────────────────────────

  it("GET /api/system/info", async () => {
    const res = await request(app).get("/api/system/info");
    expect(res.status).toBe(200);
    expect(res.body.framework).toBe("Express 5");
    expect(res.body.ai.router).toBe("aiRouter");
  });

  it("GET /api/admin/stats", async () => {
    const res = await request(app).get("/api/admin/stats");
    expect(res.status).toBe(200);
    expect(res.body.totalDocuments).toBeTypeOf("number");
  });

  // ─── Trash flow ──────────────────────────────────────────────────────────

  it("DELETE /api/documents/:id (soft delete → trash)", async () => {
    const trashDocId = createdDocIds[1];
    const res = await request(app).delete(`/api/documents/${trashDocId}`);
    expect(res.status).toBe(204);
  });

  it("GET /api/trash", async () => {
    const res = await request(app).get("/api/trash");
    expect(res.status).toBe(200);
    expect(res.body.items.some((d: { id: number }) => d.id === createdDocIds[1])).toBe(true);
  });

  it("POST /api/trash/:id/restore", async () => {
    const res = await request(app).post(`/api/trash/${createdDocIds[1]}/restore`);
    expect(res.status).toBe(200);
  });

  it("DELETE /api/documents/:id again for permanent trash test", async () => {
    const res = await request(app).delete(`/api/documents/${createdDocIds[1]}`);
    expect(res.status).toBe(204);
  });

  it("DELETE /api/trash/:id (permanent)", async () => {
    const res = await request(app).delete(`/api/trash/${createdDocIds[1]}`);
    expect(res.status).toBe(204);
    createdDocIds.splice(createdDocIds.indexOf(createdDocIds[1]), 1);
  });

  it("DELETE /api/documents/:id/history", async () => {
    const res = await request(app).delete(`/api/documents/${createdDocIds[0]}/history`);
    expect(res.status).toBe(204);
  });

  it("DELETE /api/notes/:id", async () => {
    const res = await request(app).delete(`/api/notes/${createdNoteIds[0]}`);
    expect(res.status).toBe(204);
    createdNoteIds.length = 0;
  });

  it("POST /api/trash/empty", async () => {
    const res = await request(app).post("/api/trash/empty");
    expect([200, 204]).toContain(res.status);
  });
});