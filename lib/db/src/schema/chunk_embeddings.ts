import { pgTable, text, integer, timestamp, index, primaryKey, jsonb } from "drizzle-orm/pg-core";
import { chunksTable } from "./chunks";

export const chunkEmbeddingsTable = pgTable("chunk_embeddings", {
  chunkId: integer("chunk_id")
    .notNull()
    .references(() => chunksTable.id, { onDelete: "cascade" }),
  model: text("model").notNull(),
  dimensions: integer("dimensions").notNull(),
  embedding: jsonb("embedding").$type<number[]>().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  primaryKey({ columns: [table.chunkId, table.model] }),
  index("idx_chunk_embeddings_model").on(table.model),
]);

export type ChunkEmbedding = typeof chunkEmbeddingsTable.$inferSelect;
