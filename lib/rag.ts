// lib/rag.ts

import { embedQuery } from "./embedder";
import { searchSimilar } from "./qdrant";
import { RAG_TOP_K } from "./constants";
import { RepoChunk } from "@/types";

export async function retrieveChunks(repoId: string, query: string, topK = RAG_TOP_K): Promise<RepoChunk[]> {
  const vector = await embedQuery(query);
  const hits = await searchSimilar(repoId, vector, topK);
  
  return hits.map(hit => ({
    content: (hit.payload as any).content,
    filePath: (hit.payload as any).filePath,
    language: (hit.payload as any).language,
  }));
}

export function buildContext(chunks: RepoChunk[]): string {
  return chunks
    .map(chunk => `File: ${chunk.filePath}\n\n${chunk.content}\n\n---`)
    .join("\n\n");
}

export function buildSystemPrompt(context: string): string {
  // Use a simplified version of the system prompt for RAG
  return `You are REPOIQ, an AI assistant specialized in analyzing and explaining GitHub codebases. 
You answer questions about code structure, logic, architecture, and implementation details based strictly on the indexed repository context provided below.

<retrieved_context>
${context}
</retrieved_context>`;
}
