import { existsSync, readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { describe, expect, it } from "vitest";

const assetPath = (relative) => fileURLToPath(new URL(relative, import.meta.url));
const states = [
  "idle", "moveLand", "moveWater", "sprintWater",
  "attackBite", "death", "spawnEmerge",
];

describe("assets do Mordelume", () => {
  it("declara sete animações de oito frames", () => {
    const manifest = JSON.parse(readFileSync(assetPath("./assets/enemy/mordelume/mordelume.json"), "utf8"));
    expect(manifest).toMatchObject({ id: "mordelume", frameWidth: 256, frameHeight: 256, direction: "left" });
    expect(Object.keys(manifest.animations)).toEqual(states);
    for (const state of states) expect(manifest.animations[state].frames).toBe(8);
  });

  it.each(states)("entrega oito frames PNG transparentes para %s", async (state) => {
    for (let frame = 0; frame < 8; frame += 1) {
      const path = assetPath(`./assets/enemy/mordelume/${state}/frame${frame}.png`);
      expect(existsSync(path)).toBe(true);
      const image = sharp(path).ensureAlpha();
      const metadata = await image.metadata();
      expect(metadata).toMatchObject({ width: 256, height: 256, format: "png", hasAlpha: true });
      const { data, info } = await image.raw().toBuffer({ resolveWithObject: true });
      const safetyBorder = [];
      for (let y = 0; y < info.height; y += 1) for (let x = 0; x < info.width; x += 1) {
        if (x < 4 || y < 4 || x >= info.width - 4 || y >= info.height - 4) safetyBorder.push(y * info.width + x);
      }
      expect(safetyBorder.every((pixel) => data[pixel * info.channels + 3] < 8)).toBe(true);
      expect(data.some((_, index) => index % info.channels === 3 && data[index] > 240)).toBe(true);
    }
  });

  it("mantém nado e sprint aquáticos distintos da caminhada terrestre", () => {
    const digest = (state) => createHash("sha256")
      .update(readFileSync(assetPath(`./assets/enemy/mordelume/${state}/frame0.png`))).digest("hex");
    expect(digest("moveWater")).not.toBe(digest("moveLand"));
    expect(digest("sprintWater")).not.toBe(digest("moveLand"));
    expect(digest("sprintWater")).not.toBe(digest("moveWater"));
  });

  it("usa oito poses exclusivas em cada estado e não reutiliza o primeiro frame entre estados", () => {
    const digest = (state, frame) => createHash("sha256")
      .update(readFileSync(assetPath(`./assets/enemy/mordelume/${state}/frame${frame}.png`))).digest("hex");
    for (const state of states) {
      expect(new Set(Array.from({ length: 8 }, (_, frame) => digest(state, frame))).size).toBe(8);
    }
    expect(new Set(states.map((state) => digest(state, 0))).size).toBe(states.length);
  });
});
