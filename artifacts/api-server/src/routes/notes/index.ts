import { Router, type IRouter } from "express";
import { and, desc, eq, ilike, isNotNull, isNull, or } from "drizzle-orm";
import { db, notesTable } from "@workspace/db";
import { getCurrentUserId } from "../../lib/ownership";
import { ensureNotesTables } from "../../lib/notes-schema";

const router: IRouter = Router();

router.use(async (req, res, next) => {
  try {
    await ensureNotesTables();
    next();
  } catch (err) {
    req.log.error({ err }, "Notes schema unavailable");
    res.status(503).json({ error: "Notes storage is not ready. Try again shortly." });
  }
});

interface NotePayload {
  title?: string;
  content?: string;
  tags?: string[];
  icon?: string;
  isPinned?: boolean;
  archived?: boolean;
}

function parseTags(raw: string): string[] {
  try {
    const value = JSON.parse(raw);
    if (!Array.isArray(value)) return [];
    return value.filter((tag): tag is string => typeof tag === "string");
  } catch {
    return [];
  }
}

function serializeNote(note: typeof notesTable.$inferSelect) {
  return {
    id: note.id,
    title: note.title,
    content: note.content,
    tags: parseTags(note.tags),
    icon: note.icon,
    isPinned: note.isPinned,
    archivedAt: note.archivedAt?.toISOString() ?? null,
    createdAt: note.createdAt.toISOString(),
    updatedAt: note.updatedAt.toISOString(),
  };
}

function getValidatedId(raw: string): number | null {
  const id = Number.parseInt(raw, 10);
  return Number.isFinite(id) && id > 0 ? id : null;
}

function parsePayload(body: unknown, options: { allowArchived: boolean }): { ok: true; data: NotePayload } | { ok: false; error: string } {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { ok: false, error: "Payload must be an object" };
  }

  const input = body as Record<string, unknown>;
  const data: NotePayload = {};

  if ("title" in input) {
    if (typeof input.title !== "string") return { ok: false, error: "title must be a string" };
    const title = input.title.trim();
    if (title.length > 160) return { ok: false, error: "title must be 160 characters or fewer" };
    if (title) data.title = title;
  }

  if ("content" in input) {
    if (typeof input.content !== "string") return { ok: false, error: "content must be a string" };
    if (input.content.length > 100_000) return { ok: false, error: "content is too long" };
    data.content = input.content;
  }

  if ("tags" in input) {
    if (!Array.isArray(input.tags)) return { ok: false, error: "tags must be an array" };
    const tags = input.tags
      .map((tag) => (typeof tag === "string" ? tag.trim().replace(/^#/, "") : ""))
      .filter(Boolean);
    if (tags.length > 12 || tags.some((tag) => tag.length > 40)) {
      return { ok: false, error: "tags must be 12 items or fewer, 40 characters max" };
    }
    data.tags = [...new Set(tags)];
  }

  if ("icon" in input) {
    if (typeof input.icon !== "string") return { ok: false, error: "icon must be a string" };
    const icon = input.icon.trim();
    if (!icon || icon.length > 40) return { ok: false, error: "icon must be 1-40 characters" };
    data.icon = icon;
  }

  if ("isPinned" in input) {
    if (typeof input.isPinned !== "boolean") return { ok: false, error: "isPinned must be a boolean" };
    data.isPinned = input.isPinned;
  }

  if ("archived" in input) {
    if (!options.allowArchived) return { ok: false, error: "archived is not allowed here" };
    if (typeof input.archived !== "boolean") return { ok: false, error: "archived must be a boolean" };
    data.archived = input.archived;
  }

  return { ok: true, data };
}

router.get("/notes", async (req, res): Promise<void> => {
  const userId = getCurrentUserId(req);
  if (!userId) {
    res.status(401).json({ error: "Unauthorized." });
    return;
  }

  const includeArchived = req.query.archived === "true";
  const search = typeof req.query.search === "string" ? req.query.search.trim() : "";

  const filters = [
    eq(notesTable.ownerUserId, userId),
    includeArchived ? isNotNull(notesTable.archivedAt) : isNull(notesTable.archivedAt),
  ];

  if (search) {
    const pattern = `%${search}%`;
    filters.push(or(ilike(notesTable.title, pattern), ilike(notesTable.content, pattern), ilike(notesTable.tags, pattern))!);
  }

  try {
    const notes = await db
      .select()
      .from(notesTable)
      .where(and(...filters))
      .orderBy(desc(notesTable.isPinned), desc(notesTable.updatedAt))
      .limit(200);

    res.json({ items: notes.map(serializeNote) });
  } catch (err) {
    req.log.error({ err }, "Failed to list notes");
    res.status(500).json({ error: "Failed to list notes" });
  }
});

router.post("/notes", async (req, res): Promise<void> => {
  const userId = getCurrentUserId(req);
  if (!userId) {
    res.status(401).json({ error: "Unauthorized." });
    return;
  }

  const parsed = parsePayload(req.body ?? {}, { allowArchived: false });
  if (!parsed.ok) {
    res.status(400).json({ error: parsed.error });
    return;
  }

  const input = parsed.data;
  const now = new Date();

  try {
    const [note] = await db
      .insert(notesTable)
      .values({
        ownerUserId: userId,
        title: input.title || "Untitled",
        content: input.content ?? "",
        tags: JSON.stringify(input.tags ?? []),
        icon: input.icon || "FileText",
        isPinned: input.isPinned ?? false,
        updatedAt: now,
      })
      .returning();

    res.status(201).json(serializeNote(note));
  } catch (err) {
    req.log.error({ err }, "Failed to create note");
    res.status(500).json({ error: "Failed to create note" });
  }
});

router.get("/notes/:id", async (req, res): Promise<void> => {
  const userId = getCurrentUserId(req);
  if (!userId) {
    res.status(401).json({ error: "Unauthorized." });
    return;
  }

  const id = getValidatedId(req.params.id);
  if (!id) {
    res.status(400).json({ error: "Invalid note ID" });
    return;
  }

  const [note] = await db
    .select()
    .from(notesTable)
    .where(and(eq(notesTable.id, id), eq(notesTable.ownerUserId, userId)));

  if (!note) {
    res.status(404).json({ error: "Note not found" });
    return;
  }

  res.json(serializeNote(note));
});

router.patch("/notes/:id", async (req, res): Promise<void> => {
  const userId = getCurrentUserId(req);
  if (!userId) {
    res.status(401).json({ error: "Unauthorized." });
    return;
  }

  const id = getValidatedId(req.params.id);
  if (!id) {
    res.status(400).json({ error: "Invalid note ID" });
    return;
  }

  const parsed = parsePayload(req.body ?? {}, { allowArchived: true });
  if (!parsed.ok) {
    res.status(400).json({ error: parsed.error });
    return;
  }

  const input = parsed.data;
  const now = new Date();

  const patch: Partial<typeof notesTable.$inferInsert> = {
    updatedAt: now,
  };
  if (input.title !== undefined) patch.title = input.title;
  if (input.content !== undefined) patch.content = input.content;
  if (input.tags !== undefined) patch.tags = JSON.stringify(input.tags);
  if (input.icon !== undefined) patch.icon = input.icon;
  if (input.isPinned !== undefined) patch.isPinned = input.isPinned;
  if (input.archived !== undefined) patch.archivedAt = input.archived ? now : null;

  try {
    const [note] = await db
      .update(notesTable)
      .set(patch)
      .where(and(eq(notesTable.id, id), eq(notesTable.ownerUserId, userId)))
      .returning();

    if (!note) {
      res.status(404).json({ error: "Note not found" });
      return;
    }

    res.json(serializeNote(note));
  } catch (err) {
    req.log.error({ err, noteId: id }, "Failed to update note");
    res.status(500).json({ error: "Failed to update note" });
  }
});

router.delete("/notes/:id", async (req, res): Promise<void> => {
  const userId = getCurrentUserId(req);
  if (!userId) {
    res.status(401).json({ error: "Unauthorized." });
    return;
  }

  const id = getValidatedId(req.params.id);
  if (!id) {
    res.status(400).json({ error: "Invalid note ID" });
    return;
  }

  const [note] = await db
    .delete(notesTable)
    .where(and(eq(notesTable.id, id), eq(notesTable.ownerUserId, userId)))
    .returning({ id: notesTable.id });

  if (!note) {
    res.status(404).json({ error: "Note not found" });
    return;
  }

  res.sendStatus(204);
});

export default router;
