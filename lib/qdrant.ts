// lib/qdrant.ts

import { QdrantClient } from "@qdrant/js-client-rest";
import { QdrantPoint, RepoMetadata, RepoChunk } from "@/types";
import { QDRANT_VECTOR_SIZE, QDRANT_UPSERT_BATCH_SIZE, METADATA_POINT_ID } from "./constants";
import { getQdrantConfig } from "./env";

function sanitizeUtf8(str: string): string {
  // Removes lone surrogates that break JSON stringification
  return str.replace(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?:[^\uD800-\uDBFF]|^)[\uDC00-\uDFFF]/g, '');
}

let client: QdrantClient | null = null;
let cachedUrl: string | null = null;
let cachedApiKey: string | null = null;

export function getQdrantClient() {
  const { url, apiKey } = getQdrantConfig();
  // Invalidate cache if credentials changed (e.g. via Settings UI)
  if (client && (url !== cachedUrl || apiKey !== cachedApiKey)) {
    client = null;
  }
  if (!client) {
    client = new QdrantClient({ url, apiKey });
    cachedUrl = url;
    cachedApiKey = apiKey;
  }
  return client;
}

export function getCollectionName(repoId: string) {
  // Use a short hash to guarantee unique, collision-free collection names
  // This avoids lossy character replacement where e.g. "owner/repo@main" and "owner/repo_main" could collide
  const crypto = require("crypto");
  const hash = crypto.createHash("sha256").update(repoId).digest("hex").slice(0, 12);
  // Keep a human-readable prefix (alphanumeric only) for easier debugging
  const prefix = repoId.replace(/[^a-zA-Z0-9]/g, "").slice(0, 30);
  return `repo_${prefix}_${hash}`;
}

export async function collectionExists(repoId: string): Promise<boolean> {
  const collectionName = getCollectionName(repoId);
  try {
    await getQdrantClient().getCollection(collectionName);
    return true;
  } catch (error) {
    return false;
  }
}

export async function createCollection(repoId: string) {
  const collectionName = getCollectionName(repoId);
  const client = getQdrantClient();

  try {
    const info = await client.getCollection(collectionName);
    const vectorsConfig = info.config.params.vectors;

    // Handle both single vector and multiple vector configurations
    const existingSize = (vectorsConfig as any).size || (Object.values(vectorsConfig as any)[0] as any).size;

    // Always delete and recreate to ensure fresh data (avoids stale/duplicate chunks on re-ingest)
    await client.deleteCollection(collectionName);
    await new Promise(r => setTimeout(r, 1000));
  } catch (error) {
    // Collection doesn't exist yet — will create below
  }

  await client.createCollection(collectionName, {
    vectors: {
      size: QDRANT_VECTOR_SIZE,
      distance: "Cosine",
    },
  });
}

export async function upsertPoints(repoId: string, points: QdrantPoint[], onProgress?: (current: number, total: number) => void) {
  const collectionName = getCollectionName(repoId);
  
  for (let i = 0; i < points.length; i += QDRANT_UPSERT_BATCH_SIZE) {
    const batch = points.slice(i, i + QDRANT_UPSERT_BATCH_SIZE);
    
    // Clean data check
    batch.forEach(p => {
      if (p.vector.some(v => isNaN(v) || !isFinite(v))) {
        throw new Error(`Neural anomaly detected in chunk ${p.id}: vector contains non-finite values`);
      }
    });

    try {
      // Sanitize payloads to prevent lone surrogate JSON errors
      const sanitizedBatch = batch.map(p => ({
        ...p,
        payload: {
          ...p.payload,
          content: p.payload?.content ? sanitizeUtf8(p.payload.content as string) : "",
          filePath: p.payload?.filePath ? sanitizeUtf8(p.payload.filePath as string) : "",
        }
      }));

      await getQdrantClient().upsert(collectionName, {
        wait: true,
        points: sanitizedBatch,
      });
    } catch (error: any) {
      throw error;
    }
    
    if (onProgress) onProgress(Math.min(i + QDRANT_UPSERT_BATCH_SIZE, points.length), points.length);
  }
}

export async function searchSimilar(repoId: string, queryVector: number[], topK: number) {
  const collectionName = getCollectionName(repoId);
  try {
    // Request extra results to account for filtering out the metadata point
    const results = await getQdrantClient().search(collectionName, {
      vector: queryVector,
      limit: topK + 1,
      with_payload: true,
    });
    // Filter out the metadata point in JS
    return results.filter(r => r.id !== METADATA_POINT_ID).slice(0, topK);
  } catch (error) {
    return [];
  }
}

export async function deleteCollection(repoId: string) {
  const collectionName = getCollectionName(repoId);
  try {
    await getQdrantClient().deleteCollection(collectionName);
  } catch (error) {
    // Silent fail if not found
  }
}

export async function getCollectionInfo(repoId: string) {
  const collectionName = getCollectionName(repoId);
  try {
    const info = await getQdrantClient().getCollection(collectionName);
    return { pointsCount: info.points_count };
  } catch (error) {
    return null;
  }
}

export async function storeRepoMetadata(repoId: string, metadata: RepoMetadata) {
  const collectionName = getCollectionName(repoId);
  // Use a tiny non-zero vector to avoid Cosine distance division-by-zero
  const dummyVector = Array(QDRANT_VECTOR_SIZE).fill(0.0001);

  await getQdrantClient().upsert(collectionName, {
    wait: true,
    points: [{
      id: METADATA_POINT_ID,
      vector: dummyVector,
      payload: metadata as unknown as Record<string, unknown>,
    }],
  });
}

export async function getRepoMetadata(repoId: string): Promise<RepoMetadata | null> {
  const collectionName = getCollectionName(repoId);
  try {
    const results = await getQdrantClient().retrieve(collectionName, {
      ids: [METADATA_POINT_ID],
      with_payload: true,
    });
    if (results.length === 0) return null;
    return results[0].payload as unknown as RepoMetadata;
  } catch (error) {
    return null;
  }
}

export async function getAllChunks(repoId: string): Promise<RepoChunk[]> {
  const collectionName = getCollectionName(repoId);
  const chunks: RepoChunk[] = [];
  let offset: string | number | null = null;

  // Scroll through all points, skip metadata point in JS
  while (true) {
    const scrollParams: Record<string, unknown> = {
      limit: 100,
      with_payload: true,
    };
    if (offset !== null) {
      scrollParams.offset = offset;
    }

    const result = await getQdrantClient().scroll(collectionName, scrollParams);

    for (const point of result.points) {
      // Skip the metadata point
      if (point.id === METADATA_POINT_ID) continue;
      const payload = point.payload as any;
      if (!payload?.content || !payload?.filePath) continue;
      chunks.push({
        content: payload.content,
        filePath: payload.filePath,
        language: payload.language,
      });
    }

    if (!result.next_page_offset) break;
    offset = result.next_page_offset as string | number;
  }

  return chunks;
}

/** Delete all points matching a given filePath (for incremental re-indexing) */
export async function deletePointsByFile(repoId: string, filePath: string): Promise<void> {
  const collectionName = getCollectionName(repoId);
  try {
    await getQdrantClient().delete(collectionName, {
      wait: true,
      filter: {
        must: [
          { key: "filePath", match: { value: filePath } },
        ],
      },
    });
  } catch (error) {
    // Silent fail — collection might not exist yet
  }
}

export async function fetchFileChunks(repoId: string, filePath: string): Promise<RepoChunk[]> {
  const collectionName = getCollectionName(repoId);
  const chunks: RepoChunk[] = [];
  let offset: string | number | null = null;

  while (true) {
    const scrollParams: Record<string, unknown> = {
      limit: 100,
      with_payload: true,
      filter: {
        must: [
          { key: "filePath", match: { value: filePath } },
        ],
      },
    };
    if (offset !== null) {
      scrollParams.offset = offset;
    }

    const result = await getQdrantClient().scroll(collectionName, scrollParams);

    for (const point of result.points) {
      if (point.id === METADATA_POINT_ID) continue;
      const payload = point.payload as any;
      chunks.push({
        content: payload.content,
        filePath: payload.filePath,
        language: payload.language,
      });
    }

    if (!result.next_page_offset) break;
    offset = result.next_page_offset as string | number;
  }

  return chunks;
}
