import { pgTable, text, serial, integer, timestamp, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const chatMessagesTable = pgTable("chat_messages", {
  id: serial("id").primaryKey(),
  documentId: integer("document_id").notNull(),
  role: text("role").notNull(),
  content: text("content").notNull(),
  debug: text("debug"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("idx_chat_messages_document_id").on(table.documentId),
]);

export const insertChatMessageSchema = createInsertSchema(chatMessagesTable).omit({ id: true, createdAt: true });
export type InsertChatMessage = z.infer<typeof insertChatMessageSchema>;
export type ChatMessage = typeof chatMessagesTable.$inferSelect;
