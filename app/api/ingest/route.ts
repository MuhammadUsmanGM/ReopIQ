// app/api/ingest/route.ts

import { NextRequest } from "next/server";
import crypto from "crypto";
import { parseGithubUrl, fetchRepoAsZip } from "@/lib/github";
import { chunkFiles } from "@/lib/chunker";
import { embedTexts } from "@/lib/embedder";
import { createCollection, upsertPoints, collectionExists } from "@/lib/qdrant";
import { QdrantPoint, SSEProgressEvent } from "@/types";

export const maxDuration = 300;
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
        // 1. Parse & Validate
        sendStep({ step: "validating", message: "Verifying repository identity..." });
        const { owner, repo } = parseGithubUrl(github_url);
        const repoId = `${owner}/${repo}`.toLowerCase();
        
        // 2. High-Speed ZIP Ingestion
        sendStep({ step: "fetching", message: "Initiating high-speed neural download..." });
        const filesWithContent = await fetchRepoAsZip(owner, repo);
        
        if (filesWithContent.length === 0) {
          throw new Error("No supported code files found in the repository.");
        }

        // 3. Filtering Complete
        sendStep({ step: "filtering", message: `AI file selection complete. ${filesWithContent.length} code files identified.` });

        // 4. Chunking
        sendStep({ step: "chunking", message: "Splitting code into searchable chunks..." });
        const chunks = chunkFiles(filesWithContent);
        
        // 6. Embedding with High-Speed Local Neural Engine
        sendStep({ step: "embedding", message: "Starting High-Speed Local Neural Alignment..." });
        const chunkContents = chunks.map(c => c.content);
        const vectors = await embedTexts(chunkContents, (current, total) => {
          if (current % 10 === 0 || current === total) {
            sendStep({ 
              step: "embedding", 
              message: `Neural Aligned: ${current} / ${total} segments (Rate Limit: Unlimited)` 
            });
          }
        });
        
        // 7. Qdrant Setup
        sendStep({ step: "embedding", message: "Preparing vector database..." });
        await createCollection(repoId);

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
        await upsertPoints(repoId, points, (current, total) => {
          sendStep({ 
            step: "embedding", 
            message: `Neural storage: ${current} / ${total} vectors anchored` 
          });
        });

        // 8. Complete
        sendStep({ 
          step: "complete", 
          repo_id: repoId,
          file_count: filesWithContent.length,
          chunk_count: chunks.length
        });
        
        controller.close();
      } catch (error: any) {
        console.error("Ingestion Error:", error);
        // Send a clean error message to avoid breaking SSE with large objects
        const cleanMessage = error.status === 400 
          ? "Neural metadata mismatch (Qdrant 400). Re-indexing required."
          : (error.message || "An unknown error occurred");
          
        sendStep({ step: "error", message: cleanMessage });
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
