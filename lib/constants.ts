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

export const MAX_FILES = 3000;
export const MAX_FILE_SIZE_BYTES = 1_000_000;  // 1MB
export const CHUNK_SIZE = 1000;
export const CHUNK_OVERLAP = 200;
export const EMBEDDING_BATCH_SIZE = 16;        // Lowered for memory stability
export const GITHUB_FETCH_CONCURRENCY = 20;
export const QDRANT_VECTOR_SIZE = 768; // gemini-embedding-001 with MRL dimensionality
export const RAG_TOP_K = 15;
export const RAG_CANDIDATE_MULTIPLIER = 2; // Fetch this many more candidates for re-ranking
export const FULL_CONTEXT_TOKEN_THRESHOLD = 80_000; // Below this = send full codebase
export const METADATA_POINT_ID = 999_999_999; // Reserved Qdrant point ID for repo metadata
export const QDRANT_UPSERT_BATCH_SIZE = 100;

export const EMBEDDING_MODEL = "Xenova/all-mpnet-base-v2"; // Open-access 768-dim semantic embedding model

/** Rough token estimate: ~4 characters per token */
export function estimateTokens(texts: string[]): number {
  const totalChars = texts.reduce((sum, t) => sum + t.length, 0);
  return Math.ceil(totalChars / 4);
}
