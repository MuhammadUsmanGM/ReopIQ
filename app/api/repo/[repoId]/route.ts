// app/api/repo/[repoId]/route.ts

import { NextRequest } from "next/server";
import { collectionExists, getCollectionInfo, deleteCollection } from "@/lib/qdrant";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ repoId: string }> }
) {
  const { repoId } = await params;
  const decodedRepoId = decodeURIComponent(repoId);

  const exists = await collectionExists(decodedRepoId);
  if (!exists) {
    return Response.json({ status: "not_found" }, { status: 404 });
  }

  const info = await getCollectionInfo(decodedRepoId);
  return Response.json({
    repoId: decodedRepoId,
    chunkCount: info?.pointsCount || 0,
    status: "ready"
  });
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
