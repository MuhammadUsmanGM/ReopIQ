// lib/embedder.ts

import { GoogleGenerativeAI, TaskType } from "@google/generative-ai";
import { EMBEDDING_BATCH_SIZE, EMBEDDING_MODEL } from "./constants";

let genAI: GoogleGenerativeAI | null = null;

export function getGenAI() {
  if (!genAI) {
    const apiKey = process.env.GOOGLE_API_KEY;
    if (!apiKey) throw new Error("GOOGLE_API_KEY is not set");
    genAI = new GoogleGenerativeAI(apiKey);
  }
  return genAI;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function fetchWithRetry<T>(fn: () => Promise<T>, retries = 5, backoff = 3000): Promise<T> {
  try {
    return await fn();
  } catch (error: any) {
    const isRateLimit = 
      error.status === 429 || 
      error.message?.includes("429") || 
      error.message?.toLowerCase().includes("quota exceeded") ||
      error.message?.toLowerCase().includes("too many requests");

    if (retries > 0 && isRateLimit) {
      console.log(`Neural rate limit reached. Synchronization resuming in ${backoff / 1000}s... (${retries} neural cycles left)`);
      await sleep(backoff);
      return fetchWithRetry(fn, retries - 1, backoff * 2);
    }
    throw error;
  }
}

export async function embedTexts(texts: string[]): Promise<number[][]> {
  const model = getGenAI().getGenerativeModel({ model: EMBEDDING_MODEL });
  const embeddings: number[][] = [];

  for (let i = 0; i < texts.length; i += EMBEDDING_BATCH_SIZE) {
    const batch = texts.slice(i, i + EMBEDDING_BATCH_SIZE);
    
    // Safety delay between batches for free tier
    if (i > 0) await sleep(1000);

    const result = await fetchWithRetry(() => 
      model.batchEmbedContents({
        requests: batch.map((text) => ({
          content: { role: "user", parts: [{ text }] },
          taskType: TaskType.RETRIEVAL_DOCUMENT,
        })),
      })
    );
    
    embeddings.push(...result.embeddings.map(e => e.values));
  }

  return embeddings;
}

export async function embedQuery(query: string): Promise<number[]> {
  const model = getGenAI().getGenerativeModel({ model: EMBEDDING_MODEL });
  
  const result = await fetchWithRetry(() => 
    model.embedContent({
      content: { role: "user", parts: [{ text: query }] },
      taskType: TaskType.RETRIEVAL_QUERY,
    })
  );
  
  return result.embedding.values;
}
