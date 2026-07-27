import { createHash } from "node:crypto";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { ENEMY_FRAME_ANCHORS } from "./enemyAnchors.generated.js";

const ROOT = join(process.cwd(), "src", "game", "assets", "enemy", "derivante");
const STATES = [
  "idle", "walking", "attack", "jumpPrepare", "jumpTakeoff",
  "jumping", "landing", "windGlide", "stunned", "death",
];

describe("assets do Derivante", () => {
  it.each(STATES)("%s possui oito quadros RGBA 320x256 distintos, transparentes e compactos", async (state) => {
    const directory = join(ROOT, state);
    const allPngs = readdirSync(directory).filter((file) => file.endsWith(".png"));
    const files = allPngs
      .filter((file) => /^frame[0-7]\.png$/.test(file))
      .sort((left, right) => Number(left.match(/\d+/)[0]) - Number(right.match(/\d+/)[0]));

    expect(allPngs).toHaveLength(8);
    expect(files).toHaveLength(8);
    const hashes = new Set();
    for (const file of files) {
      const filePath = join(directory, file);
      const buffer = readFileSync(filePath);
      const metadata = await sharp(buffer).metadata();
      const { data, info } = await sharp(buffer).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
      const borderAlpha = [];
      for (let x = 0; x < info.width; x += 1) {
        borderAlpha.push(data[x * 4 + 3]);
        borderAlpha.push(data[((info.height - 1) * info.width + x) * 4 + 3]);
      }
      for (let y = 0; y < info.height; y += 1) {
        borderAlpha.push(data[(y * info.width) * 4 + 3]);
        borderAlpha.push(data[(y * info.width + info.width - 1) * 4 + 3]);
      }

      expect(metadata).toMatchObject({ width: 320, height: 256, channels: 4, hasAlpha: true });
      expect(Math.max(...borderAlpha)).toBe(0);
      expect(statSync(filePath).size).toBeLessThan(700_000);
      hashes.add(createHash("sha256").update(buffer).digest("hex"));
    }
    expect(hashes.size).toBe(8);
  });

  it("nao possui hit nem estados fora do contrato e compartilha ancora terrestre estavel", () => {
    expect(readdirSync(ROOT).sort()).toEqual([...STATES].sort());
    const anchors = ENEMY_FRAME_ANCHORS.derivante;
    const sharedAnchors = new Set();
    STATES.forEach((state) => {
      expect(anchors[state]).toHaveLength(8);
      expect(new Set(anchors[state].map((anchor) => `${anchor.x}:${anchor.y}`)).size).toBe(1);
      sharedAnchors.add(`${anchors[state][0].x}:${anchors[state][0].y}`);
      expect(anchors[state][0].x).toBeGreaterThan(0.35);
      expect(anchors[state][0].x).toBeLessThan(0.65);
      expect(anchors[state][0].y).toBeGreaterThan(0.7);
      expect(anchors[state][0].y).toBeLessThan(0.98);
    });
    expect(sharedAnchors.size).toBe(1);
  });
});
