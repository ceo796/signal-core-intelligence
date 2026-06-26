import { pgTable, text, serial, timestamp, boolean, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const notesTable = pgTable("notes", {
  id: serial("id").primaryKey(),
  ownerUserId: text("owner_user_id").notNull(),
  title: text("title").notNull(),
  content: text("content").notNull().default(""),
  tags: text("tags").notNull().default("[]"),
  icon: text("icon").notNull().default("FileText"),
  isPinned: boolean("is_pinned").notNull().default(false),
  archivedAt: timestamp("archived_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("idx_notes_owner_user_id").on(table.ownerUserId),
  index("idx_notes_owner_archived_updated").on(table.ownerUserId, table.archivedAt, table.updatedAt),
  index("idx_notes_owner_pinned_updated").on(table.ownerUserId, table.isPinned, table.updatedAt),
]);

export const insertNoteSchema = createInsertSchema(notesTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertNote = z.infer<typeof insertNoteSchema>;
export type Note = typeof notesTable.$inferSelect;
