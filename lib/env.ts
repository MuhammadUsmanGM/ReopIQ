// lib/env.ts
import { existsSync, readFileSync } from "fs";
import { join } from "path";
import { homedir } from "os";

/** Load ~/.codelens/.env into process.env.
 * Always re-reads from disk so tokens saved via the Settings UI
 * are picked up without requiring a server restart.
 */
export function loadCodeLensEnv() {
  const envPath = join(homedir(), ".codelens", ".env");
  if (!existsSync(envPath)) return;
  for (const line of readFileSync(envPath, "utf-8").split("\n")) {
    const m = line.match(/^([^#=]+)=(.*)$/);
    // Always overwrite so updates via the Settings UI take effect immediately
    if (m) {
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
