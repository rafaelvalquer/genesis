import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const sourceRoot = path.resolve("src/game/assets-source/enemy/colossoCaldeira");
const sheets = {
  spawnAwakening: [12, 4, 3], idle: [8, 4, 2], riftTelegraph: [6, 3, 2], riftAttack: [6, 3, 2],
  slamTelegraph: [6, 3, 2], slamAttack: [8, 4, 2], fractureTelegraph: [8, 4, 2], fractureAttack: [8, 4, 2],
  seismicTelegraph: [8, 4, 2], seismicAttack: [8, 4, 2], phaseTransition2: [10, 5, 2], phaseTransition3: [10, 5, 2],
  finalCollapse: [12, 4, 3], coreExposed: [8, 4, 2], death: [14, 4, 4],
};

for (const [state, [frames, columns, rows]] of Object.entries(sheets)) {
  const folder = path.join(sourceRoot, state);
  const sheet = path.join(folder, "sheet.png");
  const { width, height } = await sharp(sheet).metadata();
  if (!width || !height) throw new Error(`Invalid source sheet: ${sheet}`);
  const cellWidth = Math.floor(width / columns);
  const cellHeight = Math.floor(height / rows);
  for (let index = 0; index < frames; index += 1) {
    const left = (index % columns) * cellWidth;
    const top = Math.floor(index / columns) * cellHeight;
    await sharp(sheet).extract({ left, top, width: cellWidth, height: cellHeight })
      .png({ compressionLevel: 9 }).toFile(path.join(folder, `frame${index}.png`));
  }
}
console.log("Sliced authored Colosso pose sheets into source frames.");
