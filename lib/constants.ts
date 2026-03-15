// lib/constants.ts

export const ALLOWED_EXTENSIONS = new Set([
  ".py", ".ts", ".tsx", ".js", ".jsx",
  ".java", ".go", ".rs", ".cpp", ".c",
  ".h", ".hpp", ".md", ".json", ".yaml",
  ".yml", ".toml", ".sql", ".css", ".html",
  ".env.example", ".sh"
]);

export const SKIP_DIRS = new Set([
  "node_modules", ".git", "__pycache__",
  ".next", "dist", "build", ".venv",
  "venv", ".pytest_cache", "coverage",
  ".idea", ".vscode", "out", ".turbo"
]);

export const MAX_FILES = 500;
export const MAX_FILE_SIZE_BYTES = 100_000;    // 100KB
export const CHUNK_SIZE = 1000;
export const CHUNK_OVERLAP = 200;
export const EMBEDDING_BATCH_SIZE = 100;
export const GITHUB_FETCH_CONCURRENCY = 20;
export const QDRANT_VECTOR_SIZE = 384; // Local all-MiniLM-L6-v2 size
export const RAG_TOP_K = 15;
export const FULL_CONTEXT_TOKEN_THRESHOLD = 80_000; // Below this = send full codebase
export const METADATA_POINT_ID = 999_999_999; // Reserved Qdrant point ID for repo metadata
export const QDRANT_UPSERT_BATCH_SIZE = 100;

export const GEMINI_MODEL = "gemini-2.5-flash-lite"; // Primary reasoning model
export const EMBEDDING_MODEL = "Xenova/all-MiniLM-L6-v2"; // Local embedding model

/** Rough token estimate: ~4 characters per token */
export function estimateTokens(texts: string[]): number {
  const totalChars = texts.reduce((sum, t) => sum + t.length, 0);
  return Math.ceil(totalChars / 4);
}
