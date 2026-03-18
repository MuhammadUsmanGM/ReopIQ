// types/index.ts

export type ProcessingStep =
  | "validating"
  | "fetching"
  | "filtering"
  | "chunking"
  | "embedding"
  | "complete"
  | "error";

export interface StepStatus {
  id: string;
  label: string;
  status: "waiting" | "processing" | "complete" | "error";
}

export interface SSEProgressEvent {
  step: ProcessingStep;
  message?: string;
  detail?: string;       // Sub-step detail shown below the main message
  repo_id?: string;
  file_count?: number;
  chunk_count?: number;
  processed?: number;
  total?: number;
  skipped_large?: number;      // Files skipped for being >100KB
  skipped_unsupported?: number; // Files skipped for unsupported extension
  skipped_dir?: number;        // Files skipped for being in excluded dirs
  percent?: number;            // Fine-grained progress 0-100
}

export interface ChatMessage {
  role: "user" | "bot";
  content: string;
  sources?: string[];
  timestamp?: Date;
}

export interface ChatSSEEvent {
  event: "message" | "sources" | "done" | "error" | "status";
  data: string;
}

export interface RepoChunk {
  content: string;
  filePath: string;
  language: string;
}

export interface QdrantPoint {
  id: string | number;
  vector: number[];
  payload: {
    content: string;
    filePath: string;
    language: string;
    type?: string;
    fileHash?: string;
  };
}

export interface RepoMetadata {
  type: "metadata";
  totalTokens: number;
  fileTree: string;
  fileCount: number;
  chunkCount: number;
  /** Map of filePath → content hash for incremental indexing */
  fileHashes?: Record<string, string>;
}

export interface HybridRetrievalResult {
  chunks: RepoChunk[];
  fileTree: string;
  mode: "full" | "rag";
  sources: string[];
}

export interface RepoInfo {
  repoId: string;
  chunkCount: number;
  status: "ready" | "not_found" | "reindex_required";
}
