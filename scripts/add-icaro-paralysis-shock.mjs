import fs from "node:fs/promises";
import sharp from "sharp";

const directories = ["art/sprites/interceptadorIcaro/paralyzed", "src/game/assets/troop/interceptadorIcaro/paralyzed"];
const arcs = [["40,130 60,115 72,135 89,110", "275,115 294,132 310,111"], ["72,185 91,166 105,188", "250,207 271,187 291,213"], ["50,245 68,228 85,252", "286,153 304,170 321,149"], ["74,114 96,94 112,123", "247,248 267,226 289,255"], ["42,202 62,181 82,210", "287,106 306,126 324,101"], ["68,278 88,254 107,282", "245,166 267,145 288,175"], ["42,146 64,128 80,152", "285,225 304,202 324,230"], ["69,205 90,185 107,214", "250,118 270,137 290,112"]];
for (let frame = 0; frame < 8; frame += 1) for (const dir of directories) {
  const file = `${dir}/frame${frame}.png`;
  const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  for (let i = 0; i < info.width * info.height; i += 1) { const p = i * info.channels; if (data[p] > 238 && data[p + 1] > 238 && data[p + 2] > 238 && Math.max(data[p], data[p + 1], data[p + 2]) - Math.min(data[p], data[p + 1], data[p + 2]) < 12) data[p + 3] = 0; }
  const lines = arcs[frame].map((points, i) => `<polyline points="${points}" stroke="#22d3ee" stroke-width="${i ? 3 : 4}"/><polyline points="${points}" stroke="#efffff" stroke-width="1.2"/>`).join("");
  const svg = Buffer.from(`<svg width="384" height="384" xmlns="http://www.w3.org/2000/svg"><g fill="none" stroke-linecap="round" stroke-linejoin="round">${lines}</g></svg>`);
  await sharp(data, { raw: info }).composite([{ input: svg }]).png({ compressionLevel: 9, effort: 10 }).toFile(file);
}
