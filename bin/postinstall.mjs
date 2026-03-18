#!/usr/bin/env node
import chalk from "chalk";

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

console.log(chalk.cyan("  ╔══════════════════════════════════════╗"));
console.log(chalk.cyan("  ║    CODE-LENS SUCCESSFULLY LINKED     ║"));
console.log(chalk.cyan("  ╚══════════════════════════════════════╝\n"));

console.log(chalk.white("  Launch your architectural autopilot:"));
console.log(chalk.bold.hex("#FFB300")("\n  ➜ lens\n"));

console.log(chalk.dim("  ────────────────────────────────────────"));
