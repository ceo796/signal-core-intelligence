import { describe, it, expect, vi, afterAll } from "vitest";
import request from "supertest";

vi.mock("@clerk/express", () => ({
  clerkMiddleware: () => (_req: unknown, _res: unknown, next: () => void) => next(),
  getAuth: () => ({ userId: null, sessionClaims: {} }),
  clerkClient: { users: { getUser: vi.fn() } },
}));
vi.mock("@clerk/shared/keys", () => ({
  publishableKeyFromHost: () => "pk_test_placeholder",
}));

vi.mock("../../lib/ai/router.js", () => ({
  aiRouter: {
    runTask: vi.fn(async ({ taskType }: { taskType: string }) => ({
      answer:
        taskType === "fact_extraction"
          ? "## Extracted Key Terms\n\n| Term or item | Meaning/value | Why it matters | Source |\n| --- | --- | --- | --- |\n| Payment term | Net 30 | Cash timing | [Source 1] |"
          : "## Executive summary\n\nKey fact from document. [Source 1]\n\nSources\n- [Source 1] — sample.txt",
      providerUsed: "xai",
      modelUsed: "grok-4.3",
      fallbackUsed: false,
    })),
  },
}));

import app from "../../app.js";
import { db, documentsTable, chunksTable } from "@workspace/db";
import { eq, inArray } from "drizzle-orm";

const createdDocIds: number[] = [];

function txtBuffer(content: string): Buffer {
  return Buffer.from(content, "utf-8");
}

describe("Skills integration", () => {
  afterAll(async () => {
    if (createdDocIds.length > 0) {
      await db.delete(chunksTable).where(inArray(chunksTable.documentId, createdDocIds));
      await db.delete(documentsTable).where(inArray(documentsTable.id, createdDocIds));
    }
  });

  it("GET /api/skills returns the curated skill catalog", async () => {
    const res = await request(app).get("/api/skills");
    expect(res.status).toBe(200);
    expect(res.body.skills).toHaveLength(3);
    expect(res.body.skills.map((s: { skillId: string }) => s.skillId)).toEqual([
      "quick-summary",
      "extract-key-terms",
      "timeline-builder",
    ]);
    expect(res.body.guidance).toMatch(/Analyze/i);
  });

  it("POST /api/skills/run rejects removed legacy skill ids", async () => {
    const res = await request(app).post("/api/skills/run").send({
      skillId: "executive-brief",
      documentIds: [1],
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/Unknown skillId/i);
  });

  it("runs quick-summary against an uploaded document", async () => {
    const upload = await request(app)
      .post("/api/documents/upload")
      .attach("file", txtBuffer("Payment is due within 30 days of invoice date."), {
        filename: "skills-summary.txt",
        contentType: "text/plain",
      });
    expect(upload.status).toBe(201);
    createdDocIds.push(upload.body.id);

    const res = await request(app).post("/api/skills/run").send({
      skillId: "quick-summary",
      documentIds: [upload.body.id],
    });
    expect(res.status).toBe(200);
    expect(res.body.skill.skillId).toBe("quick-summary");
    expect(res.body.answer).toMatch(/Executive summary/i);
    expect(res.body.citations.length).toBeGreaterThan(0);
  });

  it("runs extract-key-terms and returns table-shaped markdown", async () => {
    const upload = await request(app)
      .post("/api/documents/upload")
      .attach("file", txtBuffer("Net 30 payment terms apply to all invoices."), {
        filename: "skills-extract.txt",
        contentType: "text/plain",
      });
    expect(upload.status).toBe(201);
    createdDocIds.push(upload.body.id);

    const res = await request(app).post("/api/skills/run").send({
      skillId: "extract-key-terms",
      documentIds: [upload.body.id],
    });
    expect(res.status).toBe(200);
    expect(res.body.skill.skillId).toBe("extract-key-terms");
    expect(res.body.answer).toMatch(/\| Term or item \|/);
    expect(res.body.trace.provider).toBe("xai");
  });

  it("runs timeline-builder", async () => {
    const upload = await request(app)
      .post("/api/documents/upload")
      .attach("file", txtBuffer("Closing date: March 15, 2026. Notice period: 30 days."), {
        filename: "skills-timeline.txt",
        contentType: "text/plain",
      });
    expect(upload.status).toBe(201);
    createdDocIds.push(upload.body.id);

    const res = await request(app).post("/api/skills/run").send({
      skillId: "timeline-builder",
      documentIds: [upload.body.id],
    });
    expect(res.status).toBe(200);
    expect(res.body.skill.skillId).toBe("timeline-builder");
    expect(res.body.answer.length).toBeGreaterThan(0);
  });
});