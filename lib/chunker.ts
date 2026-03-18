// lib/chunker.ts

import { RepoChunk } from "@/types";
import { CHUNK_SIZE, CHUNK_OVERLAP } from "./constants";

export function detectLanguage(filePath: string): string {
  // Handle special filenames first
  const fileName = filePath.split("/").pop()?.toLowerCase() ?? "";
  if (fileName === "dockerfile" || fileName.endsWith(".dockerfile")) return "dockerfile";

  const ext = filePath.split(".").pop()?.toLowerCase();
  switch (ext) {
    case "py": return "python";
    case "ts":
    case "tsx":
    case "mjs":
    case "cjs": return "typescript";
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
    case "hpp":
    case "cc":
    case "cxx": return "cpp";
    case "json": return "json";
    case "yaml":
    case "yml": return "yaml";
    case "toml": return "toml";
    case "css":
    case "scss": return "css";
    case "html": return "html";
    case "sh":
    case "bash":
    case "zsh": return "bash";
    // New languages
    case "rb": return "ruby";
    case "php": return "php";
    case "cs": return "csharp";
    case "kt":
    case "kts": return "kotlin";
    case "swift": return "swift";
    case "dart": return "dart";
    case "scala": return "scala";
    case "vue": return "vue";
    case "svelte": return "svelte";
    case "lua": return "lua";
    case "r":
    case "R": return "r";
    case "ex":
    case "exs": return "elixir";
    case "erl": return "erlang";
    case "graphql":
    case "gql": return "graphql";
    case "proto": return "protobuf";
    case "xml": return "xml";
    case "tf":
    case "hcl": return "terraform";
    case "prisma": return "prisma";
    default: return "text";
  }
}

export function getLanguageSeparators(language: string): string[] {
  switch (language) {
    case "python":
      return ["\nclass ", "\ndef ", "\nasync def ", "\n\n", "\n", " "];
    case "typescript":
    case "javascript":
      return ["\nclass ", "\nfunction ", "\nasync function ", "\nconst ", "\nlet ", "\ninterface ", "\ntype ", "\nexport ", "\n\n", "\n", " "];
    case "java":
      return ["\npublic class ", "\nclass ", "\npublic ", "\nprivate ", "\nprotected ", "\n@", "\n\n", "\n", " "];
    case "go":
      return ["\nfunc ", "\ntype ", "\nvar ", "\nconst ", "\n\n", "\n", " "];
    case "rust":
      return ["\nfn ", "\npub fn ", "\nasync fn ", "\npub async fn ", "\nstruct ", "\nimpl ", "\nenum ", "\ntrait ", "\nmod ", "\n\n", "\n", " "];
    case "cpp":
      return ["\nclass ", "\nstruct ", "\nvoid ", "\nint ", "\nnamespace ", "\ntemplate", "\n\n", "\n", " "];
    case "sql":
      return ["\nCREATE ", "\nSELECT ", "\nINSERT ", "\nUPDATE ", "\nDELETE ", "\nALTER ", "\n\n", "\n", " "];
    case "markdown":
      return ["\n# ", "\n## ", "\n### ", "\n\n", "\n", " "];
    case "ruby":
      return ["\nclass ", "\nmodule ", "\ndef ", "\n\n", "\n", " "];
    case "php":
      return ["\nclass ", "\nfunction ", "\npublic function ", "\nprivate function ", "\nprotected function ", "\nnamespace ", "\n\n", "\n", " "];
    case "csharp":
      return ["\nclass ", "\nnamespace ", "\npublic ", "\nprivate ", "\nprotected ", "\ninternal ", "\nstatic ", "\nasync ", "\n[", "\n\n", "\n", " "];
    case "kotlin":
      return ["\nclass ", "\nfun ", "\nval ", "\nvar ", "\nobject ", "\ninterface ", "\ndata class ", "\nsealed class ", "\n\n", "\n", " "];
    case "swift":
      return ["\nclass ", "\nfunc ", "\nstruct ", "\nenum ", "\nprotocol ", "\nextension ", "\nvar ", "\nlet ", "\n\n", "\n", " "];
    case "dart":
      return ["\nclass ", "\nvoid ", "\nFuture<", "\nStream<", "\nextension ", "\nmixin ", "\nenum ", "\n\n", "\n", " "];
    case "scala":
      return ["\nclass ", "\nobject ", "\ntrait ", "\ndef ", "\nval ", "\nvar ", "\ncase class ", "\nsealed trait ", "\n\n", "\n", " "];
    case "vue":
    case "svelte":
      return ["\n<template", "\n<script", "\n<style", "\nexport ", "\nfunction ", "\nconst ", "\n\n", "\n", " "];
    case "lua":
      return ["\nfunction ", "\nlocal function ", "\nlocal ", "\n\n", "\n", " "];
    case "r":
      return ["\n# ", "\n## ", "\n### ", "\n\n", "\n", " "];
    case "elixir":
      return ["\ndefmodule ", "\ndef ", "\ndefp ", "\ndefmacro ", "\n\n", "\n", " "];
    case "erlang":
      return ["\n-module", "\n-export", "\n-spec", "\n\n", "\n", " "];
    case "graphql":
      return ["\ntype ", "\nquery ", "\nmutation ", "\nsubscription ", "\nfragment ", "\ninput ", "\nenum ", "\ninterface ", "\n\n", "\n", " "];
    case "protobuf":
      return ["\nmessage ", "\nservice ", "\nenum ", "\nrpc ", "\n\n", "\n", " "];
    case "xml":
      return ["\n<", "\n\n", "\n", " "];
    case "terraform":
      return ["\nresource ", "\ndata ", "\nvariable ", "\noutput ", "\nmodule ", "\nprovider ", "\nlocals ", "\n\n", "\n", " "];
    case "prisma":
      return ["\nmodel ", "\nenum ", "\ndatasource ", "\ngenerator ", "\n\n", "\n", " "];
    case "dockerfile":
      return ["\nFROM ", "\nRUN ", "\nCOPY ", "\nENV ", "\nEXPOSE ", "\nCMD ", "\nENTRYPOINT ", "\n\n", "\n", " "];
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
