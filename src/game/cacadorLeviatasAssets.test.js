import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { describe, expect, it } from "vitest";

const states = ["idle", "charging", "attack", "cooldown"];
const assetRoot = path.join(
  process.cwd(),
  "src",
  "game",
  "assets",
  "troop",
  "cacadorLeviatas",
);

function edgeAlpha(data, width, height, channels) {
  const values = [];
  for (let x = 0; x < width; x += 1) {
    values.push(data[x * channels + 3]);
    values.push(data[((height - 1) * width + x) * channels + 3]);
  }
  for (let y = 0; y < height; y += 1) {
    values.push(data[(y * width) * channels + 3]);
    values.push(data[(y * width + width - 1) * channels + 3]);
  }
  return values;
}

function significantComponents(data, width, height, channels, opaqueCount) {
  const visited = new Uint8Array(width * height);
  const threshold = Math.max(250, Math.round(opaqueCount * 0.025));
  let significant = 0;
  for (let start = 0; start < width * height; start += 1) {
    if (visited[start] || data[start * channels + 3] <= 32) continue;
    let size = 0;
    const stack = [start];
    visited[start] = 1;
    while (stack.length) {
      const index = stack.pop();
      size += 1;
      const x = index % width;
      const y = Math.floor(index / width);
      for (let dy = -1; dy <= 1; dy += 1) {
        for (let dx = -1; dx <= 1; dx += 1) {
          if (dx === 0 && dy === 0) continue;
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
          const neighbor = ny * width + nx;
          if (visited[neighbor] || data[neighbor * channels + 3] <= 32) continue;
          visited[neighbor] = 1;
          stack.push(neighbor);
        }
      }
    }
    if (size >= threshold) significant += 1;
  }
  return significant;
}

describe("assets do Caçador de Leviatãs", () => {
  it.each(states)("possui oito quadros PNG no estado %s", (state) => {
    const directory = path.join(assetRoot, state);
    const frames = fs.readdirSync(directory)
      .filter((name) => /^frame[0-7]\.png$/.test(name))
      .sort();
    expect(frames).toHaveLength(8);
  });

  it("mantém os 32 quadros em 512x512 RGBA, transparentes e sem chroma residual", async () => {
    const hashes = new Set();
    for (const state of states) {
      for (let frame = 0; frame < 8; frame += 1) {
        const file = path.join(assetRoot, state, `frame${frame}.png`);
        const image = sharp(file).ensureAlpha();
        const { data, info } = await image.raw().toBuffer({ resolveWithObject: true });
        expect(info.width, file).toBe(512);
        expect(info.height, file).toBe(512);
        expect(info.channels, file).toBe(4);
        expect(edgeAlpha(data, info.width, info.height, info.channels).every((alpha) => alpha === 0), file).toBe(true);

        let opaque = 0;
        let magenta = 0;
        for (let offset = 0; offset < data.length; offset += info.channels) {
          const [r, g, b, a] = data.subarray(offset, offset + 4);
          if (a <= 16) continue;
          opaque += 1;
          if (r > 205 && b > 205 && g < 75 && Math.min(r, b) - g > 125) magenta += 1;
        }
        expect(opaque, file).toBeGreaterThan(20_000);
        expect(magenta, file).toBe(0);
        expect(significantComponents(data, info.width, info.height, info.channels, opaque), file).toBe(1);
        hashes.add(`${fs.statSync(file).size}:${data.subarray(0, 4096).toString("base64")}`);
      }
    }
    expect(hashes.size).toBe(32);
  }, 30_000);
});
