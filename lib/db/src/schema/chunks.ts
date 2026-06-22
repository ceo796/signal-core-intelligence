import { pgTable, text, serial, integer, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { documentsTable } from "./documents";

export const chunksTable = pgTable("chunks", {
  id: serial("id").primaryKey(),
  documentId: integer("document_id").notNull().references(() => documentsTable.id),
  chunkIndex: integer("chunk_index").notNull(),
  content: text("content").notNull(),
}, (table) => [
  index("idx_chunks_document_id").on(table.documentId),
]);

export const insertChunkSchema = createInsertSchema(chunksTable).omit({ id: true });
export type InsertChunk = z.infer<typeof insertChunkSchema>;
export type Chunk = typeof chunksTable.$inferSelect;
