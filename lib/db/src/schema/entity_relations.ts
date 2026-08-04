import { pgTable, serial, text, integer, timestamp, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { documentsTable } from "./documents";
import { entitiesTable } from "./entities";

export const entityRelationsTable = pgTable(
  "entity_relations",
  {
    id: serial("id").primaryKey(),
    sourceEntityId: integer("source_entity_id")
      .notNull()
      .references(() => entitiesTable.id, { onDelete: "cascade" }),
    targetEntityId: integer("target_entity_id")
      .notNull()
      .references(() => entitiesTable.id, { onDelete: "cascade" }),
    relationType: text("relation_type").notNull(),
    documentId: integer("document_id")
      .notNull()
      .references(() => documentsTable.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    index("entity_relations_document_id_idx").on(table.documentId),
    index("entity_relations_source_idx").on(table.sourceEntityId),
    index("entity_relations_target_idx").on(table.targetEntityId),
  ]
);

export const insertEntityRelationSchema = createInsertSchema(
  entityRelationsTable
).omit({
  id: true,
  createdAt: true,
});

export type InsertEntityRelation = z.infer<typeof insertEntityRelationSchema>;
export type EntityRelation = typeof entityRelationsTable.$inferSelect;
