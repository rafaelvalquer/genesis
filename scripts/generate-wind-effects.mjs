import { mkdirSync } from "node:fs";
import { join } from "node:path";
import sharp from "sharp";

const root = join(process.cwd(), "src", "game", "assets", "effects", "windCurrent");
const states = {
  dustDebris: ["#cbd5e1", "#94a3b8"],
  rockDebris: ["#64748b", "#334155"],
  emergencyReturn: ["#a5f3fc", "#c4b5fd"],
};

for (const [state, colors] of Object.entries(states)) {
  const directory = join(root, state);
  mkdirSync(directory, { recursive: true });
  for (let frame = 0; frame < 4; frame += 1) {
    const rotation = frame * 24;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 96 96">
      <defs><filter id="g"><feGaussianBlur stdDeviation="${state === "emergencyReturn" ? 2 : 0.7}"/></filter></defs>
      <g transform="rotate(${rotation} 48 48)" filter="url(#g)">
        ${state === "emergencyReturn"
          ? `<ellipse cx="48" cy="58" rx="${24 + frame * 3}" ry="${8 + frame}" fill="none" stroke="${colors[0]}" stroke-width="4" opacity=".78"/>
             <ellipse cx="48" cy="58" rx="${12 + frame * 2}" ry="${4 + frame}" fill="none" stroke="${colors[1]}" stroke-width="2" opacity=".9"/>`
          : `<path d="M22 54l11-12 9 8 12-17 18 23-14 8-16-4-13 8z" fill="${colors[0]}" opacity=".72"/>
             <circle cx="${28 + frame * 5}" cy="${35 + frame * 3}" r="${4 + frame}" fill="${colors[1]}" opacity=".62"/>`}
      </g>
    </svg>`;
    await sharp(Buffer.from(svg)).png().toFile(join(directory, `frame${frame}.png`));
  }
}
console.log(`Generated wind effect accents in ${root}`);
