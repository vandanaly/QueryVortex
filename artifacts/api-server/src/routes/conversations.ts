import { Router } from "express";
import { db } from "@workspace/db";
import {
  conversationsTable,
  messagesTable,
} from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { generateEmbedding } from "../lib/openai";
import { queryChunks } from "../lib/pinecone";
import { openai, CHAT_MODEL } from "../lib/openai";

const router = Router();

router.get("/conversations", async (req, res) => {
  try {
    const conversations = await db
      .select()
      .from(conversationsTable)
      .orderBy(desc(conversationsTable.updatedAt));
    res.json(
      conversations.map((c) => ({
        id: c.id,
        title: c.title,
        messageCount: c.messageCount,
        createdAt: c.createdAt.toISOString(),
        updatedAt: c.updatedAt.toISOString(),
      }))
    );
  } catch (err) {
    req.log.error({ err }, "Failed to list conversations");
    res.status(500).json({ error: "Failed to list conversations" });
  }
});

router.post("/conversations", async (req, res) => {
  try {
    const { title } = req.body;
    if (!title || typeof title !== "string") {
      res.status(400).json({ error: "title is required" });
      return;
    }
    const [conv] = await db
      .insert(conversationsTable)
      .values({ title, messageCount: 0 })
      .returning();
    res.status(201).json({
      id: conv.id,
      title: conv.title,
      messageCount: conv.messageCount,
      createdAt: conv.createdAt.toISOString(),
      updatedAt: conv.updatedAt.toISOString(),
    });
  } catch (err) {
    req.log.error({ err }, "Failed to create conversation");
    res.status(500).json({ error: "Failed to create conversation" });
  }
});

router.get("/conversations/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const [conv] = await db
      .select()
      .from(conversationsTable)
      .where(eq(conversationsTable.id, id));
    if (!conv) {
      res.status(404).json({ error: "Conversation not found" });
      return;
    }
    const messages = await db
      .select()
      .from(messagesTable)
      .where(eq(messagesTable.conversationId, id))
      .orderBy(messagesTable.createdAt);
    res.json({
      id: conv.id,
      title: conv.title,
      messageCount: conv.messageCount,
      createdAt: conv.createdAt.toISOString(),
      updatedAt: conv.updatedAt.toISOString(),
      messages: messages.map(serializeMessage),
    });
  } catch (err) {
    req.log.error({ err }, "Failed to get conversation");
    res.status(500).json({ error: "Failed to get conversation" });
  }
});

router.delete("/conversations/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const [conv] = await db
      .select()
      .from(conversationsTable)
      .where(eq(conversationsTable.id, id));
    if (!conv) {
      res.status(404).json({ error: "Conversation not found" });
      return;
    }
    await db
      .delete(conversationsTable)
      .where(eq(conversationsTable.id, id));
    res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, "Failed to delete conversation");
    res.status(500).json({ error: "Failed to delete conversation" });
  }
});

router.post("/conversations/:id/messages", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { content } = req.body;

    if (!content || typeof content !== "string") {
      res.status(400).json({ error: "content is required" });
      return;
    }

    const [conv] = await db
      .select()
      .from(conversationsTable)
      .where(eq(conversationsTable.id, id));
    if (!conv) {
      res.status(404).json({ error: "Conversation not found" });
      return;
    }

    // Save user message
    const [userMsg] = await db
      .insert(messagesTable)
      .values({
        conversationId: id,
        role: "user",
        content,
        sources: [],
      })
      .returning();

    // Get prior messages for context (last 10)
    const priorMessages = await db
      .select()
      .from(messagesTable)
      .where(eq(messagesTable.conversationId, id))
      .orderBy(desc(messagesTable.createdAt))
      .limit(10);
    const contextMessages = priorMessages.reverse().slice(0, -1); // exclude the just-inserted user message

    // Retrieve relevant chunks from Pinecone
    let sources: Array<{
      documentId: number;
      documentName: string;
      chunkIndex: number;
      text: string;
      score: number;
    }> = [];

    try {
      const queryEmbedding = await generateEmbedding(content);
      const matches = await queryChunks(queryEmbedding, 5);
      sources = matches.map((m) => ({
        documentId: m.metadata.documentId,
        documentName: m.metadata.documentName,
        chunkIndex: m.metadata.chunkIndex,
        text: m.metadata.text,
        score: m.score,
      }));
    } catch (_err) {
      // If Pinecone fails (e.g. no documents), continue without sources
    }

    // Build the LLM prompt
    const systemPrompt =
      sources.length > 0
        ? `You are a helpful AI assistant that answers questions based on the provided document context.
Use the following document excerpts to answer the user's question. Be specific and cite which document you are drawing from.
If the context does not contain enough information to answer, say so clearly.

Document context:
${sources.map((s, i) => `[${i + 1}] From "${s.documentName}" (relevance: ${(s.score * 100).toFixed(0)}%):
${s.text}`).join("\n\n")}`
        : `You are a helpful AI assistant. No documents have been uploaded yet, so answer from your general knowledge. Note that for best results, the user should upload relevant PDF documents first.`;

    const chatMessages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [
      { role: "system", content: systemPrompt },
      ...contextMessages.map((m) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      })),
      { role: "user", content },
    ];

    const completion = await openai.chat.completions.create({
      model: CHAT_MODEL,
      messages: chatMessages,
      max_tokens: 1024,
    });

    const answer = completion.choices[0]?.message?.content ?? "No response generated.";

    // Save assistant message
    const [assistantMsg] = await db
      .insert(messagesTable)
      .values({
        conversationId: id,
        role: "assistant",
        content: answer,
        sources,
      })
      .returning();

    // Update conversation message count and updatedAt
    await db
      .update(conversationsTable)
      .set({
        messageCount: conv.messageCount + 2,
        updatedAt: new Date(),
      })
      .where(eq(conversationsTable.id, id));

    res.status(201).json({
      userMessage: serializeMessage(userMsg),
      assistantMessage: serializeMessage(assistantMsg),
    });
  } catch (err) {
    req.log.error({ err }, "Failed to send message");
    res.status(500).json({ error: "Failed to send message" });
  }
});

function serializeMessage(m: {
  id: number;
  conversationId: number;
  role: string;
  content: string;
  sources: unknown;
  createdAt: Date;
}) {
  return {
    id: m.id,
    conversationId: m.conversationId,
    role: m.role,
    content: m.content,
    sources: (m.sources as Array<{
      documentId: number;
      documentName: string;
      chunkIndex: number;
      text: string;
      score: number;
    }>) ?? [],
    createdAt: m.createdAt.toISOString(),
  };
}

export default router;
