import { ALLOWED_EXTENSIONS, SKIP_DIRS, MAX_FILES, MAX_FILE_SIZE_BYTES, GITHUB_FETCH_CONCURRENCY } from "./constants";
import { getGithubToken } from "./env";
import JSZip from "jszip";

export interface GitTreeItem {
  path: string;
  mode: string;
  type: "blob" | "tree";
  sha: string;
  size?: number;
  url: string;
}

export function parseGithubUrl(url: string) {
  // Supports:
  // https://github.com/owner/repo
  // github.com/owner/repo
  // owner/repo
  const cleanUrl = url.replace(/^https?:\/\//, "").replace(/^github\.com\//, "");
  const parts = cleanUrl.split("/");
  
  if (parts.length < 2) {
    throw new Error("Invalid GitHub URL format. Use owner/repo");
  }

  const [owner, repo] = parts;
  return { owner, repo };
}

async function fetchGithub(path: string) {
  const token = getGithubToken();
  const headers: HeadersInit = {
    "Accept": "application/vnd.github.v3+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const response = await fetch(`https://api.github.com${path}`, { headers });
  
  if (!response.ok) {
    if (response.status === 404) throw new Error("Repository not found or is private");
    if (response.status === 403) throw new Error("GitHub API rate limit exceeded");
    throw new Error(`GitHub API Error: ${response.statusText}`);
  }

  return response.json();
}

export async function getRepoTree(owner: string, repo: string): Promise<GitTreeItem[]> {
  const data = await fetchGithub(`/repos/${owner}/${repo}/git/trees/HEAD?recursive=1`);
  if (!data.tree) throw new Error("Failed to fetch repository tree");
  return data.tree;
}

export function filterValidFiles(tree: GitTreeItem[]): GitTreeItem[] {
  return tree
    .filter(item => {
      if (item.type !== "blob") return false;
      const path = item.path.toLowerCase();
      
      // Filter by extension
      const hasAllowedExtension = Array.from(ALLOWED_EXTENSIONS).some(ext => path.endsWith(ext));
      if (!hasAllowedExtension) return false;

      // Skip directories
      const isInSkipDir = Array.from(SKIP_DIRS).some(dir => 
        path.startsWith(`${dir}/`) || path.includes(`/${dir}/`)
      );
      if (isInSkipDir) return false;

      // Skip large files (though size might not be in the tree, we'll check later if needed)
      if (item.size && item.size > MAX_FILE_SIZE_BYTES) return false;

      return true;
    })
    .slice(0, MAX_FILES);
}

export async function fetchFileContent(owner: string, repo: string, path: string): Promise<string | null> {
  try {
    const data = await fetchGithub(`/repos/${owner}/${repo}/contents/${path}`);
    if (data.encoding === "base64" && data.content) {
      // Decode base64 handling potential UTF-8 issues
      return Buffer.from(data.content, "base64").toString("utf-8");
    }
    return null;
  } catch (error) {
    return null;
  }
}

export async function fetchFilesInParallel(owner: string, repo: string, files: GitTreeItem[]) {
  const results: { path: string; content: string }[] = [];
  
  for (let i = 0; i < files.length; i += GITHUB_FETCH_CONCURRENCY) {
    const batch = files.slice(i, i + GITHUB_FETCH_CONCURRENCY);
    const batchResults = await Promise.all(
      batch.map(async (file) => {
        const content = await fetchFileContent(owner, repo, file.path);
        return content ? { path: file.path, content } : null;
      })
    );
    
    results.push(...(batchResults.filter(r => r !== null) as { path: string; content: string }[]));
  }

  return results;
}

/** Priority tiers for file sorting — lower number = indexed first */
function getFilePriority(path: string): number {
  const lower = path.toLowerCase();
  const fileName = lower.split("/").pop() || "";
  const depth = path.split("/").length - 1;

  // Tier 0: Root entry points & config
  if (depth === 0) {
    if (fileName.startsWith("readme")) return 0;
    if (["package.json", "cargo.toml", "go.mod", "pyproject.toml", "setup.py",
         "build.gradle", "pom.xml", "gemfile", "mix.exs", "pubspec.yaml",
         "composer.json", "cmakelists.txt"].includes(fileName)) return 0;
    if (["dockerfile", "docker-compose.yml", "docker-compose.yaml",
         ".env.example", "makefile"].includes(fileName)) return 1;
  }

  // Tier 1: Entry point source files
  if (fileName === "main.ts" || fileName === "main.tsx" || fileName === "main.py" ||
      fileName === "main.go" || fileName === "main.rs" || fileName === "main.java" ||
      fileName === "main.dart" || fileName === "main.kt" || fileName === "main.scala" ||
      fileName === "app.ts" || fileName === "app.tsx" || fileName === "app.py" ||
      fileName === "app.js" || fileName === "app.jsx" ||
      fileName === "index.ts" || fileName === "index.tsx" ||
      fileName === "index.js" || fileName === "index.jsx" ||
      fileName === "mod.rs" || fileName === "lib.rs") return 1;

  // Tier 2: Config, schema, and route files
  if (fileName.includes("config") || fileName.includes("route") ||
      fileName.includes("schema") || fileName.includes("migration") ||
      fileName.endsWith(".prisma") || fileName.endsWith(".proto") ||
      fileName.endsWith(".graphql") || fileName.endsWith(".gql")) return 2;

  // Tier 3: Source files at shallow depth (likely core code)
  if (depth <= 2) return 3;

  // Tier 4: Source files deeper in the tree
  if (depth <= 4) return 4;

  // Tier 5: Everything else (deep nested, tests, etc.)
  return 5;
}

export async function fetchRepoAsZip(owner: string, repo: string): Promise<{ path: string; content: string }[]> {
  const token = getGithubToken();
  const headers: HeadersInit = {
    "Accept": "application/vnd.github.v3+json",
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  // Get default branch with proper error handling
  const repoResponse = await fetch(`https://api.github.com/repos/${owner}/${repo}`, { headers });
  if (!repoResponse.ok) {
    if (repoResponse.status === 404) throw new Error("Repository not found or is private.");
    if (repoResponse.status === 403) throw new Error("GitHub API rate limit exceeded.");
    throw new Error(`GitHub API error: ${repoResponse.statusText}`);
  }
  const repoData = await repoResponse.json();
  const defaultBranch = repoData.default_branch || "main";

  const response = await fetch(`https://github.com/${owner}/${repo}/archive/refs/heads/${defaultBranch}.zip`);
  if (!response.ok) throw new Error("Failed to download repository ZIP.");

  // Guard against OOM: reject ZIPs larger than 200MB
  const contentLength = response.headers.get("content-length");
  if (contentLength && parseInt(contentLength, 10) > 200 * 1024 * 1024) {
    throw new Error("Repository is too large to process (>200MB ZIP). Try a smaller repository.");
  }

  const buffer = await response.arrayBuffer();
  if (buffer.byteLength > 200 * 1024 * 1024) {
    throw new Error("Repository is too large to process (>200MB ZIP). Try a smaller repository.");
  }
  const zip = await JSZip.loadAsync(buffer);

  // Derive root prefix from first ZIP entry (GitHub zips always have repo-branch/ prefix)
  const firstPath = Object.keys(zip.files)[0];
  const rootPrefix = firstPath ? firstPath.split("/")[0] + "/" : "";

  // Collect all valid files first
  const candidates: { path: string; zipFile: JSZip.JSZipObject }[] = [];

  for (const [path, file] of Object.entries(zip.files)) {
    if (file.dir) continue;

    const cleanPath = rootPrefix ? path.replace(rootPrefix, "") : path;
    const lowerPath = cleanPath.toLowerCase();

    // Extension check
    const hasAllowedExtension = Array.from(ALLOWED_EXTENSIONS).some(ext => lowerPath.endsWith(ext));
    if (!hasAllowedExtension) continue;

    // Skip dirs
    const isInSkipDir = Array.from(SKIP_DIRS).some(dir =>
      lowerPath.startsWith(`${dir}/`) || lowerPath.includes(`/${dir}/`)
    );
    if (isInSkipDir) continue;

    candidates.push({ path: cleanPath, zipFile: file });
  }

  // Sort by priority so important files get indexed first when hitting MAX_FILES
  candidates.sort((a, b) => getFilePriority(a.path) - getFilePriority(b.path));

  // Read file contents up to MAX_FILES
  const results: { path: string; content: string }[] = [];

  for (const { path, zipFile } of candidates) {
    if (results.length >= MAX_FILES) break;

    const content = await zipFile.async("string");
    if (content.length > MAX_FILE_SIZE_BYTES) continue;

    results.push({ path, content });
  }

  return results;
}
