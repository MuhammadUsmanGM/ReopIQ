// lib/ast-chunker.ts
// Structural chunking that respects function/class/module boundaries.
// Uses regex-based boundary detection per language — no native tree-sitter dependency.
// Falls back to the text-based chunker for unsupported or ambiguous cases.

import { RepoChunk } from "@/types";
import { CHUNK_SIZE, CHUNK_OVERLAP } from "./constants";
import { detectLanguage, chunkText, getLanguageSeparators } from "./chunker";

/** A structural block detected in source code */
interface CodeBlock {
  name: string;
  kind: string;        // "class", "function", "method", "module", etc.
  startLine: number;
  endLine: number;
  content: string;
}

// ---------------------------------------------------------------------------
// Boundary patterns per language family
// ---------------------------------------------------------------------------

/** Patterns that match the START of a top-level block. Each returns [kind, name]. */
function getBlockPatterns(language: string): RegExp[] {
  switch (language) {
    case "python":
      return [
        /^(class)\s+(\w+)/,
        /^(def)\s+(\w+)/,
        /^(async\s+def)\s+(\w+)/,
      ];
    case "typescript":
    case "javascript":
      return [
        /^(?:export\s+)?(?:default\s+)?(class)\s+(\w+)/,
        /^(?:export\s+)?(?:default\s+)?(?:async\s+)?(function)\s+(\w+)/,
        /^(?:export\s+)?(const|let|var)\s+(\w+)\s*=/,
        /^(?:export\s+)?(interface)\s+(\w+)/,
        /^(?:export\s+)?(type)\s+(\w+)/,
        /^(?:export\s+)?(enum)\s+(\w+)/,
      ];
    case "java":
      return [
        /^\s*(?:public|private|protected)?\s*(?:static\s+)?(?:abstract\s+)?(class)\s+(\w+)/,
        /^\s*(?:public|private|protected)?\s*(?:static\s+)?(?:abstract\s+)?(interface)\s+(\w+)/,
        /^\s*(?:public|private|protected)?\s*(?:static\s+)?[\w<>\[\]]+\s+(\w+)\s*\(/,
      ];
    case "go":
      return [
        /^(func)\s+(?:\([^)]+\)\s+)?(\w+)/,
        /^(type)\s+(\w+)\s+struct/,
        /^(type)\s+(\w+)\s+interface/,
      ];
    case "rust":
      return [
        /^(?:pub\s+)?(?:async\s+)?(fn)\s+(\w+)/,
        /^(?:pub\s+)?(struct)\s+(\w+)/,
        /^(?:pub\s+)?(enum)\s+(\w+)/,
        /^(?:pub\s+)?(trait)\s+(\w+)/,
        /^(impl)\s+(?:<[^>]+>\s+)?(\w+)/,
        /^(mod)\s+(\w+)/,
      ];
    case "ruby":
      return [
        /^(class)\s+(\w+)/,
        /^(module)\s+(\w+)/,
        /^(def)\s+(\w+)/,
      ];
    case "php":
      return [
        /^(?:abstract\s+)?(class)\s+(\w+)/,
        /^(?:public|private|protected)?\s*(?:static\s+)?(function)\s+(\w+)/,
        /^(namespace)\s+([\w\\]+)/,
      ];
    case "csharp":
      return [
        /^\s*(?:public|private|protected|internal)?\s*(?:static\s+)?(?:abstract\s+)?(?:partial\s+)?(class)\s+(\w+)/,
        /^\s*(?:public|private|protected|internal)?\s*(?:static\s+)?(interface)\s+(\w+)/,
        /^\s*(namespace)\s+([\w.]+)/,
        /^\s*(?:public|private|protected|internal)?\s*(?:static\s+)?(?:async\s+)?[\w<>\[\]?]+\s+(\w+)\s*\(/,
      ];
    case "kotlin":
      return [
        /^(?:data\s+|sealed\s+|abstract\s+|open\s+)?(class)\s+(\w+)/,
        /^(?:fun)\s+(?:<[^>]+>\s+)?(\w+)/,
        /^(object)\s+(\w+)/,
        /^(interface)\s+(\w+)/,
      ];
    case "swift":
      return [
        /^(?:public\s+|private\s+|internal\s+|open\s+)?(class)\s+(\w+)/,
        /^(?:public\s+|private\s+|internal\s+)?(func)\s+(\w+)/,
        /^(?:public\s+|private\s+|internal\s+)?(struct)\s+(\w+)/,
        /^(enum)\s+(\w+)/,
        /^(protocol)\s+(\w+)/,
        /^(extension)\s+(\w+)/,
      ];
    case "elixir":
      return [
        /^(defmodule)\s+([\w.]+)/,
        /^(def|defp)\s+(\w+)/,
        /^(defmacro)\s+(\w+)/,
      ];
    case "scala":
      return [
        /^(?:case\s+)?(class)\s+(\w+)/,
        /^(object)\s+(\w+)/,
        /^(trait)\s+(\w+)/,
        /^(def)\s+(\w+)/,
      ];
    case "dart":
      return [
        /^(class)\s+(\w+)/,
        /^(?:Future|Stream|void|[\w<>]+)\s+(\w+)\s*\(/,
        /^(extension)\s+(\w+)/,
        /^(mixin)\s+(\w+)/,
      ];
    default:
      return []; // No structural patterns — will fall back to text chunker
  }
}

// ---------------------------------------------------------------------------
// Brace/indent based block end detection
// ---------------------------------------------------------------------------

/** For brace-delimited languages: find the end of a block starting at a given line */
function findBraceBlockEnd(lines: string[], startLine: number): number {
  let depth = 0;
  let foundOpen = false;

  for (let i = startLine; i < lines.length; i++) {
    const line = lines[i];
    for (const ch of line) {
      if (ch === "{") { depth++; foundOpen = true; }
      if (ch === "}") { depth--; }
    }
    if (foundOpen && depth <= 0) return i;
  }
  return lines.length - 1;
}

/** For indent-delimited languages (Python, Elixir): find end based on indentation */
function findIndentBlockEnd(lines: string[], startLine: number): number {
  if (startLine >= lines.length - 1) return startLine;

  // Get the indentation of the block header
  const headerIndent = lines[startLine].search(/\S/);
  if (headerIndent < 0) return startLine;

  for (let i = startLine + 1; i < lines.length; i++) {
    const line = lines[i];
    // Skip empty lines
    if (line.trim().length === 0) continue;
    const lineIndent = line.search(/\S/);
    // If we find a line at the same or less indentation, the block ended on the previous non-empty line
    if (lineIndent <= headerIndent) {
      // Walk back to the last non-empty line
      let end = i - 1;
      while (end > startLine && lines[end].trim().length === 0) end--;
      return end;
    }
  }
  return lines.length - 1;
}

function usesIndentBlocks(language: string): boolean {
  return language === "python" || language === "elixir";
}

function usesBraceBlocks(language: string): boolean {
  return ["typescript", "javascript", "java", "go", "rust", "csharp", "kotlin",
          "swift", "dart", "php", "scala", "cpp"].includes(language);
}

// ---------------------------------------------------------------------------
// Structural extraction
// ---------------------------------------------------------------------------

function extractBlocks(content: string, language: string): CodeBlock[] {
  const patterns = getBlockPatterns(language);
  if (patterns.length === 0) return []; // Unsupported — fall back

  const lines = content.split("\n");
  const blocks: CodeBlock[] = [];
  const usedLines = new Set<number>();

  for (let i = 0; i < lines.length; i++) {
    if (usedLines.has(i)) continue;
    const trimmed = lines[i].trimStart();

    for (const pattern of patterns) {
      const match = trimmed.match(pattern);
      if (!match) continue;

      const kind = match[1] || "block";
      const name = match[2] || "anonymous";

      let endLine: number;
      if (usesIndentBlocks(language)) {
        endLine = findIndentBlockEnd(lines, i);
      } else if (usesBraceBlocks(language)) {
        endLine = findBraceBlockEnd(lines, i);
      } else {
        // Ruby uses 'end' keyword — find the matching end
        endLine = findRubyBlockEnd(lines, i);
      }

      const blockContent = lines.slice(i, endLine + 1).join("\n");

      blocks.push({ name, kind, startLine: i, endLine, content: blockContent });

      // Mark lines as used
      for (let j = i; j <= endLine; j++) usedLines.add(j);
      break;
    }
  }

  return blocks;
}

/** Ruby/Elixir-style: find the matching 'end' keyword */
function findRubyBlockEnd(lines: string[], startLine: number): number {
  const headerIndent = lines[startLine].search(/\S/);
  let depth = 1;

  for (let i = startLine + 1; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    const lineIndent = lines[i].search(/\S/);

    // Count nested blocks
    if (/^(class|module|def|do|if|unless|case|begin|while|until|for)\b/.test(trimmed)) {
      depth++;
    }
    if (trimmed === "end" && lineIndent <= headerIndent) {
      depth--;
      if (depth <= 0) return i;
    }
  }
  return lines.length - 1;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Chunk a file using structural (AST-like) boundaries when possible.
 * Falls back to the text-based chunker for unsupported languages or
 * when blocks are too large/small.
 */
export function chunkFileStructural(filePath: string, content: string): RepoChunk[] {
  const language = detectLanguage(filePath);
  const blocks = extractBlocks(content, language);

  // If we couldn't detect any structural blocks, fall back to text chunker
  if (blocks.length === 0) {
    return textFallback(filePath, content, language);
  }

  const chunks: RepoChunk[] = [];

  for (const block of blocks) {
    if (block.content.length <= CHUNK_SIZE) {
      // Block fits in one chunk — great, keep it intact
      chunks.push({
        content: block.content.trim(),
        filePath,
        language,
      });
    } else {
      // Block is too large — sub-chunk it using the text splitter
      // but at least the boundaries start/end at a structural boundary
      const separators = getLanguageSeparators(language);
      const subChunks = chunkText(block.content, separators, CHUNK_SIZE, CHUNK_OVERLAP);
      for (const sc of subChunks) {
        chunks.push({ content: sc, filePath, language });
      }
    }
  }

  // Capture any "orphan" lines not inside a detected block (imports, top-level statements)
  const lines = content.split("\n");
  const coveredLines = new Set<number>();
  for (const block of blocks) {
    for (let i = block.startLine; i <= block.endLine; i++) coveredLines.add(i);
  }

  const orphanLines: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    if (!coveredLines.has(i) && lines[i].trim().length > 0) {
      orphanLines.push(lines[i]);
    }
  }

  if (orphanLines.length > 0) {
    const orphanContent = orphanLines.join("\n").trim();
    if (orphanContent.length > 0) {
      if (orphanContent.length <= CHUNK_SIZE) {
        chunks.push({ content: orphanContent, filePath, language });
      } else {
        const separators = getLanguageSeparators(language);
        const subChunks = chunkText(orphanContent, separators, CHUNK_SIZE, CHUNK_OVERLAP);
        for (const sc of subChunks) {
          chunks.push({ content: sc, filePath, language });
        }
      }
    }
  }

  return chunks.filter(c => c.content.length > 0);
}

function textFallback(filePath: string, content: string, language: string): RepoChunk[] {
  const separators = getLanguageSeparators(language);
  const textChunks = chunkText(content, separators, CHUNK_SIZE, CHUNK_OVERLAP);
  return textChunks.map(c => ({ content: c, filePath, language }));
}

/** Chunk multiple files using structural chunking */
export function chunkFilesStructural(files: { path: string; content: string }[]): RepoChunk[] {
  const allChunks: RepoChunk[] = [];
  for (const file of files) {
    allChunks.push(...chunkFileStructural(file.path, file.content));
  }
  return allChunks;
}
