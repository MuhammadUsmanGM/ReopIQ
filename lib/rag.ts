// lib/rag.ts

import { embedQuery, getActiveProvider } from "./embedder";
import { searchSimilar, getRepoMetadata, getAllChunks, fetchFileChunks } from "./qdrant";
import { RAG_TOP_K, RAG_CANDIDATE_MULTIPLIER, FULL_CONTEXT_TOKEN_THRESHOLD } from "./constants";
import { RepoChunk, HybridRetrievalResult, ChatMessage } from "@/types";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { getGoogleApiKey, getGeminiModel } from "./env";

/** Rewrite a follow-up message into a standalone search query using chat history */
async function buildSearchQuery(message: string, history?: ChatMessage[]): Promise<string> {
  // No history or first message — use as-is
  if (!history || history.length === 0) return message;

  // Only use the last 4 messages for context (keeps it fast)
  const recent = history.slice(-4);
  const hasContext = recent.some(m => m.role === "user");
  if (!hasContext) return message;

  try {
    const genAI = new GoogleGenerativeAI(getGoogleApiKey());
    const model = genAI.getGenerativeModel({ model: getGeminiModel() });

    const conversationBlock = recent
      .map(m => `${m.role === "user" ? "User" : "Assistant"}: ${m.content.slice(0, 300)}`)
      .join("\n");

    const result = await model.generateContent(
      `Given this conversation about a code repository:\n\n${conversationBlock}\n\nThe user now asks: "${message}"\n\nRewrite the user's latest message as a single standalone search query that captures the full intent (resolve pronouns like "it", "that", "this function" using conversation context). Output ONLY the rewritten query, nothing else. If the message is already standalone, return it unchanged.`
    );

    const rewritten = result.response.text().trim();
    // Sanity check — if the model returned something too long or empty, fall back
    if (rewritten.length > 0 && rewritten.length < 500) return rewritten;
  } catch (error) {
    console.warn("[rag] Query rewrite failed, using original message:", error);
  }

  return message;
}

/** Score and re-rank chunks by relevance to the query using the LLM */
async function rerankChunks(query: string, chunks: RepoChunk[], topK: number): Promise<RepoChunk[]> {
  if (chunks.length <= topK) return chunks;

  try {
    const genAI = new GoogleGenerativeAI(getGoogleApiKey());
    const model = genAI.getGenerativeModel({ model: getGeminiModel() });

    // Build a numbered list of chunk summaries for the LLM
    const chunkSummaries = chunks
      .map((c, i) => `[${i}] ${c.filePath}: ${c.content.slice(0, 200)}`)
      .join("\n\n");

    const result = await model.generateContent(
      `You are a code search re-ranker. Given a user query and a list of code chunks, return the indices of the ${topK} most relevant chunks in order of relevance (most relevant first).\n\nQuery: "${query}"\n\nChunks:\n${chunkSummaries}\n\nReturn ONLY a JSON array of indices, e.g. [3, 0, 7, 1, ...]. No explanation.`
    );

    const text = result.response.text().trim();
    // Extract JSON array from response (handle markdown code blocks)
    const jsonMatch = text.match(/\[[\d,\s]+\]/);
    if (jsonMatch) {
      const indices: number[] = JSON.parse(jsonMatch[0]);
      const reranked: RepoChunk[] = [];
      const seen = new Set<number>();

      for (const idx of indices) {
        if (idx >= 0 && idx < chunks.length && !seen.has(idx)) {
          reranked.push(chunks[idx]);
          seen.add(idx);
          if (reranked.length >= topK) break;
        }
      }

      // If we got enough results, use them; otherwise fall back to original order
      if (reranked.length >= topK * 0.5) return reranked;
    }
  } catch (error) {
    console.warn("[rag] Re-ranking failed, using vector order:", error);
  }

  // Fallback: return the top-K in original vector similarity order
  return chunks.slice(0, topK);
}

/** Vector retrieval — fetches extra candidates for re-ranking */
async function retrieveByVector(repoId: string, query: string, topK = RAG_TOP_K): Promise<RepoChunk[]> {
  const candidateCount = topK * RAG_CANDIDATE_MULTIPLIER;
  const vector = await embedQuery(query);
  const hits = await searchSimilar(repoId, vector, candidateCount);

  const candidates: RepoChunk[] = hits.map(hit => ({
    content: (hit.payload as any).content,
    filePath: (hit.payload as any).filePath,
    language: (hit.payload as any).language,
  }));

  // Re-rank candidates down to topK
  return rerankChunks(query, candidates, topK);
}

/** Detect if user mentions specific file paths in their query */
function detectMentionedFiles(message: string, fileTree: string): string[] {
  const paths = fileTree.split("\n").filter(p => p.trim().length > 0);
  const lowerMessage = message.toLowerCase();

  return paths.filter(p => {
    const lowerPath = p.toLowerCase();
    if (lowerMessage.includes(lowerPath)) return true;
    const fileName = lowerPath.split("/").pop() || "";
    if (fileName.length > 0 && lowerPath.includes("/")) {
      const parts = lowerPath.split("/");
      if (parts.length >= 2) {
        const parentAndFile = parts.slice(-2).join("/");
        if (lowerMessage.includes(parentAndFile)) return true;
      }
    }
    return false;
  });
}

/** Main hybrid retrieval — routes to full context or RAG based on repo size */
export async function retrieveHybrid(repoId: string, message: string, history?: ChatMessage[]): Promise<HybridRetrievalResult> {
  const metadata = await getRepoMetadata(repoId);

  // Build a context-aware search query from chat history
  const searchQuery = await buildSearchQuery(message, history);

  if (!metadata) {
    console.warn("[rag] No metadata found for", repoId, "— falling back to RAG mode");
    const ragChunks = await retrieveByVector(repoId, searchQuery, RAG_TOP_K);
    if (ragChunks.length === 0) {
      throw new Error("No indexed data found for this repository. Please re-index it from the home page.");
    }
    const sources = Array.from(new Set(ragChunks.map(c => c.filePath)));
    return { chunks: ragChunks, fileTree: "(file tree unavailable — re-index for full features)", mode: "rag" as const, sources };
  }

  // Guard: ensure queries use the same embedding provider that indexed the repo
  const indexedWith = metadata.embeddingProvider;
  const currentProvider = getActiveProvider();
  if (indexedWith && indexedWith !== currentProvider) {
    throw new Error(
      `This repo was indexed with "${indexedWith}" embeddings but you're now using "${currentProvider}". ` +
      `Please re-index the repo, or switch back to "${indexedWith}" in Settings.`
    );
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

  // Mode B: RAG for large repos (with re-ranking + context-aware query)
  const ragChunks = await retrieveByVector(repoId, searchQuery, RAG_TOP_K);

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
