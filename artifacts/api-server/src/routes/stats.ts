import { Router } from "express";
import { db } from "@workspace/db";
import { documentsTable, conversationsTable, messagesTable } from "@workspace/db";
import { count, sum, eq } from "drizzle-orm";

const router = Router();

router.get("/stats", async (req, res) => {
  try {
    const [docStats] = await db
      .select({
        documentCount: count(documentsTable.id),
        totalChunks: sum(documentsTable.chunkCount),
      })
      .from(documentsTable);

    const [readyCount] = await db
      .select({ readyDocumentCount: count(documentsTable.id) })
      .from(documentsTable)
      .where(eq(documentsTable.status, "ready"));

    const [convStats] = await db
      .select({ conversationCount: count(conversationsTable.id) })
      .from(conversationsTable);

    const [msgStats] = await db
      .select({ messageCount: count(messagesTable.id) })
      .from(messagesTable);

    res.json({
      documentCount: Number(docStats?.documentCount ?? 0),
      readyDocumentCount: Number(readyCount?.readyDocumentCount ?? 0),
      totalChunks: Number(docStats?.totalChunks ?? 0),
      conversationCount: Number(convStats?.conversationCount ?? 0),
      messageCount: Number(msgStats?.messageCount ?? 0),
    });
  } catch (err) {
    req.log.error({ err }, "Failed to get stats");
    res.status(500).json({ error: "Failed to get stats" });
  }
});

export default router;
