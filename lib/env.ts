// lib/env.ts
import { existsSync, readFileSync } from "fs";
import { join } from "path";
import { homedir } from "os";

let _envLoaded = false;

/** Load ~/.codelens/.env into process.env (won't overwrite existing vars) */
export function loadCodeLensEnv() {
  if (_envLoaded) return;
  _envLoaded = true;
  const envPath = join(homedir(), ".codelens", ".env");
  if (!existsSync(envPath)) return;
  for (const line of readFileSync(envPath, "utf-8").split("\n")) {
    const m = line.match(/^([^#=]+)=(.*)$/);
    if (m && !process.env[m[1].trim()]) {
      process.env[m[1].trim()] = m[2].trim();
    }
  }
}

function getRequiredEnv(name: string): string {
  loadCodeLensEnv();
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Missing required environment variable: ${name}. Run "codelens" to set up, or add it to ~/.codelens/.env`
    );
  }
  return value;
}

export function getGoogleApiKey(): string {
  return getRequiredEnv("GOOGLE_API_KEY");
}

export function getQdrantConfig() {
  return {
    url: getRequiredEnv("QDRANT_URL"),
    apiKey: getRequiredEnv("QDRANT_API_KEY"),
  };
}

export function getGithubToken(): string | undefined {
  loadCodeLensEnv();
  return process.env.GITHUB_TOKEN || undefined;
}

export function getGeminiModel(): string {
  loadCodeLensEnv();
  return process.env.GEMINI_MODEL || "gemini-2.5-flash-lite";
}

export function getHfToken(): string | undefined {
  loadCodeLensEnv();
  return process.env.HF_TOKEN || undefined;
}
