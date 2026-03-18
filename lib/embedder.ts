// lib/embedder.ts
import { pipeline } from "@xenova/transformers";
import { EMBEDDING_MODEL, EMBEDDING_BATCH_SIZE } from "./constants";

let extractor: any = null;

async function getExtractor() {
  if (!extractor) {
    extractor = await pipeline("feature-extraction", EMBEDDING_MODEL, {
      quantized: true,
    });
  }
  return extractor;
}

/**
 * Embed texts in batches for much faster throughput.
 * The model processes EMBEDDING_BATCH_SIZE texts per call instead of one-at-a-time.
 */
export async function embedTexts(texts: string[], onProgress?: (current: number, total: number) => void): Promise<number[][]> {
  const extract = await getExtractor();
  const embeddings: number[][] = [];

  for (let i = 0; i < texts.length; i += EMBEDDING_BATCH_SIZE) {
    const batch = texts.slice(i, i + EMBEDDING_BATCH_SIZE);

    const output = await extract(batch, {
      pooling: "mean",
      normalize: true,
    });

    // output.data is a flat Float32Array of shape [batch_size, vector_dim]
    // We need to slice it into individual vectors
    const vectorDim = output.dims[output.dims.length - 1];
    const flat: Float32Array = output.data;

    for (let j = 0; j < batch.length; j++) {
      const start = j * vectorDim;
      const end = start + vectorDim;
      embeddings.push(Array.from(flat.slice(start, end)));
    }

    if (onProgress) {
      onProgress(Math.min(i + batch.length, texts.length), texts.length);
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
