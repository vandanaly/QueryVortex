import { pgTable, serial, text, integer, timestamp, jsonb, pgEnum, real } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { conversationsTable } from "./conversations";

export const messageRoleEnum = pgEnum("message_role", ["user", "assistant"]);

export const messagesTable = pgTable("messages", {
  id: serial("id").primaryKey(),
  conversationId: integer("conversation_id")
    .notNull()
    .references(() => conversationsTable.id, { onDelete: "cascade" }),
  role: messageRoleEnum("role").notNull(),
  content: text("content").notNull(),
  sources: jsonb("sources").notNull().default([]),
  structuredOutput: jsonb("structured_output"),
  verificationResult: jsonb("verification_result"),
  faithfulnessScore: real("faithfulness_score"),
  agentTrace: jsonb("agent_trace"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertMessageSchema = createInsertSchema(messagesTable).omit({
  id: true,
  createdAt: true,
});

export type InsertMessage = z.infer<typeof insertMessageSchema>;
export type Message = typeof messagesTable.$inferSelect;
