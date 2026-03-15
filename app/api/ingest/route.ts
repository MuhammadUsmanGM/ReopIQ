// app/api/ingest/route.ts

import { NextRequest } from "next/server";
import { parseGithubUrl, getRepoTree, filterValidFiles, fetchFilesInParallel } from "@/lib/github";
import { chunkFiles } from "@/lib/chunker";
import { embedTexts } from "@/lib/embedder";
import { createCollection, upsertPoints, collectionExists } from "@/lib/qdrant";
import { QdrantPoint, SSEProgressEvent } from "@/types";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const { github_url } = await req.json();

  if (!github_url) {
    return Response.json({ error: "GitHub URL is required" }, { status: 400 });
  }

  const encoder = new TextEncoder();
  
  const stream = new ReadableStream({
    async start(controller) {
      const sendStep = (event: SSEProgressEvent) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
      };

      try {
        // 1. Parse GitHub URL
        const { owner, repo } = parseGithubUrl(github_url);
        const repoId = `${owner}/${repo}`.toLowerCase();
        
        // 2. Fetch Tree
        sendStep({ step: "fetching", message: "Fetching repository structure..." });
        const tree = await getRepoTree(owner, repo);
        
        // 3. Filter Files
        sendStep({ step: "filtering", message: "Identifying relevant code files..." });
        const validFiles = filterValidFiles(tree);
        
        if (validFiles.length === 0) {
          throw new Error("No supported code files found in the repository.");
        }

        // 4. Fetch Content
        sendStep({ step: "fetching", message: `Downloading ${validFiles.length} files...` });
        const filesWithContent = await fetchFilesInParallel(owner, repo, validFiles);
        
        // 5. Chunking
        sendStep({ step: "chunking", message: "Splitting code into searchable chunks..." });
        const chunks = chunkFiles(filesWithContent);
        
        // 6. Embedding
        sendStep({ step: "embedding", message: `Generating embeddings for ${chunks.length} chunks...` });
        const chunkContents = chunks.map(c => c.content);
        const vectors = await embedTexts(chunkContents);
        
        // 7. Qdrant Setup
        sendStep({ step: "embedding", message: "Preparing vector database..." });
        if (!(await collectionExists(repoId))) {
          await createCollection(repoId);
        }

        const points: QdrantPoint[] = chunks.map((chunk, i) => ({
          id: crypto.randomUUID(),
          vector: vectors[i],
          payload: {
            content: chunk.content,
            filePath: chunk.filePath,
            language: chunk.language
          }
        }));

        sendStep({ step: "embedding", message: "Storing vectors in Qdrant Cloud..." });
        await upsertPoints(repoId, points);

        // 8. Complete
        sendStep({ 
          step: "complete", 
          repo_id: repoId,
          file_count: validFiles.length,
          chunk_count: chunks.length
        });
        
        controller.close();
      } catch (error: any) {
        console.error("Ingestion Error:", error);
        sendStep({ step: "error", message: error.message || "An unknown error occurred" });
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
    },
  });
}
