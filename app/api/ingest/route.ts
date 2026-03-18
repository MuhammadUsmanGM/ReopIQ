// app/api/ingest/route.ts

import { NextRequest } from "next/server";
import crypto from "crypto";
import { parseRepoUrl, fetchRepoFiles, buildRepoId } from "@/lib/providers";
import { chunkFilesStructural } from "@/lib/ast-chunker";
import { embedTexts } from "@/lib/embedder";
import {
  createCollection,
  collectionExists,
  upsertPoints,
  storeRepoMetadata,
  getRepoMetadata,
  deletePointsByFile,
} from "@/lib/qdrant";
import { estimateTokens } from "@/lib/constants";
import { QdrantPoint, SSEProgressEvent } from "@/types";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

/** Simple SHA-256 hash of file content */
function hashContent(content: string): string {
  return crypto.createHash("sha256").update(content).digest("hex").slice(0, 16);
}

export async function POST(req: NextRequest) {
  const { github_url } = await req.json();

  if (!github_url) {
    return Response.json({ error: "Repository URL is required" }, { status: 400 });
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const sendStep = (event: SSEProgressEvent) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
      };

      try {
        // 1. Parse & Validate (supports GitHub, GitLab, Bitbucket)
        sendStep({ step: "validating", message: "Detecting platform & verifying repository..." });
        const parsed = parseRepoUrl(github_url);
        const repoId = buildRepoId(parsed);
        const platformLabel = parsed.platform.charAt(0).toUpperCase() + parsed.platform.slice(1);

        // 2. Download repo files
        const refLabel = parsed.ref ? ` (${parsed.ref})` : "";
        sendStep({ step: "fetching", message: `Downloading from ${platformLabel}${refLabel}...` });
        const filesWithContent = await fetchRepoFiles(parsed);

        if (filesWithContent.length === 0) {
          throw new Error("No supported code files found in the repository.");
        }

        // 3. Filtering complete
        sendStep({ step: "filtering", message: `${filesWithContent.length} code files identified.` });

        // 4. Build file tree + hashes for current snapshot
        const fileTree = filesWithContent.map(f => f.path).sort().join("\n");
        const currentHashes: Record<string, string> = {};
        for (const f of filesWithContent) {
          currentHashes[f.path] = hashContent(f.content);
        }

        // 5. Incremental indexing — check what changed
        const exists = await collectionExists(repoId);
        let previousHashes: Record<string, string> = {};
        let isIncremental = false;

        if (exists) {
          const metadata = await getRepoMetadata(repoId);
          if (metadata?.fileHashes) {
            previousHashes = metadata.fileHashes;
            isIncremental = true;
          }
        }

        let filesToProcess: { path: string; content: string }[];
        let filesToDelete: string[] = [];

        if (isIncremental) {
          // Determine changed, added, and removed files
          const changedOrNew = filesWithContent.filter(f => {
            const prevHash = previousHashes[f.path];
            return !prevHash || prevHash !== currentHashes[f.path];
          });
          filesToDelete = Object.keys(previousHashes).filter(p => !currentHashes[p]);
          filesToProcess = changedOrNew;

          if (filesToProcess.length === 0 && filesToDelete.length === 0) {
            sendStep({ step: "embedding", message: "No changes detected — index is up to date." });
            sendStep({
              step: "complete",
              repo_id: repoId,
              file_count: filesWithContent.length,
              chunk_count: 0,
            });
            controller.close();
            return;
          }

          sendStep({
            step: "filtering",
            message: `Incremental: ${filesToProcess.length} changed/new, ${filesToDelete.length} removed.`,
          });
        } else {
          filesToProcess = filesWithContent;
        }

        // 6. Chunking (AST-aware structural chunking)
        sendStep({ step: "chunking", message: "Structural code analysis & chunking..." });
        const chunks = chunkFilesStructural(filesToProcess);

        if (chunks.length === 0 && filesToDelete.length === 0) {
          throw new Error("No indexable content found. Files may be empty or too small to chunk.");
        }

        const totalTokens = estimateTokens(filesWithContent.map(f => f.content));
        sendStep({ step: "chunking", message: `${chunks.length} chunks created (${Math.round(totalTokens / 1000)}K tokens)` });

        // 7. Embedding
        if (chunks.length > 0) {
          sendStep({ step: "embedding", message: "Generating vector embeddings..." });
          const chunkContents = chunks.map(c => c.content);
          const vectors = await embedTexts(chunkContents, (current, total) => {
            if (current % 10 === 0 || current === total) {
              sendStep({
                step: "embedding",
                message: `Embedded: ${current} / ${total} chunks`,
              });
            }
          });

          // 8. Create collection (full) or update incrementally
          if (!isIncremental) {
            sendStep({ step: "embedding", message: "Creating vector collection..." });
            await createCollection(repoId);
          } else {
            // Delete vectors for changed/removed files
            const pathsToRemove = [
              ...filesToProcess.map(f => f.path),
              ...filesToDelete,
            ];
            if (pathsToRemove.length > 0) {
              sendStep({ step: "embedding", message: `Removing ${pathsToRemove.length} stale file indexes...` });
              for (const fp of pathsToRemove) {
                await deletePointsByFile(repoId, fp);
              }
            }
          }

          // 9. Upsert new vectors
          const points: QdrantPoint[] = chunks.map((chunk, i) => ({
            id: crypto.randomUUID(),
            vector: vectors[i],
            payload: {
              content: chunk.content,
              filePath: chunk.filePath,
              language: chunk.language,
              fileHash: currentHashes[chunk.filePath],
            },
          }));

          await upsertPoints(repoId, points, (current, total) => {
            sendStep({
              step: "embedding",
              message: `Stored: ${current} / ${total} vectors`,
            });
          });
        } else if (filesToDelete.length > 0) {
          // Only deletions, no new chunks
          for (const fp of filesToDelete) {
            await deletePointsByFile(repoId, fp);
          }
        }

        // 10. Store/update repo metadata with file hashes
        await storeRepoMetadata(repoId, {
          type: "metadata",
          totalTokens,
          fileTree,
          fileCount: filesWithContent.length,
          chunkCount: chunks.length,
          fileHashes: currentHashes,
        });

        // 11. Complete
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
