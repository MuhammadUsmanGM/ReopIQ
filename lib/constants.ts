// lib/constants.ts

export const ALLOWED_EXTENSIONS = new Set([
  // JavaScript / TypeScript
  ".js", ".jsx", ".ts", ".tsx", ".mjs", ".cjs",
  // Python
  ".py",
  // Java / JVM
  ".java", ".kt", ".kts", ".scala",
  // C / C++
  ".c", ".h", ".cpp", ".hpp", ".cc", ".cxx",
  // Systems
  ".go", ".rs",
  // Mobile
  ".swift", ".dart",
  // Web frameworks
  ".vue", ".svelte",
  // .NET
  ".cs",
  // Scripting
  ".rb", ".php", ".lua", ".r", ".R",
  // Elixir / Erlang
  ".ex", ".exs", ".erl",
  // Schemas & query
  ".sql", ".graphql", ".gql", ".proto",
  // Config & IaC
  ".json", ".yaml", ".yml", ".toml", ".xml", ".tf", ".hcl",
  // ORM / DB
  ".prisma",
  // Markup & style
  ".md", ".css", ".scss", ".html",
  // Shell & misc
  ".sh", ".bash", ".zsh", ".dockerfile",
  ".env.example",
]);

export const SKIP_DIRS = new Set([
  "node_modules", ".git", "__pycache__",
  ".next", "dist", "build", ".venv",
  "venv", ".pytest_cache", "coverage",
  ".idea", ".vscode", "out", ".turbo"
]);

export const MAX_FILES = 1500;
export const MAX_FILE_SIZE_BYTES = 100_000;    // 100KB
export const CHUNK_SIZE = 1000;
export const CHUNK_OVERLAP = 200;
export const EMBEDDING_BATCH_SIZE = 100;
export const GITHUB_FETCH_CONCURRENCY = 20;
export const QDRANT_VECTOR_SIZE = 768; // jina-embeddings-v2-base-code size
export const RAG_TOP_K = 15;
export const FULL_CONTEXT_TOKEN_THRESHOLD = 80_000; // Below this = send full codebase
export const METADATA_POINT_ID = 999_999_999; // Reserved Qdrant point ID for repo metadata
export const QDRANT_UPSERT_BATCH_SIZE = 100;

export const GEMINI_MODEL = "gemini-2.5-flash-lite"; // Primary reasoning model
export const EMBEDDING_MODEL = "Xenova/jina-embeddings-v2-base-code"; // Code-aware embedding model

/** Rough token estimate: ~4 characters per token */
export function estimateTokens(texts: string[]): number {
  const totalChars = texts.reduce((sum, t) => sum + t.length, 0);
  return Math.ceil(totalChars / 4);
}
