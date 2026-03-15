// app/api/ingest/route.ts

import { NextRequest } from "next/server";
import crypto from "crypto";
import { parseGithubUrl, fetchRepoAsZip } from "@/lib/github";
import { chunkFiles } from "@/lib/chunker";
import { embedTexts } from "@/lib/embedder";
import { createCollection, upsertPoints, storeRepoMetadata } from "@/lib/qdrant";
import { estimateTokens } from "@/lib/constants";
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

        // 2. Download repo as ZIP
        sendStep({ step: "fetching", message: "Downloading repository..." });
        const filesWithContent = await fetchRepoAsZip(owner, repo);

        if (filesWithContent.length === 0) {
          throw new Error("No supported code files found in the repository.");
        }

        // 3. Filtering complete
        sendStep({ step: "filtering", message: `${filesWithContent.length} code files identified.` });

        // 4. Build file tree
        const fileTree = filesWithContent.map(f => f.path).sort().join("\n");

        // 5. Chunking
        sendStep({ step: "chunking", message: "Splitting code into searchable chunks..." });
        const chunks = chunkFiles(filesWithContent);

        if (chunks.length === 0) {
          throw new Error("No indexable content found. Files may be empty or too small to chunk.");
        }

        // 6. Calculate token count
        const totalTokens = estimateTokens(chunks.map(c => c.content));
        sendStep({ step: "chunking", message: `${chunks.length} chunks created (${Math.round(totalTokens / 1000)}K tokens)` });

        // 7. Embedding
        sendStep({ step: "embedding", message: "Generating vector embeddings..." });
        const chunkContents = chunks.map(c => c.content);
        const vectors = await embedTexts(chunkContents, (current, total) => {
          if (current % 10 === 0 || current === total) {
            sendStep({
              step: "embedding",
              message: `Embedded: ${current} / ${total} chunks`
            });
          }
        });

        // 8. Create collection + store vectors
        sendStep({ step: "embedding", message: "Storing in vector database..." });
        await createCollection(repoId);

        const points: QdrantPoint[] = chunks.map((chunk, i) => ({
          id: crypto.randomUUID(),
          vector: vectors[i],
          payload: {
            content: chunk.content,
            filePath: chunk.filePath,
            language: chunk.language,
          }
        }));

        await upsertPoints(repoId, points, (current, total) => {
          sendStep({
            step: "embedding",
            message: `Stored: ${current} / ${total} vectors`
          });
        });

        // 9. Store repo metadata (file tree + token count)
        await storeRepoMetadata(repoId, {
          type: "metadata",
          totalTokens,
          fileTree,
          fileCount: filesWithContent.length,
          chunkCount: chunks.length,
        });

        // 10. Complete
        sendStep({
          step: "complete",
          repo_id: repoId,
          file_count: filesWithContent.length,
          chunk_count: chunks.length,
        });

        controller.close();
      } catch (error: any) {
        const cleanMessage = error.status === 400
          ? "Database metadata mismatch. Re-indexing required."
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
