#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import path from "node:path";

const repoRoot = path.resolve(process.argv[2] || process.cwd());
const trackedFiles = execFileSync("git", ["ls-files", "-z"], {
  cwd: repoRoot,
  encoding: "utf8",
}).split("\0").filter(Boolean).map((file) => file.replaceAll("\\", "/"));

const errors = [];
const forbiddenPrefixes = [
  ".codex-tmp/",
  ".genesis-backups/",
  "artifacts/",
];

for (const file of trackedFiles) {
  const prefix = forbiddenPrefixes.find((candidate) => file.startsWith(candidate));
  if (prefix) {
    errors.push(`REPO_TEMP_FILE_TRACKED: ${file} pertence a ${prefix}`);
    continue;
  }
  if (/\.(bak|backup|tmp)$/i.test(file)) {
    errors.push(`REPO_BACKUP_FILE_TRACKED: ${file}`);
    continue;
  }
  if (!file.includes("/") && /(?:preview|audit|comparison).*\.(?:png|jpe?g|webp)$/i.test(file)) {
    errors.push(`REPO_ROOT_QA_IMAGE_TRACKED: ${file} deve ficar em art/qa/ ou docs/images/.`);
  }
}

if (errors.length) {
  console.error(`Repository hygiene failed: ${errors.length} erro(s).`);
  errors.forEach((error) => console.error(`- ${error}`));
  process.exitCode = 1;
} else {
  console.log("Repository hygiene OK: nenhum temporário, backup ou preview avulso está rastreado.");
}
