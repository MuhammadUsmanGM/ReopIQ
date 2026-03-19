// lib/embedder.ts — Hybrid: Google API (fast) or Local Xenova (offline)

import { EMBEDDING_MODEL, EMBEDDING_BATCH_SIZE } from "./constants";
import { loadCodeLensEnv, getHfToken, getGoogleApiKey } from "./env";

// ─── Provider detection ───

function getProvider(): "google" | "local" {
  loadCodeLensEnv();
  const pref = process.env.EMBEDDING_PROVIDER?.toLowerCase();
  if (pref === "local") return "local";
  if (pref === "google") return "google";
  // Default: google (faster)
  return "google";
}

// ─── Google API embeddings ───

const GOOGLE_EMBED_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:batchEmbedContents";
const GOOGLE_MODEL = "models/gemini-embedding-001";
const OUTPUT_DIM = 768;
const GOOGLE_BATCH_SIZE = 90; // Stay under 100/min free-tier limit

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function googleEmbedBatch(texts: string[], taskType: string): Promise<number[][]> {
  const apiKey = getGoogleApiKey();
  const response = await fetch(`${GOOGLE_EMBED_URL}?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      requests: texts.map((text) => ({
        model: GOOGLE_MODEL,
        content: { parts: [{ text }] },
        taskType,
        outputDimensionality: OUTPUT_DIM,
      })),
    }),
  });

  if (response.status === 429) {
    // Rate limited — wait and retry
    const retryAfter = 62; // Google free tier resets per minute
    console.log(`[embedder] Rate limited, waiting ${retryAfter}s...`);
    await sleep(retryAfter * 1000);
    return googleEmbedBatch(texts, taskType);
  }

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Embedding API error: ${response.status} — ${err}`);
  }

  const data = await response.json();
  return data.embeddings.map((e: any) => e.values);
}

async function googleEmbedTexts(texts: string[], onProgress?: (current: number, total: number) => void): Promise<number[][]> {
  const embeddings: number[][] = [];

  for (let i = 0; i < texts.length; i += GOOGLE_BATCH_SIZE) {
    const batch = texts.slice(i, i + GOOGLE_BATCH_SIZE);
    const result = await googleEmbedBatch(batch, "RETRIEVAL_DOCUMENT");
    embeddings.push(...result);

    if (onProgress) onProgress(Math.min(i + batch.length, texts.length), texts.length);

    // Pace requests to stay under 100/min
    if (i + GOOGLE_BATCH_SIZE < texts.length) {
      await sleep(1000);
    }
  }

  return embeddings;
}

async function googleEmbedQuery(query: string): Promise<number[]> {
  const result = await googleEmbedBatch([query], "RETRIEVAL_QUERY");
  return result[0];
}

// ─── Local Xenova embeddings ───

let extractor: any = null;
let _patchedFetch = false;

function patchFetchWithToken(token: string) {
  if (_patchedFetch) return;
  _patchedFetch = true;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = input.toString();
    if (url.includes("huggingface.co")) {
      init = {
        ...init,
        headers: {
          ...(init?.headers || {}),
          Authorization: `Bearer ${token}`,
        },
      };
    }
    return originalFetch(input as any, init);
  };
}

async function getExtractor() {
  loadCodeLensEnv();
  const token = getHfToken();

  if (token) {
    patchFetchWithToken(token);
    if (!extractor) extractor = null;
  }

  if (!extractor) {
    const { pipeline } = await import("@xenova/transformers");
    extractor = await pipeline("feature-extraction", EMBEDDING_MODEL, {
      quantized: true,
    });
  }
  return extractor;
}

async function localEmbedTexts(texts: string[], onProgress?: (current: number, total: number) => void): Promise<number[][]> {
  const extract = await getExtractor();
  const embeddings: number[][] = [];

  for (let i = 0; i < texts.length; i += EMBEDDING_BATCH_SIZE) {
    const batch = texts.slice(i, i + EMBEDDING_BATCH_SIZE);
    const output = await extract(batch, { pooling: "mean", normalize: true });
    const vectorDim = output.dims[output.dims.length - 1];
    const flat: Float32Array = output.data;

    for (let j = 0; j < batch.length; j++) {
      const start = j * vectorDim;
      const end = start + vectorDim;
      embeddings.push(Array.from(flat.slice(start, end)));
    }

    if (onProgress) onProgress(Math.min(i + batch.length, texts.length), texts.length);
  }

  return embeddings;
}

async function localEmbedQuery(query: string): Promise<number[]> {
  const extract = await getExtractor();
  const output = await extract(query, { pooling: "mean", normalize: true });
  return Array.from(output.data);
}

// ─── Public API — routes to whichever provider is configured ───

export async function embedTexts(texts: string[], onProgress?: (current: number, total: number) => void): Promise<number[][]> {
  return getProvider() === "google"
    ? googleEmbedTexts(texts, onProgress)
    : localEmbedTexts(texts, onProgress);
}

export async function embedQuery(query: string): Promise<number[]> {
  return getProvider() === "google"
    ? googleEmbedQuery(query)
    : localEmbedQuery(query);
}
