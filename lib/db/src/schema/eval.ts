import {
  pgTable,
  serial,
  text,
  integer,
  timestamp,
  jsonb,
  real,
  pgEnum,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const evalRunStatusEnum = pgEnum("eval_run_status", [
  "pending",
  "running",
  "completed",
  "failed",
]);

export const evalDatasetsTable = pgTable("eval_datasets", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const evalQuestionsTable = pgTable("eval_questions", {
  id: serial("id").primaryKey(),
  datasetId: integer("dataset_id")
    .notNull()
    .references(() => evalDatasetsTable.id, { onDelete: "cascade" }),
  question: text("question").notNull(),
  expectedAnswer: text("expected_answer"),
  expectedChunkIds: jsonb("expected_chunk_ids").notNull().default([]),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const evalRunsTable = pgTable("eval_runs", {
  id: serial("id").primaryKey(),
  datasetId: integer("dataset_id")
    .notNull()
    .references(() => evalDatasetsTable.id, { onDelete: "cascade" }),
  status: evalRunStatusEnum("status").notNull().default("pending"),
  config: jsonb("config").notNull().default({}),
  summaryMetrics: jsonb("summary_metrics"),
  errorMessage: text("error_message"),
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const evalResultsTable = pgTable("eval_results", {
  id: serial("id").primaryKey(),
  runId: integer("run_id")
    .notNull()
    .references(() => evalRunsTable.id, { onDelete: "cascade" }),
  questionId: integer("question_id")
    .notNull()
    .references(() => evalQuestionsTable.id, { onDelete: "cascade" }),
  retrievedChunkIds: jsonb("retrieved_chunk_ids").notNull().default([]),
  generatedAnswer: text("generated_answer"),
  precisionAtK: real("precision_at_k"),
  recallAtK: real("recall_at_k"),
  contextPrecision: real("context_precision"),
  faithfulness: real("faithfulness"),
  answerRelevance: real("answer_relevance"),
  metrics: jsonb("metrics").notNull().default({}),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertEvalDatasetSchema = createInsertSchema(evalDatasetsTable).omit({
  id: true,
  createdAt: true,
});

export const insertEvalQuestionSchema = createInsertSchema(evalQuestionsTable).omit({
  id: true,
  createdAt: true,
});

export const insertEvalRunSchema = createInsertSchema(evalRunsTable).omit({
  id: true,
  createdAt: true,
});

export type EvalDataset = typeof evalDatasetsTable.$inferSelect;
export type EvalQuestion = typeof evalQuestionsTable.$inferSelect;
export type EvalRun = typeof evalRunsTable.$inferSelect;
export type EvalResult = typeof evalResultsTable.$inferSelect;
