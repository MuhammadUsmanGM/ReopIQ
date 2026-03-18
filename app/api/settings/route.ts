import { existsSync, readFileSync, writeFileSync, mkdirSync } from "fs";
import { join } from "path";
import { homedir } from "os";

export const dynamic = "force-dynamic";

const CODELENS_DIR = join(homedir(), ".codelens");
const ENV_FILE = join(CODELENS_DIR, ".env");

function loadEnv(): Record<string, string> {
  if (!existsSync(ENV_FILE)) return {};
  const env: Record<string, string> = {};
  for (const line of readFileSync(ENV_FILE, "utf-8").split("\n")) {
    const m = line.match(/^([^#=]+)=(.*)$/);
    if (m) env[m[1].trim()] = m[2].trim();
  }
  return env;
}

function saveEnv(env: Record<string, string>) {
  mkdirSync(CODELENS_DIR, { recursive: true });
  const content = Object.entries(env)
    .filter(([, v]) => v)
    .map(([k, v]) => `${k}=${v}`)
    .join("\n");
  writeFileSync(ENV_FILE, content + "\n");

  // Also update process.env so changes take effect immediately
  for (const [k, v] of Object.entries(env)) {
    if (v) process.env[k] = v;
  }
}

/** GET — return current keys (masked) */
export async function GET() {
  const env = loadEnv();
  // Also check process.env for keys set via .env file
  const keys = ["GOOGLE_API_KEY", "QDRANT_URL", "QDRANT_API_KEY", "GITHUB_TOKEN", "GEMINI_MODEL", "HF_TOKEN"];
  const result: Record<string, { set: boolean; masked: string; value?: string }> = {};

  for (const key of keys) {
    const value = env[key] || process.env[key] || "";
    result[key] = {
      set: !!value,
      masked: value ? value.slice(0, 4) + "•".repeat(Math.max(0, value.length - 8)) + value.slice(-4) : "",
    };
  }

  // Handle non-masked model selection
  const model = env["GEMINI_MODEL"] || process.env["GEMINI_MODEL"] || "gemini-2.5-flash-lite";
  result["GEMINI_MODEL"] = { set: true, masked: model, value: model };

  return Response.json(result);
}

/** POST — save keys */
export async function POST(req: Request) {
  const body = await req.json();
  const env = loadEnv();

  const ALLOWED_KEYS = ["GOOGLE_API_KEY", "QDRANT_URL", "QDRANT_API_KEY", "GITHUB_TOKEN", "GEMINI_MODEL"];
  for (const key of ALLOWED_KEYS) {
    if (body[key] !== undefined && body[key] !== "") {
      env[key] = body[key];
    }
  }

  saveEnv(env);
  return Response.json({ status: "saved" });
}
