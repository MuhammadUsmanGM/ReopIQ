// lib/chunker.ts

import { RepoChunk } from "@/types";
import { CHUNK_SIZE, CHUNK_OVERLAP } from "./constants";

export function detectLanguage(filePath: string): string {
  const ext = filePath.split(".").pop()?.toLowerCase();
  switch (ext) {
    case "py": return "python";
    case "ts":
    case "tsx": return "typescript";
    case "js":
    case "jsx": return "javascript";
    case "go": return "go";
    case "rs": return "rust";
    case "md": return "markdown";
    case "sql": return "sql";
    case "java": return "java";
    case "cpp":
    case "c":
    case "h":
    case "hpp": return "cpp";
    default: return "text";
  }
}

export function getLanguageSeparators(language: string): string[] {
  switch (language) {
    case "python":
      return ["\nclass ", "\ndef ", "\n\n", "\n", " "];
    case "typescript":
    case "javascript":
      return ["\nclass ", "\nfunction ", "\nconst ", "\ninterface ", "\ntype ", "\n\n", "\n", " "];
    case "markdown":
      return ["\n# ", "\n## ", "\n### ", "\n\n", "\n", " "];
    default:
      return ["\n\n", "\n", " "];
  }
}

export function chunkText(text: string, separators: string[], size: number, overlap: number): string[] {
  const chunks: string[] = [];
  let currentPos = 0;

  while (currentPos < text.length) {
    let endPos = currentPos + size;
    
    if (endPos < text.length) {
      // Find the best separator within the size limit
      let bestSeparatorPos = -1;
      for (const sep of separators) {
        const lastIndexOfSep = text.lastIndexOf(sep, endPos);
        if (lastIndexOfSep > currentPos) {
          bestSeparatorPos = lastIndexOfSep + sep.length;
          break;
        }
      }

      if (bestSeparatorPos !== -1) {
        endPos = bestSeparatorPos;
      }
    }

    chunks.push(text.slice(currentPos, endPos).trim());
    
    // Move forward, ensuring we don't get stuck and respecting overlap
    const nextPos = Math.max(currentPos + 1, endPos - overlap);
    currentPos = nextPos;
    
    // Safety break for very small chunks or infinite loops
    if (chunks.length > 5000) break; 
  }

  return chunks.filter(c => c.length > 0);
}

export function chunkFile(filePath: string, content: string): RepoChunk[] {
  const language = detectLanguage(filePath);
  const separators = getLanguageSeparators(language);
  const textChunks = chunkText(content, separators, CHUNK_SIZE, CHUNK_OVERLAP);

  return textChunks.map(content => ({
    content,
    filePath,
    language
  }));
}

export function chunkFiles(files: { path: string; content: string }[]): RepoChunk[] {
  const allChunks: RepoChunk[] = [];
  for (const file of files) {
    allChunks.push(...chunkFile(file.path, file.content));
  }
  return allChunks;
}
