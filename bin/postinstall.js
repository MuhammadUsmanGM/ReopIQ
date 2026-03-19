#!/usr/bin/env node
import chalk from "chalk";
import { pipeline } from "@xenova/transformers";

const banner = `
  ██╗     ███████╗███╗   ██╗███████╗
  ██║     ██╔════╝████╗  ██║██╔════╝
  ██║     █████╗  ██╔██╗ ██║███████╗
  ██║     ██╔══╝  ██║╚██╗██║╚════██║
  ███████╗███████╗██║ ╚████║███████║
  ╚══════╝╚══════╝╚═╝  ╚═══╝╚══════╝
`;

console.log(chalk.hex("#FFB300")(banner));
console.log(chalk.bold.hex("#FFB300")("  THE NEURAL BRIDGE BETWEEN DEVELOPER & CODEBASE\n"));

// Pre-download the embedding model so first run is instant
const MODEL = "Xenova/all-mpnet-base-v2";

console.log(chalk.cyan("  Downloading embedding model..."));
console.log(chalk.dim(`  Model: ${MODEL}\n`));

try {
  await pipeline("feature-extraction", MODEL, { quantized: true });

  console.log(chalk.green("  ✓ Embedding model cached successfully.\n"));
} catch (err) {
  // Non-fatal — model will download on first run instead
  console.log(chalk.yellow("  ⚠ Model pre-download failed (will retry on first run)."));
  console.log(chalk.dim(`  ${err.message}\n`));
}

console.log(chalk.cyan("  ╔══════════════════════════════════════╗"));
console.log(chalk.cyan("  ║    CODE-LENS SUCCESSFULLY LINKED     ║"));
console.log(chalk.cyan("  ╚══════════════════════════════════════╝\n"));

console.log(chalk.white("  Launch your architectural autopilot:"));
console.log(chalk.bold.hex("#FFB300")("\n  ➜ codelens\n"));

console.log(chalk.dim("  ────────────────────────────────────────"));
