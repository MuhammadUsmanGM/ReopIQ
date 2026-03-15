// lib/qdrant.ts

import { QdrantClient } from "@qdrant/js-client-rest";
import { QdrantPoint } from "@/types";
import { QDRANT_VECTOR_SIZE, QDRANT_UPSERT_BATCH_SIZE } from "./constants";

let client: QdrantClient | null = null;

export function getQdrantClient() {
  if (!client) {
    const url = process.env.QDRANT_URL;
    const apiKey = process.env.QDRANT_API_KEY;
    if (!url || !apiKey) throw new Error("QDRANT_URL or QDRANT_API_KEY is not set");
    client = new QdrantClient({ url, apiKey });
  }
  return client;
}

function getCollectionName(repoId: string) {
  // Collection names must be alphanumeric/underscores/dashes
  const safeId = repoId.replace(/[^a-zA-Z0-9_-]/g, "_");
  return `repo_${safeId}`;
}

export async function collectionExists(repoId: string): Promise<boolean> {
  const collectionName = getCollectionName(repoId);
  try {
    const result = await getQdrantClient().getCollections();
    return result.collections.some(c => c.name === collectionName);
  } catch (error) {
    console.error("Error checking collection existence:", error);
    return false;
  }
}

export async function createCollection(repoId: string) {
  const collectionName = getCollectionName(repoId);
  await getQdrantClient().createCollection(collectionName, {
    vectors: {
      size: QDRANT_VECTOR_SIZE,
      distance: "Cosine",
    },
  });
}

export async function upsertPoints(repoId: string, points: QdrantPoint[]) {
  const collectionName = getCollectionName(repoId);
  
  for (let i = 0; i < points.length; i += QDRANT_UPSERT_BATCH_SIZE) {
    const batch = points.slice(i, i + QDRANT_UPSERT_BATCH_SIZE);
    await getQdrantClient().upsert(collectionName, {
      wait: true,
      points: batch,
    });
  }
}

export async function searchSimilar(repoId: string, queryVector: number[], topK: number) {
  const collectionName = getCollectionName(repoId);
  try {
    const results = await getQdrantClient().search(collectionName, {
      vector: queryVector,
      limit: topK,
      with_payload: true,
    });
    return results;
  } catch (error) {
    console.error("Error searching in Qdrant:", error);
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
