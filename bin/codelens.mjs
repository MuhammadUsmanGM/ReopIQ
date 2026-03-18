#!/usr/bin/env node

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";
import { homedir } from "os";
import { createInterface } from "readline";
import { execSync, spawn } from "child_process";
import { fileURLToPath } from "url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const PKG_ROOT = join(__dirname, "..");
const CODELENS_DIR = join(homedir(), ".codelens");
const ENV_FILE = join(CODELENS_DIR, ".env");

const REQUIRED_VARS = [
  { key: "GOOGLE_API_KEY", label: "Google Gemini API Key" },
  { key: "QDRANT_URL", label: "Qdrant URL (e.g. https://xxx.cloud.qdrant.io:6333)" },
  { key: "QDRANT_API_KEY", label: "Qdrant API Key" },
];

// --- Env loading ---

function loadEnvFile() {
  if (!existsSync(ENV_FILE)) return {};
  const env = {};
  for (const line of readFileSync(ENV_FILE, "utf-8").split("\n")) {
    const m = line.match(/^([^#=]+)=(.*)$/);
    if (m) env[m[1].trim()] = m[2].trim();
  }
  return env;
}

function prompt(rl, question) {
  return new Promise((resolve) => rl.question(question, resolve));
}

// --- Setup wizard ---

async function ensureEnv() {
  const existing = loadEnvFile();

  // Inject existing into process.env
  for (const [k, v] of Object.entries(existing)) {
    if (!process.env[k]) process.env[k] = v;
  }

  const missing = REQUIRED_VARS.filter(
    ({ key }) => !process.env[key]
  );

  if (missing.length === 0) return;

  console.log("\n  ╔══════════════════════════════════════╗");
  console.log("  ║       CodeLens — First Run Setup     ║");
  console.log("  ╚══════════════════════════════════════╝");
  console.log("  You can also configure these later via the Settings icon in the UI.\n");

  const rl = createInterface({ input: process.stdin, output: process.stdout });

  for (const { key, label } of missing) {
    const value = await prompt(rl, `  ${label}: `);
    if (!value.trim()) {
      console.log(`\n  Error: ${key} is required. Exiting.\n`);
      process.exit(1);
    }
    existing[key] = value.trim();
    process.env[key] = value.trim();
  }

  // Optional: GITHUB_TOKEN
  if (!existing.GITHUB_TOKEN && !process.env.GITHUB_TOKEN) {
    const gh = await prompt(rl, "  GitHub Token (optional, Enter to skip): ");
    if (gh.trim()) {
      existing.GITHUB_TOKEN = gh.trim();
      process.env.GITHUB_TOKEN = gh.trim();
    }
  }

  rl.close();

  // Save
  mkdirSync(CODELENS_DIR, { recursive: true });
  const content = Object.entries(existing)
    .map(([k, v]) => `${k}=${v}`)
    .join("\n");
  writeFileSync(ENV_FILE, content + "\n");
  console.log(`\n  Config saved to ${ENV_FILE}\n`);
}

// --- Build if needed ---

function ensureBuild() {
  const dotNext = join(PKG_ROOT, ".next");
  if (!existsSync(dotNext)) {
    console.log("  Building CodeLens (first run, this may take a minute)...\n");
    execSync("npx next build", { cwd: PKG_ROOT, stdio: "inherit" });
    console.log("");
  }
}

// --- Open browser ---

function openBrowser(url) {
  try {
    const cmd =
      process.platform === "win32"
        ? `start "" "${url}"`
        : process.platform === "darwin"
          ? `open "${url}"`
          : `xdg-open "${url}"`;
    execSync(cmd, { shell: true, stdio: "ignore" });
  } catch {
    // Silently fail — user can open manually
  }
}

// --- Main ---

async function main() {
  await ensureEnv();
  ensureBuild();

  const port = process.env.PORT || 3000;

  console.log("  ╔══════════════════════════════════════╗");
  console.log(`  ║  CodeLens running → http://localhost:${port}  ║`);
  console.log("  ╚══════════════════════════════════════╝");
  console.log("\n  Press Ctrl+C to stop.\n");

  const server = spawn("npx", ["next", "start", "-p", String(port)], {
    cwd: PKG_ROOT,
    stdio: "inherit",
    shell: true,
    env: { ...process.env },
  });

  setTimeout(() => openBrowser(`http://localhost:${port}`), 2500);

  server.on("close", (code) => process.exit(code ?? 0));

  // Handle Ctrl+C gracefully
  process.on("SIGINT", () => {
    console.log("\n  Shutting down CodeLens...\n");
    server.kill("SIGINT");
  });
}

main().catch((err) => {
  console.error(`\n  Error: ${err.message}\n`);
  process.exit(1);
});
