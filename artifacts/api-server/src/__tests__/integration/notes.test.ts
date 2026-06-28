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

import app from "../../app.js";
import { db, notesTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const TEST_USER_ID = "test-user-bypass";
const createdNoteIds: number[] = [];

describe("Notes CRUD integration (auth bypassed)", () => {
  afterAll(async () => {
    if (createdNoteIds.length > 0) {
      await db.delete(notesTable).where(eq(notesTable.ownerUserId, TEST_USER_ID));
    }
  });

  it("creates, lists, updates, and deletes a note", async () => {
    const createRes = await request(app).post("/api/notes").send({}).expect(201);
    expect(createRes.body.title).toBe("Untitled");
    createdNoteIds.push(createRes.body.id);

    const listRes = await request(app).get("/api/notes").expect(200);
    expect(listRes.body.items.some((note: { id: number }) => note.id === createRes.body.id)).toBe(true);

    const patchRes = await request(app)
      .patch(`/api/notes/${createRes.body.id}`)
      .send({ title: "Deal memo", content: "First thought" })
      .expect(200);
    expect(patchRes.body.title).toBe("Deal memo");

    await request(app).delete(`/api/notes/${createRes.body.id}`).expect(204);
    createdNoteIds.length = 0;
  });
});