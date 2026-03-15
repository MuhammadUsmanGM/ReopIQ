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
  repo_id?: string;
  file_count?: number;
  chunk_count?: number;
  processed?: number;
  total?: number;
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
  };
}

export interface RepoInfo {
  repoId: string;
  chunkCount: number;
  status: "ready" | "not_found";
}
