import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const [,, ...args] = process.argv;
const types = ["fragile", "ferrivore", "mineralized", "spores"];
const stages = ["hp100", "hp75", "hp50", "hp25", "hp0"];
if (args.length !== types.length) throw new Error(`Expected four atlas paths, received ${args.length}.`);
const outputRoot = path.resolve("src/game/assets/chapter07/trees");

for (let index = 0; index < types.length; index += 1) {
  const metadata = await sharp(args[index]).metadata();
  const raw = await sharp(args[index]).ensureAlpha().raw().toBuffer();
  const emptyColumns = [];
  for (let x = 0; x < metadata.width; x += 1) {
    let visible = false;
    for (let y = 0; y < metadata.height; y += 1) {
      if (raw[(y * metadata.width + x) * 4 + 3] > 8) { visible = true; break; }
    }
    if (!visible) emptyColumns.push(x);
  }
  const cuts = [0];
  for (let stageIndex = 1; stageIndex < stages.length; stageIndex += 1) {
    const expected = Math.floor(metadata.width * stageIndex / stages.length);
    const candidates = emptyColumns.filter((column) => Math.abs(column - expected) <= Math.max(24, metadata.width / 12));
    cuts.push(candidates.length ? candidates.sort((a, b) => Math.abs(a - expected) - Math.abs(b - expected))[0] : expected);
  }
  cuts.push(metadata.width);
  if (cuts.some((cut, cutIndex) => cutIndex > 0 && cut <= cuts[cutIndex - 1])) {
    cuts.splice(0, cuts.length, ...Array.from({ length: stages.length + 1 }, (_, cutIndex) => Math.floor(metadata.width * cutIndex / stages.length)));
  }
  for (let stageIndex = 0; stageIndex < stages.length; stageIndex += 1) {
    const left = cuts[stageIndex];
    const width = cuts[stageIndex + 1] - left;
    const output = path.join(outputRoot, types[index], `${stages[stageIndex]}.png`);
    await fs.mkdir(path.dirname(output), { recursive: true });
    await sharp(args[index])
      .extract({ left, top: 0, width, height: metadata.height })
      .resize(256, 256, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .ensureAlpha()
      .png()
      .toFile(output);
  }
}
console.log(`Imported ${types.length * stages.length} final forest obstacle sprites.`);
