#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

function parseArgs(argv = process.argv.slice(2)) {
  const args = {};
  for (const argument of argv) {
    if (!argument.startsWith("--")) continue;
    const separator = argument.indexOf("=");
    if (separator < 0) args[argument.slice(2)] = true;
    else args[argument.slice(2, separator)] = argument.slice(separator + 1);
  }
  return args;
}

const args = parseArgs();
const manifestPath = path.resolve(args.manifest || "");
if (!args.manifest || !fs.existsSync(manifestPath)) {
  console.error("Informe um manifesto válido com --manifest=<caminho>. ");
  process.exit(1);
}

const backupRoot = path.dirname(manifestPath);
const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
const repoRoot = path.resolve(manifest.repoRoot);

for (const entry of [...manifest.files].reverse()) {
  const target = path.join(repoRoot, entry.path);
  if (entry.existed) {
    const backup = path.join(backupRoot, entry.backupPath);
    if (!fs.existsSync(backup)) throw new Error(`Backup ausente: ${backup}`);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.copyFileSync(backup, target);
    console.log(`RESTAURADO: ${entry.path}`);
  } else if (fs.existsSync(target)) {
    fs.rmSync(target, { force: true });
    console.log(`REMOVIDO: ${entry.path}`);
  }
}

console.log("Restauração concluída.");
