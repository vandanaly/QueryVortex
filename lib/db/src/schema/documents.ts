import { pgTable, serial, text, integer, timestamp, pgEnum, jsonb, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const documentStatusEnum = pgEnum("document_status", [
  "pending",
  "processing",
  "ready",
  "error",
]);

export const documentsTable = pgTable("documents", {
  id: serial("id").primaryKey(),
  filename: text("filename").notNull(),
  originalName: text("original_name").notNull(),
  status: documentStatusEnum("status").notNull().default("pending"),
  chunkCount: integer("chunk_count").notNull().default(0),
  pageCount: integer("page_count"),
  hasOcr: boolean("has_ocr").notNull().default(false),
  hasTables: boolean("has_tables").notNull().default(false),
  docMetadata: jsonb("doc_metadata").notNull().default({}),
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertDocumentSchema = createInsertSchema(documentsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertDocument = z.infer<typeof insertDocumentSchema>;
export type Document = typeof documentsTable.$inferSelect;
