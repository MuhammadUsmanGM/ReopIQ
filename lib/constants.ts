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
export const EMBEDDING_BATCH_SIZE = 30;
export const GITHUB_FETCH_CONCURRENCY = 20;
export const QDRANT_VECTOR_SIZE = 3072; // gemini-embedding-001 default size
export const RAG_TOP_K = 5;
export const QDRANT_UPSERT_BATCH_SIZE = 100;

export const GEMINI_MODEL = "gemini-2.5-flash-lite";
export const EMBEDDING_MODEL = "gemini-embedding-001";
