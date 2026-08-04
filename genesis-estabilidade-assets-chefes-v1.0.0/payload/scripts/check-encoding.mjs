#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(process.argv[2] || process.cwd());
const badPattern = new RegExp(["\\u00C3", "\\u00C2", "\\uFFFD"].join("|"), "u");
const extensions = new Set([
  ".js", ".jsx", ".mjs", ".cjs", ".ts", ".tsx",
  ".json", ".md", ".html", ".css", ".scss", ".ps1",
  ".py", ".txt", ".yml", ".yaml",
]);
const ignoredDirectories = new Set([
  ".git", ".genesis-backups", "node_modules", "dist", ".vite",
  "coverage", "art", "assets",
]);
const rootFiles = [
  ".editorconfig", ".gitattributes", "README.md", "CHANGELOG.md",
];
const scanRoots = ["src", "scripts", "tools", "docs"];

function collectFiles(directory, destination) {
  if (!fs.existsSync(directory)) return;
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      if (!ignoredDirectories.has(entry.name)) collectFiles(fullPath, destination);
      continue;
    }
    if (extensions.has(path.extname(entry.name).toLowerCase())) destination.push(fullPath);
  }
}

const files = [];
for (const relativeRoot of scanRoots) collectFiles(path.join(repoRoot, relativeRoot), files);
for (const relativePath of rootFiles) {
  const fullPath = path.join(repoRoot, relativePath);
  if (fs.existsSync(fullPath)) files.push(fullPath);
}

const findings = [];
for (const filePath of files) {
  const source = fs.readFileSync(filePath, "utf8");
  source.split(/\r?\n/).forEach((line, index) => {
    if (!badPattern.test(line)) return;
    const column = Math.max(1, line.search(badPattern) + 1);
    findings.push({
      file: path.relative(repoRoot, filePath).replaceAll(path.sep, "/"),
      line: index + 1,
      column,
      excerpt: line.trim().slice(0, 180),
    });
  });
}

if (findings.length) {
  console.error(`Foram encontrados ${findings.length} indício(s) de codificação corrompida:`);
  findings.forEach((finding) => {
    console.error(`- ${finding.file}:${finding.line}:${finding.column} ${finding.excerpt}`);
  });
  process.exitCode = 1;
} else {
  console.log(`Codificação UTF-8 validada em ${files.length} arquivo(s) de código e documentação.`);
}
