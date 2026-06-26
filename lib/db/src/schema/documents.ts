import { pgTable, text, serial, timestamp, integer, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const documentsTable = pgTable("documents", {
  id: serial("id").primaryKey(),
  ownerUserId: text("owner_user_id"),
  fileName: text("file_name").notNull(),
  fileType: text("file_type").notNull(),
  fileSize: integer("file_size"),
  extractedText: text("extracted_text"),
  extractionStatus: text("extraction_status").notNull().default("pending"),
  extractionError: text("extraction_error"),
  storageProvider: text("storage_provider"),
  storageKey: text("storage_key"),
  uploadedAt: timestamp("uploaded_at", { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
  deletedBy: text("deleted_by"),
}, (table) => [
  index("idx_documents_owner_user_id").on(table.ownerUserId),
  index("idx_documents_extraction_status").on(table.extractionStatus),
  index("idx_documents_deleted_at").on(table.deletedAt),
  index("idx_documents_owner_deleted_uploaded").on(table.ownerUserId, table.deletedAt, table.uploadedAt),
  index("idx_documents_owner_status_deleted_uploaded").on(table.ownerUserId, table.extractionStatus, table.deletedAt, table.uploadedAt),
]);

export const insertDocumentSchema = createInsertSchema(documentsTable).omit({ id: true, uploadedAt: true, deletedAt: true, deletedBy: true });
export type InsertDocument = z.infer<typeof insertDocumentSchema>;
export type Document = typeof documentsTable.$inferSelect;
