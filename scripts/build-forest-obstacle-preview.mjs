import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const root = path.resolve("src/game/assets/chapter07/trees");
const types = ["fragile", "ferrivore", "mineralized", "spores"];
const labels = ["Fragile", "Ferrivore", "Mineralized", "Spores"];
const stages = ["hp100", "hp75", "hp50", "hp25", "hp0"];
const cell = 256;
const header = 48;
const row = header + cell;
const width = cell * stages.length;
const height = row * types.length;
const composites = [];
const svg = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg"><style>text{font: bold 18px sans-serif;fill:#d7f9e9} .label{font-size:16px;fill:#8ce0bb}</style><rect width="100%" height="100%" fill="#10201c"/>${stages.map((stage, i) => `<text x="${i * cell + 92}" y="24">${stage.replace("hp", "")} %</text>`).join("")}${labels.map((label, i) => `<text class="label" x="8" y="${i * row + 30}">${label}</text>`).join("")}<text x="8" y="${height - 8}" class="label">Forest obstacle sprite review</text></svg>`;
composites.push({ input: Buffer.from(svg), left: 0, top: 0 });
for (let y = 0; y < types.length; y += 1) for (let x = 0; x < stages.length; x += 1) {
  const input = path.join(root, types[y], `${stages[x]}.png`);
  composites.push({ input, left: x * cell, top: y * row + header });
}
await sharp({ create: { width, height, channels: 4, background: { r: 16, g: 32, b: 28, alpha: 1 } } })
  .composite(composites)
  .png()
  .toFile(path.resolve("forest-obstacles-preview.png"));
console.log("Wrote forest-obstacles-preview.png");
