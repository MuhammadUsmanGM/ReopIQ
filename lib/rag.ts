// lib/rag.ts

import { embedQuery } from "./embedder";
import { searchSimilar, getRepoMetadata, getAllChunks, fetchFileChunks } from "./qdrant";
import { RAG_TOP_K, FULL_CONTEXT_TOKEN_THRESHOLD } from "./constants";
import { RepoChunk, HybridRetrievalResult } from "@/types";

/** Original RAG retrieval — used in large repo mode */
async function retrieveByVector(repoId: string, query: string, topK = RAG_TOP_K): Promise<RepoChunk[]> {
  const vector = await embedQuery(query);
  const hits = await searchSimilar(repoId, vector, topK);

  return hits.map(hit => ({
    content: (hit.payload as any).content,
    filePath: (hit.payload as any).filePath,
    language: (hit.payload as any).language,
  }));
}

/** Detect if user mentions specific file paths in their query */
function detectMentionedFiles(message: string, fileTree: string): string[] {
  const paths = fileTree.split("\n").filter(p => p.trim().length > 0);
  const lowerMessage = message.toLowerCase();

  return paths.filter(p => {
    const lowerPath = p.toLowerCase();
    // Match full path or just filename
    const fileName = lowerPath.split("/").pop() || "";
    return lowerMessage.includes(lowerPath) || lowerMessage.includes(fileName);
  });
}

/** Main hybrid retrieval — routes to full context or RAG based on repo size */
export async function retrieveHybrid(repoId: string, message: string): Promise<HybridRetrievalResult> {
  const metadata = await getRepoMetadata(repoId);

  if (!metadata) {
    throw new Error("No indexed data found for this repository. Please re-index it from the home page.");
  }

  const fileTree = metadata.fileTree;

  // Mode A: Full context for small repos
  if (metadata.totalTokens < FULL_CONTEXT_TOKEN_THRESHOLD) {
    const chunks = await getAllChunks(repoId);

    if (chunks.length === 0) {
      throw new Error("No indexed data found. Please re-index this repository.");
    }

    const sources = Array.from(new Set(chunks.map(c => c.filePath)));
    return { chunks, fileTree, mode: "full", sources };
  }

  // Mode B: RAG for large repos
  const ragChunks = await retrieveByVector(repoId, message, RAG_TOP_K);

  if (ragChunks.length === 0) {
    throw new Error("No relevant code found. Try rephrasing your question or ask about a specific file.");
  }

  // Smart file detection: if user mentions a file, include it fully
  const mentionedFiles = detectMentionedFiles(message, fileTree);
  const existingPaths = new Set(ragChunks.map(c => c.filePath));

  for (const filePath of mentionedFiles) {
    if (existingPaths.has(filePath)) continue;
    const fileChunks = await fetchFileChunks(repoId, filePath);
    ragChunks.push(...fileChunks);
    fileChunks.forEach(c => existingPaths.add(c.filePath));
  }

  const sources = Array.from(existingPaths);
  return { chunks: ragChunks, fileTree, mode: "rag", sources };
}

export function buildContext(chunks: RepoChunk[]): string {
  return chunks
    .map(chunk => `File: ${chunk.filePath}\n\n${chunk.content}\n\n---`)
    .join("\n\n");
}
