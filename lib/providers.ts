// lib/providers.ts
// Abstract fetch layer for GitHub, GitLab, and Bitbucket

import { ALLOWED_EXTENSIONS, SKIP_DIRS, MAX_FILES, MAX_FILE_SIZE_BYTES } from "./constants";
import { getGithubToken } from "./env";
import JSZip from "jszip";

/** Detected platform from a repository URL */
export type Platform = "github" | "gitlab" | "bitbucket";

export interface ParsedRepoUrl {
  platform: Platform;
  owner: string;
  repo: string;
  ref?: string;
}

export interface FetchedFile {
  path: string;
  content: string;
}

// ---------------------------------------------------------------------------
// URL Parsing
// ---------------------------------------------------------------------------

export function parseRepoUrl(url: string): ParsedRepoUrl {
  let cleanUrl = url.trim().replace(/\.git$/, "").replace(/\/$/, "");

  // Detect platform
  const platform = detectPlatform(cleanUrl);

  // Strip protocol
  cleanUrl = cleanUrl.replace(/^https?:\/\//, "");

  // Strip domain prefix
  if (platform === "github") {
    cleanUrl = cleanUrl.replace(/^github\.com\//, "");
  } else if (platform === "gitlab") {
    cleanUrl = cleanUrl.replace(/^gitlab\.com\//, "");
  } else if (platform === "bitbucket") {
    cleanUrl = cleanUrl.replace(/^bitbucket\.org\//, "");
  }

  // Handle /tree/branch (GitHub), /-/tree/branch (GitLab), /src/branch (Bitbucket)
  let ref: string | undefined;

  // GitHub: owner/repo/tree/branch
  const ghTree = cleanUrl.match(/^([^/]+\/[^/]+)\/tree\/(.+)$/);
  if (ghTree) {
    cleanUrl = ghTree[1];
    ref = ghTree[2];
  }

  // GitLab: owner/repo/-/tree/branch
  const glTree = cleanUrl.match(/^([^/]+\/[^/]+)\/-\/tree\/(.+)$/);
  if (!ref && glTree) {
    cleanUrl = glTree[1];
    ref = glTree[2];
  }

  // Bitbucket: owner/repo/src/branch
  const bbSrc = cleanUrl.match(/^([^/]+\/[^/]+)\/src\/(.+)$/);
  if (!ref && bbSrc) {
    cleanUrl = bbSrc[1];
    ref = bbSrc[2];
  }

  // Handle @branch syntax
  if (!ref && cleanUrl.includes("@")) {
    const [base, branchPart] = cleanUrl.split("@");
    cleanUrl = base;
    ref = branchPart;
  }

  // Handle #tag syntax
  if (!ref && cleanUrl.includes("#")) {
    const [base, tagPart] = cleanUrl.split("#");
    cleanUrl = base;
    ref = tagPart;
  }

  const parts = cleanUrl.split("/").filter(Boolean);
  if (parts.length < 2) {
    throw new Error("Invalid repository URL. Use owner/repo format.");
  }

  const [owner, repo] = parts;
  return { platform, owner, repo: repo.replace(/\.git$/, ""), ref: ref || undefined };
}

function detectPlatform(url: string): Platform {
  const lower = url.toLowerCase();
  if (lower.includes("gitlab.com") || lower.includes("gitlab")) return "gitlab";
  if (lower.includes("bitbucket.org") || lower.includes("bitbucket")) return "bitbucket";
  return "github"; // default
}

// ---------------------------------------------------------------------------
// File priority (shared across all platforms)
// ---------------------------------------------------------------------------

function getFilePriority(path: string): number {
  const lower = path.toLowerCase();
  const fileName = lower.split("/").pop() || "";
  const depth = path.split("/").length - 1;

  if (depth === 0) {
    if (fileName.startsWith("readme")) return 0;
    if (["package.json", "cargo.toml", "go.mod", "pyproject.toml", "setup.py",
         "build.gradle", "pom.xml", "gemfile", "mix.exs", "pubspec.yaml",
         "composer.json", "cmakelists.txt"].includes(fileName)) return 0;
    if (["dockerfile", "docker-compose.yml", "docker-compose.yaml",
         ".env.example", "makefile"].includes(fileName)) return 1;
  }

  if (["main.ts", "main.tsx", "main.py", "main.go", "main.rs", "main.java",
       "main.dart", "main.kt", "main.scala", "app.ts", "app.tsx", "app.py",
       "app.js", "app.jsx", "index.ts", "index.tsx", "index.js", "index.jsx",
       "mod.rs", "lib.rs"].includes(fileName)) return 1;

  if (fileName.includes("config") || fileName.includes("route") ||
      fileName.includes("schema") || fileName.includes("migration") ||
      fileName.endsWith(".prisma") || fileName.endsWith(".proto") ||
      fileName.endsWith(".graphql") || fileName.endsWith(".gql")) return 2;

  if (depth <= 2) return 3;
  if (depth <= 4) return 4;
  return 5;
}

// ---------------------------------------------------------------------------
// File filtering (shared)
// ---------------------------------------------------------------------------

function isValidFile(path: string): boolean {
  const lowerPath = path.toLowerCase();
  const hasAllowedExtension = Array.from(ALLOWED_EXTENSIONS).some(ext => lowerPath.endsWith(ext));
  if (!hasAllowedExtension) return false;

  const isInSkipDir = Array.from(SKIP_DIRS).some(dir =>
    lowerPath.startsWith(`${dir}/`) || lowerPath.includes(`/${dir}/`)
  );
  return !isInSkipDir;
}

// ---------------------------------------------------------------------------
// ZIP-based fetch (shared logic with platform-specific download URL)
// ---------------------------------------------------------------------------

async function fetchAndExtractZip(zipUrl: string, authHeaders: HeadersInit): Promise<FetchedFile[]> {
  const response = await fetch(zipUrl, { headers: authHeaders });
  if (!response.ok) return []; // Caller handles fallback/error

  const contentLength = response.headers.get("content-length");
  if (contentLength && parseInt(contentLength, 10) > 200 * 1024 * 1024) {
    throw new Error("Repository is too large to process (>200MB ZIP). Try a smaller repository.");
  }

  const buffer = await response.arrayBuffer();
  if (buffer.byteLength > 200 * 1024 * 1024) {
    throw new Error("Repository is too large to process (>200MB ZIP). Try a smaller repository.");
  }

  const zip = await JSZip.loadAsync(buffer);

  // Derive root prefix (most platforms have a root folder in the ZIP)
  const firstPath = Object.keys(zip.files)[0];
  const rootPrefix = firstPath ? firstPath.split("/")[0] + "/" : "";

  const candidates: { path: string; zipFile: JSZip.JSZipObject }[] = [];

  for (const [path, file] of Object.entries(zip.files)) {
    if (file.dir) continue;
    const cleanPath = rootPrefix ? path.replace(rootPrefix, "") : path;
    if (!isValidFile(cleanPath)) continue;
    candidates.push({ path: cleanPath, zipFile: file });
  }

  candidates.sort((a, b) => getFilePriority(a.path) - getFilePriority(b.path));

  const results: FetchedFile[] = [];
  for (const { path, zipFile } of candidates) {
    if (results.length >= MAX_FILES) break;
    const content = await zipFile.async("string");
    if (content.length > MAX_FILE_SIZE_BYTES) continue;
    results.push({ path, content });
  }

  return results;
}

// ---------------------------------------------------------------------------
// GitHub provider
// ---------------------------------------------------------------------------

async function fetchGithubRepo(owner: string, repo: string, ref?: string): Promise<FetchedFile[]> {
  const token = getGithubToken();
  const headers: HeadersInit = { "Accept": "application/vnd.github.v3+json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  let targetRef = ref;
  if (!targetRef) {
    const repoResponse = await fetch(`https://api.github.com/repos/${owner}/${repo}`, { headers });
    if (!repoResponse.ok) {
      if (repoResponse.status === 404) throw new Error("GitHub: Repository not found or is private.");
      if (repoResponse.status === 403) throw new Error("GitHub: API rate limit exceeded. Set GITHUB_TOKEN in .env.");
      throw new Error(`GitHub API error: ${repoResponse.statusText}`);
    }
    const repoData = await repoResponse.json();
    targetRef = repoData.default_branch || "main";
  }

  // Try branch, then tag
  let files = await fetchAndExtractZip(
    `https://github.com/${owner}/${repo}/archive/refs/heads/${targetRef}.zip`, {}
  );
  if (files.length === 0 && ref) {
    files = await fetchAndExtractZip(
      `https://github.com/${owner}/${repo}/archive/refs/tags/${targetRef}.zip`, {}
    );
  }
  if (files.length === 0) {
    throw new Error(`Failed to download GitHub repository for ref "${targetRef}".`);
  }
  return files;
}

// ---------------------------------------------------------------------------
// GitLab provider
// ---------------------------------------------------------------------------

function getGitlabToken(): string | undefined {
  return process.env.GITLAB_TOKEN || undefined;
}

async function fetchGitlabRepo(owner: string, repo: string, ref?: string): Promise<FetchedFile[]> {
  const token = getGitlabToken();
  const projectId = encodeURIComponent(`${owner}/${repo}`);
  const headers: HeadersInit = {};
  if (token) headers["PRIVATE-TOKEN"] = token;

  let targetRef: string = ref || "";
  if (!targetRef) {
    const projectRes = await fetch(`https://gitlab.com/api/v4/projects/${projectId}`, { headers });
    if (!projectRes.ok) {
      if (projectRes.status === 404) throw new Error("GitLab: Project not found or is private. Set GITLAB_TOKEN in .env for private repos.");
      throw new Error(`GitLab API error: ${projectRes.statusText}`);
    }
    const projectData = await projectRes.json();
    targetRef = projectData.default_branch || "main";
  }

  const archiveUrl = `https://gitlab.com/api/v4/projects/${projectId}/repository/archive.zip?sha=${encodeURIComponent(targetRef)}`;
  const files = await fetchAndExtractZip(archiveUrl, headers);
  if (files.length === 0) {
    throw new Error(`Failed to download GitLab repository for ref "${targetRef}".`);
  }
  return files;
}

// ---------------------------------------------------------------------------
// Bitbucket provider
// ---------------------------------------------------------------------------

function getBitbucketCredentials(): { username?: string; appPassword?: string } {
  return {
    username: process.env.BITBUCKET_USERNAME || undefined,
    appPassword: process.env.BITBUCKET_APP_PASSWORD || undefined,
  };
}

async function fetchBitbucketRepo(owner: string, repo: string, ref?: string): Promise<FetchedFile[]> {
  const { username, appPassword } = getBitbucketCredentials();
  const headers: HeadersInit = {};
  if (username && appPassword) {
    headers["Authorization"] = `Basic ${Buffer.from(`${username}:${appPassword}`).toString("base64")}`;
  }

  let targetRef = ref;
  if (!targetRef) {
    const repoRes = await fetch(`https://api.bitbucket.org/2.0/repositories/${owner}/${repo}`, { headers });
    if (!repoRes.ok) {
      if (repoRes.status === 404) throw new Error("Bitbucket: Repository not found or is private.");
      throw new Error(`Bitbucket API error: ${repoRes.statusText}`);
    }
    const repoData = await repoRes.json();
    targetRef = repoData.mainbranch?.name || "main";
  }

  const archiveUrl = `https://bitbucket.org/${owner}/${repo}/get/${targetRef}.zip`;
  const files = await fetchAndExtractZip(archiveUrl, headers);
  if (files.length === 0) {
    throw new Error(`Failed to download Bitbucket repository for ref "${targetRef}".`);
  }
  return files;
}

// ---------------------------------------------------------------------------
// Unified fetch function
// ---------------------------------------------------------------------------

export async function fetchRepoFiles(parsed: ParsedRepoUrl): Promise<FetchedFile[]> {
  switch (parsed.platform) {
    case "github":
      return fetchGithubRepo(parsed.owner, parsed.repo, parsed.ref);
    case "gitlab":
      return fetchGitlabRepo(parsed.owner, parsed.repo, parsed.ref);
    case "bitbucket":
      return fetchBitbucketRepo(parsed.owner, parsed.repo, parsed.ref);
  }
}

/** Build a unique repo ID that includes platform + ref */
export function buildRepoId(parsed: ParsedRepoUrl): string {
  const base = parsed.platform === "github"
    ? `${parsed.owner}/${parsed.repo}`
    : `${parsed.platform}:${parsed.owner}/${parsed.repo}`;

  const id = parsed.ref ? `${base}@${parsed.ref}` : base;
  return id.toLowerCase();
}
