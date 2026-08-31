import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
const CONVOY_VEHICLE_ID = "trg_dinamo";

const root = process.cwd();
const states = { idle: 8, energy_spawn: 10 };
const issues = [];
let total = 0;
const vehicleDirectories = (await fs.readdir(path.join(root, "src", "game", "assets", "convoy"), { withFileTypes: true }))
  .filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort();
if (JSON.stringify(vehicleDirectories) !== JSON.stringify([CONVOY_VEHICLE_ID])) issues.push(`Expected only ${CONVOY_VEHICLE_ID}, found ${vehicleDirectories.join(", ") || "none"}`);
for (const vehicleId of [CONVOY_VEHICLE_ID]) {
  for (const [state, expected] of Object.entries(states)) {
    const dir = path.join(root, "src", "game", "assets", "convoy", vehicleId, state);
    let files = [];
    try { files = (await fs.readdir(dir)).filter((file) => file.endsWith(".webp")).sort(); } catch { issues.push(`Missing ${dir}`); continue; }
    if (files.length !== expected) issues.push(`${vehicleId}/${state}: expected ${expected}, found ${files.length}`);
    for (let frame = 0; frame < expected; frame += 1) {
      const name = `${vehicleId}_${state}_${String(frame).padStart(2, "0")}.webp`;
      if (!files.includes(name)) { issues.push(`Missing ${vehicleId}/${state}/${name}`); continue; }
      const metadata = await sharp(path.join(dir, name)).metadata();
      if (metadata.width !== 1024 || metadata.height !== 512 || !metadata.hasAlpha) issues.push(`Invalid metadata for ${name}`);
      total += 1;
    }
  }
}
if (issues.length) { console.error(issues.join("\n")); process.exit(1); }
console.log(`Convoy asset validation passed: ${total} WebP frames.`);
