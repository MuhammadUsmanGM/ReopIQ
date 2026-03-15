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

export async function embedTexts(texts: string[]): Promise<number[][]> {
  const model = getGenAI().getGenerativeModel({ model: EMBEDDING_MODEL });
  const embeddings: number[][] = [];

  for (let i = 0; i < texts.length; i += EMBEDDING_BATCH_SIZE) {
    const batch = texts.slice(i, i + EMBEDDING_BATCH_SIZE);
    
    try {
      // Use batchEmbedContents for efficiency with specific task type
      const result = await model.batchEmbedContents({
        requests: batch.map((text) => ({
          content: { role: "user", parts: [{ text }] },
          taskType: TaskType.RETRIEVAL_DOCUMENT,
        })),
      });
      
      embeddings.push(...result.embeddings.map(e => e.values));
    } catch (error) {
      console.error(`Error embedding batch ${i}:`, error);
      // Retry logic could be added here if needed
      throw error;
    }
  }

  return embeddings;
}

export async function embedQuery(query: string): Promise<number[]> {
  const model = getGenAI().getGenerativeModel({ model: EMBEDDING_MODEL });
  
  try {
    const result = await model.embedContent({
      content: { role: "user", parts: [{ text: query }] },
      taskType: TaskType.RETRIEVAL_QUERY,
    });
    return result.embedding.values;
  } catch (error) {
    console.error("Error embedding query:", error);
    throw error;
  }
}
