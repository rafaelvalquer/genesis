import fs from "node:fs";
import path from "node:path";

const repoRoot = path.resolve(process.argv[2] || process.cwd());
const backupDir = path.resolve(process.argv[3] || "");
if (!backupDir || !fs.existsSync(backupDir)) throw new Error("Backup não encontrado.");
const manifestPath = path.join(backupDir, "manifest.json");
const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
for (const entry of manifest) {
  const target = path.join(repoRoot, entry.path);
  const backup = path.join(backupDir, entry.path);
  if (entry.existed) {
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.copyFileSync(backup, target);
  } else if (fs.existsSync(target)) {
    fs.rmSync(target, { force: true });
  }
}
console.log("Restauração concluída.");
