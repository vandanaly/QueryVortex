import {
  pgTable,
  serial,
  text,
  integer,
  timestamp,
  jsonb,
  pgEnum,
  index,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { documentsTable } from "./documents";

export const chunkTypeEnum = pgEnum("chunk_type", ["text", "table", "ocr"]);

export const chunksTable = pgTable(
  "chunks",
  {
    id: serial("id").primaryKey(),
    documentId: integer("document_id")
      .notNull()
      .references(() => documentsTable.id, { onDelete: "cascade" }),
    chunkIndex: integer("chunk_index").notNull(),
    text: text("text").notNull(),
    chunkType: chunkTypeEnum("chunk_type").notNull().default("text"),
    pageNumber: integer("page_number"),
    tableData: jsonb("table_data"),
    metadata: jsonb("metadata").notNull().default({}),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    index("chunks_document_id_idx").on(table.documentId),
    index("chunks_text_search_idx").using(
      "gin",
      sql`to_tsvector('english', ${table.text})`
    ),
  ]
);

export const insertChunkSchema = createInsertSchema(chunksTable).omit({
  id: true,
  createdAt: true,
});

export type InsertChunk = z.infer<typeof insertChunkSchema>;
export type Chunk = typeof chunksTable.$inferSelect;
