// app/api/repo/[repoId]/route.ts

import { NextRequest } from "next/server";
import { getQdrantClient, deleteCollection, getCollectionName } from "@/lib/qdrant";
import { QDRANT_VECTOR_SIZE } from "@/lib/constants";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ repoId: string }> }
) {
  const { repoId } = await params;
  const decodedRepoId = decodeURIComponent(repoId);

  const client = getQdrantClient();
  try {
    const info = await client.getCollection(getCollectionName(decodedRepoId));
    const existingSize = (info.config.params.vectors as any).size;

    if (existingSize !== QDRANT_VECTOR_SIZE) {
      return Response.json({ 
        status: "reindex_required", 
        reason: "dimension_mismatch",
        currentSize: existingSize,
        requiredSize: QDRANT_VECTOR_SIZE
      });
    }

    return Response.json({
      repoId: decodedRepoId,
      chunkCount: info.points_count || 0,
      status: "ready"
    });
  } catch (error) {
    return Response.json({ status: "not_found" });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ repoId: string }> }
) {
  const { repoId } = await params;
  const decodedRepoId = decodeURIComponent(repoId);
  
  await deleteCollection(decodedRepoId);
  return Response.json({ status: "deleted", repoId: decodedRepoId });
}
