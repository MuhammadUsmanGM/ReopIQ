import { ALLOWED_EXTENSIONS, SKIP_DIRS, MAX_FILES, MAX_FILE_SIZE_BYTES, GITHUB_FETCH_CONCURRENCY } from "./constants";
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
  const token = process.env.GITHUB_TOKEN;
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
    console.error(`Error fetching file ${path}:`, error);
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

export async function fetchRepoAsZip(owner: string, repo: string): Promise<{ path: string; content: string }[]> {
  const token = process.env.GITHUB_TOKEN;
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

  const buffer = await response.arrayBuffer();
  const zip = await JSZip.loadAsync(buffer);

  const results: { path: string; content: string }[] = [];
  let fileCount = 0;

  // Derive root prefix from first ZIP entry (GitHub zips always have repo-branch/ prefix)
  const firstPath = Object.keys(zip.files)[0];
  const rootPrefix = firstPath ? firstPath.split("/")[0] + "/" : "";

  for (const [path, file] of Object.entries(zip.files)) {
    if (file.dir) continue;
    if (fileCount >= MAX_FILES) break;

    // Remove the root folder prefix from path
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

    const content = await file.async("string");
    if (content.length > MAX_FILE_SIZE_BYTES) continue;

    results.push({ path: cleanPath, content });
    fileCount++;
  }

  return results;
}
