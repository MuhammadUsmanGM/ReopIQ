// lib/embedder.ts
import { pipeline } from "@xenova/transformers";
import { EMBEDDING_MODEL } from "./constants";

let extractor: any = null;

async function getExtractor() {
  if (!extractor) {
    // Disable local model check to ensure HF Hub download
    extractor = await pipeline("feature-extraction", EMBEDDING_MODEL, {
      quantized: true,
    });
  }
  return extractor;
}

export async function embedTexts(texts: string[], onProgress?: (current: number, total: number) => void): Promise<number[][]> {
  const extract = await getExtractor();
  const embeddings: number[][] = [];

  for (let i = 0; i < texts.length; i++) {
    const output = await extract(texts[i], {
      pooling: "mean",
      normalize: true,
    });
    
    // Convert Float32Array to number[]
    embeddings.push(Array.from(output.data));
    
    if (onProgress) {
      onProgress(i + 1, texts.length);
    }
  }

  return embeddings;
}

export async function embedQuery(query: string): Promise<number[]> {
  const extract = await getExtractor();
  const output = await extract(query, {
    pooling: "mean",
    normalize: true,
  });
  
  return Array.from(output.data);
}
