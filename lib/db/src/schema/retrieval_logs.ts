import { pgTable, serial, text, integer, timestamp, jsonb, real } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const retrievalLogsTable = pgTable("retrieval_logs", {
  id: serial("id").primaryKey(),
  query: text("query").notNull(),
  chunkIds: jsonb("chunk_ids").notNull().default([]),
  scores: jsonb("scores").notNull().default({}),
  latencyMs: real("latency_ms"),
  metadata: jsonb("metadata").notNull().default({}),
  conversationId: integer("conversation_id"),
  messageId: integer("message_id"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertRetrievalLogSchema = createInsertSchema(retrievalLogsTable).omit({
  id: true,
  createdAt: true,
});

export type InsertRetrievalLog = z.infer<typeof insertRetrievalLogSchema>;
export type RetrievalLog = typeof retrievalLogsTable.$inferSelect;
