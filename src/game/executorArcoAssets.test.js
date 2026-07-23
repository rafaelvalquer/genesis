import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { describe, expect, it } from "vitest";

const STATES = ["idle", "attack1", "attack2", "attack3", "attackRanged"];
const ASSET_ROOT = path.join(process.cwd(), "src", "game", "assets", "troop", "executorArco");
const SHEET_ROOT = path.join(process.cwd(), "art", "spritesheets", "executorArco");
const EFFECT_ROOT = path.join(process.cwd(), "src", "game", "assets", "effects", "executorArcSlash");

async function opaqueBounds(framePath) {
  const { data, info } = await sharp(framePath).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let left = info.width;
  let top = info.height;
  let right = -1;
  let bottom = -1;
  for (let y = 0; y < info.height; y += 1) {
    for (let x = 0; x < info.width; x += 1) {
      if (data[(y * info.width + x) * 4 + 3] < 24) continue;
      left = Math.min(left, x);
      top = Math.min(top, y);
      right = Math.max(right, x);
      bottom = Math.max(bottom, y);
    }
  }
  return { left, top, right, bottom };
}

async function supportPoint(framePath) {
  const { data, info } = await sharp(framePath).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const bounds = await opaqueBounds(framePath);
  const supportTop = Math.max(
    bounds.top,
    bounds.bottom + 1 - Math.max(12, Math.round((bounds.bottom + 1 - bounds.top) * 0.09)),
  );
  let weightedX = 0;
  let totalWeight = 0;
  for (let y = supportTop; y <= bounds.bottom; y += 1) {
    for (let x = bounds.left; x <= bounds.right; x += 1) {
      const alpha = data[(y * info.width + x) * 4 + 3];
      if (alpha < 24) continue;
      weightedX += x * alpha;
      totalWeight += alpha;
    }
  }
  return { x: weightedX / totalWeight, y: bounds.bottom };
}

describe("assets do Vórtice", () => {
  it("mantém quatro folhas 4x2 e oito frames transparentes por estado", async () => {
    for (const state of STATES) {
      const sheet = await sharp(path.join(SHEET_ROOT, `executor-arco-${state}.png`)).metadata();
      expect(sheet).toMatchObject({ width: 1774, height: 887, hasAlpha: true });
      const files = (await fs.readdir(path.join(ASSET_ROOT, state)))
        .filter((filename) => /^frame\d+\.png$/.test(filename));
      expect(files).toHaveLength(8);
    }
  });

  it("mantém 256x256, alpha, cantos livres, apoio estável e orçamento controlado", async () => {
    let totalBytes = 0;
    for (const state of STATES) {
      const bottoms = [];
      for (let frame = 0; frame < 8; frame += 1) {
        const framePath = path.join(ASSET_ROOT, state, `frame${frame}.png`);
        const metadata = await sharp(framePath).metadata();
        expect(metadata).toMatchObject({ width: 256, height: 256, hasAlpha: true, isPalette: true });
        const bounds = await opaqueBounds(framePath);
        expect(bounds.left).toBeGreaterThanOrEqual(0);
        expect(bounds.right).toBeLessThanOrEqual(255);
        bottoms.push(bounds.bottom);
        const { data, info } = await sharp(framePath).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
        for (const [x, y] of [[0, 0], [info.width - 1, 0], [0, info.height - 1], [info.width - 1, info.height - 1]]) {
          expect(data[(y * info.width + x) * 4 + 3]).toBe(0);
        }
        totalBytes += (await fs.stat(framePath)).size;
      }
      expect(Math.max(...bottoms) - Math.min(...bottoms)).toBeLessThanOrEqual(40);
    }
    expect(totalBytes).toBeLessThanOrEqual(900_000);
  }, 10_000);

  it("mantém o idle ancorado nos pés sem deslocamento entre frames", async () => {
    const supports = await Promise.all(
      Array.from(
        { length: 8 },
        (_, frame) => supportPoint(path.join(ASSET_ROOT, "idle", `frame${frame}.png`)),
      ),
    );
    const xs = supports.map(({ x }) => x);
    const ys = supports.map(({ y }) => y);
    expect(Math.max(...xs) - Math.min(...xs)).toBeLessThanOrEqual(2);
    expect(Math.max(...ys) - Math.min(...ys)).toBeLessThanOrEqual(1);
  });

  it("inclui oito frames de voo e seis de impacto compactos e transparentes", async () => {
    for (const [state, count, width, height] of [
      ["flying", 8, 96, 48],
      ["impact", 6, 64, 64],
    ]) {
      const files = (await fs.readdir(path.join(EFFECT_ROOT, state)))
        .filter((filename) => /^frame\d+\.png$/.test(filename));
      expect(files).toHaveLength(count);
      for (let frame = 0; frame < count; frame += 1) {
        const framePath = path.join(EFFECT_ROOT, state, `frame${frame}.png`);
        const metadata = await sharp(framePath).metadata();
        expect(metadata).toMatchObject({ width, height, hasAlpha: true, isPalette: true });
        const { data, info } = await sharp(framePath).ensureAlpha().raw()
          .toBuffer({ resolveWithObject: true });
        for (const [x, y] of [[0, 0], [info.width - 1, 0], [0, info.height - 1], [info.width - 1, info.height - 1]]) {
          expect(data[(y * info.width + x) * 4 + 3]).toBe(0);
        }
      }
    }
  });
});
