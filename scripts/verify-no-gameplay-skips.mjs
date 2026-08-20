import fs from "node:fs";
import path from "node:path";

const root = path.resolve("src/game");
const offenders = [];

function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(file);
    else if (/\.(?:test|spec)\.[cm]?[jt]sx?$/.test(entry.name) || /\.test\.[cm]?[jt]sx?$/.test(entry.name)) {
      const lines = fs.readFileSync(file, "utf8").split(/\r?\n/);
      lines.forEach((line, index) => {
        if (/\b(?:it|test|describe)\.(?:skip|todo)\s*\(/.test(line)) offenders.push(`${file}:${index + 1}`);
      });
    }
  }
}

walk(root);
if (offenders.length) {
  console.error(`Gameplay tests disabled: ${offenders.join(", ")}`);
  process.exit(1);
}
console.log("No skipped or todo gameplay tests found.");
