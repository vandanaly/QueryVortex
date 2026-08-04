# RAG Chat

A TypeScript full-stack RAG (Retrieval-Augmented Generation) app. Upload PDFs, chunk and embed them via OpenAI, store vectors in Pinecone, then chat with your documents — the backend retrieves the most relevant chunks and passes them as context to an LLM to generate cited answers.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 8080)
- `pnpm --filter @workspace/rag-chat run dev` — run the React frontend (port 20418)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)

## Required Secrets

- `OPENAI_API_KEY` — OpenAI key (used for `text-embedding-3-small` embeddings + `gpt-4o-mini` chat)
- `PINECONE_API_KEY` — Pinecone API key
- `PINECONE_INDEX_NAME` — name of the Pinecone index (auto-created if missing)
- `PINECONE_ENVIRONMENT` — Pinecone region, e.g. `us-east-1` (used when creating a new serverless index)
- `DATABASE_URL` — Postgres connection string (auto-provisioned by Replit)

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: React 19 + Vite, TanStack Query, wouter, shadcn/ui, Tailwind v4
- API: Express 5
- DB: PostgreSQL + Drizzle ORM (`documents`, `conversations`, `messages` tables)
- Validation: Zod v3, drizzle-zod
- API codegen: Orval (from OpenAPI spec)
- Embeddings: OpenAI `text-embedding-3-small` (1536 dims)
- LLM: OpenAI `gpt-4o-mini`
- Vector DB: Pinecone v8 (serverless, cosine metric)
- PDF parsing: pdf-parse (CJS via createRequire)
- File uploads: multer (memory storage, 50 MB limit)
- Build: esbuild (CJS bundle)

## Where things live

- `lib/api-spec/openapi.yaml` — single source of truth for API contracts
- `lib/db/src/schema/` — Drizzle table definitions (documents, conversations, messages)
- `artifacts/api-server/src/routes/` — Express route handlers (documents, conversations, stats)
- `artifacts/api-server/src/lib/` — OpenAI client, Pinecone client, text chunker
- `artifacts/rag-chat/src/` — React frontend (pages: `/` chat, `/documents` library)

## Architecture decisions

- **PDF ingestion is async**: the upload route responds immediately with `status: pending`, then processes in the background via `setImmediate`. The frontend polls via `useGetDocument` to show real-time status transitions (pending → processing → ready/error).
- **Chunking strategy**: sentence-aware splitter with 800-char chunks and 100-char overlap to preserve context across chunk boundaries.
- **Embeddings batch size**: 50 texts per OpenAI embedding API call to stay within rate limits.
- **Pinecone upsert batch size**: 100 vectors per upsert call.
- **Pinecone deleteMany by filter**: uses `documentId` metadata filter to clean up all chunks when a document is deleted.
- **pdf-parse**: loaded via `createRequire` (CJS) because the ESM build has no default export.

## Product

- Upload PDFs via drag-and-drop or file picker on the `/documents` page
- Documents show live ingestion status: pending → processing → ready (with chunk count) or error
- Chat interface: create conversations, send questions, receive answers with cited source chunks
- Each assistant reply includes expandable citations showing the document name, relevance score, and chunk text

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- Always run `pnpm --filter @workspace/api-spec run codegen` after changing `openapi.yaml`, then restart the API server.
- `pdf-parse` must be imported via `createRequire` — its ESM build has no default export.
- Pinecone v8 `index.upsert()` takes `{ records: [...] }` not a bare array.
- Integer fields in OpenAPI spec must use `type: number` (not `integer`) — Orval v8 generates `zod.int()` for `integer` which doesn't exist in Zod v3.
- `lib/api-zod/tsconfig.json` needs `"lib": ["esnext", "dom"]` so the generated Zod schemas can reference `File`/`Blob` globals.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
