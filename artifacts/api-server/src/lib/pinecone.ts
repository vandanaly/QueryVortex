import { Pinecone } from "@pinecone-database/pinecone";
import { EMBEDDING_DIMENSIONS } from "./openai";

if (!process.env.PINECONE_API_KEY) {
  throw new Error("PINECONE_API_KEY must be set.");
}
if (!process.env.PINECONE_INDEX_NAME) {
  throw new Error("PINECONE_INDEX_NAME must be set.");
}

const pinecone = new Pinecone({
  apiKey: process.env.PINECONE_API_KEY,
});

export const INDEX_NAME = process.env.PINECONE_INDEX_NAME;

export type ChunkMetadata = {
  documentId: number;
  documentName: string;
  chunkIndex: number;
  text: string;
};

export async function ensureIndex(): Promise<void> {
  const existing = await pinecone.listIndexes();
  const names = (existing.indexes ?? []).map((i) => i.name);
  if (!names.includes(INDEX_NAME)) {
    await pinecone.createIndex({
      name: INDEX_NAME,
      dimension: EMBEDDING_DIMENSIONS,
      metric: "cosine",
      spec: {
        serverless: {
          cloud: "aws",
          region: process.env.PINECONE_ENVIRONMENT ?? "us-east-1",
        },
      },
      waitUntilReady: true,
    });
  }
}

export async function upsertChunks(
  chunks: Array<{ id: string; embedding: number[]; metadata: ChunkMetadata }>
): Promise<void> {
  const index = pinecone.index<ChunkMetadata>(INDEX_NAME);
  const vectors = chunks.map((c) => ({
    id: c.id,
    values: c.embedding,
    metadata: c.metadata,
  }));
  // Upsert in batches of 100
  const batchSize = 100;
  for (let i = 0; i < vectors.length; i += batchSize) {
    await index.upsert({ records: vectors.slice(i, i + batchSize) });
  }
}

export async function queryChunks(
  embedding: number[],
  topK = 5
): Promise<Array<{ score: number; metadata: ChunkMetadata }>> {
  const index = pinecone.index<ChunkMetadata>(INDEX_NAME);
  const result = await index.query({
    vector: embedding,
    topK,
    includeMetadata: true,
  });
  return (result.matches ?? [])
    .filter((m) => m.metadata != null)
    .map((m) => ({
      score: m.score ?? 0,
      metadata: m.metadata as ChunkMetadata,
    }));
}

export async function deleteDocumentChunks(
  documentId: number
): Promise<void> {
  const index = pinecone.index<ChunkMetadata>(INDEX_NAME);
  // Delete by metadata filter
  await index.deleteMany({
    filter: { documentId: { $eq: documentId } },
  });
}
