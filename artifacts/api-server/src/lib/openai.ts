// @ts-nocheck
import OpenAI from "openai";

if (!process.env.OPENAI_API_KEY) {
  throw new Error("OPENAI_API_KEY must be set.");
}

export const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export const EMBEDDING_MODEL = "text-embedding-3-small";
export const EMBEDDING_DIMENSIONS = 1536;
export const CHAT_MODEL = "gpt-4o-mini";

export async function generateEmbedding(text: string): Promise<number[]> {
  const response = await openai.embeddings.create({
    model: EMBEDDING_MODEL,
    input: text,
    dimensions: EMBEDDING_DIMENSIONS,
  });
  return response.data[0].embedding;
}

export async function generateEmbeddings(
  texts: string[]
): Promise<number[][]> {
  const response = await openai.embeddings.create({
    model: EMBEDDING_MODEL,
    input: texts,
    dimensions: EMBEDDING_DIMENSIONS,
  });
  return response.data.map((d) => d.embedding);
}
