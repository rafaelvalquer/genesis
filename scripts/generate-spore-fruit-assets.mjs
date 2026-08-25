import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import sharp from "sharp";

const output = join(process.cwd(), "src", "game", "assets", "effects", "sporeFruit", "flying");
await mkdir(output, { recursive: true });

for (let frame = 0; frame < 8; frame += 1) {
  const pulse = 1 + Math.sin(frame * Math.PI / 4) * .06;
  const tilt = -8 + frame * 2.3;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 128 128">
    <defs>
      <radialGradient id="fruit" cx="34%" cy="25%" r="78%"><stop offset="0" stop-color="#FFD27A"/><stop offset=".38" stop-color="#F6B84A"/><stop offset="1" stop-color="#9F431F"/></radialGradient>
      <filter id="soft"><feGaussianBlur stdDeviation="2.2"/></filter>
    </defs>
    <g transform="translate(64 66) rotate(${tilt}) scale(${pulse})">
      <ellipse cx="0" cy="2" rx="35" ry="39" fill="#F59E42" opacity=".2" filter="url(#soft)"/>
      <path d="M0-38 C-18-47-35-31-33-8 C-31 16-19 36 0 41 C19 36 31 16 33-8 C35-31 18-47 0-38Z" fill="url(#fruit)" stroke="#9F431F" stroke-width="4"/>
      <path d="M-22-16 C-13-28-6-30 0-29 C8-29 16-25 23-14" fill="none" stroke="#FFD27A" stroke-width="4" opacity=".85" stroke-linecap="round"/>
      <circle cx="-15" cy="3" r="4" fill="#E86F2A"/><circle cx="12" cy="-7" r="3.5" fill="#9F431F"/><circle cx="5" cy="19" r="4" fill="#FFD27A"/><circle cx="-8" cy="25" r="2.8" fill="#E86F2A"/>
      <path d="M-4-39 C-7-49 0-55 8-54 C13-54 16-51 18-47" fill="none" stroke="#9F431F" stroke-width="6" stroke-linecap="round"/>
      <path d="M-17-23 C-12-28-8-30-3-30" fill="none" stroke="#FFF0B0" stroke-width="3" stroke-linecap="round" opacity=".9"/>
    </g>
  </svg>`;
  await sharp(Buffer.from(svg)).png().toFile(join(output, `frame${frame}.png`));
}
