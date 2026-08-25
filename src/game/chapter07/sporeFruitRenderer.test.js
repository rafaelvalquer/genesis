import { readFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { describe, expect, it, vi } from "vitest";
import {
  drawSporeFruit,
  drawSporeClouds,
  getSporeFruitPosition,
  SPORE_FRUIT_FRAME_MS,
} from "./sporeFruitRenderer.js";

const fruit = { id: "sporeFruit-1", seed: 7, startX: 100, startY: 120, targetX: 300, targetY: 180, startedAt: 1000, impactAt: 2000 };
const context = () => {
  const ctx = {};
  ["save", "restore", "translate", "rotate", "drawImage", "beginPath", "ellipse", "arc", "fill", "stroke"].forEach((method) => { ctx[method] = vi.fn(); });
  return ctx;
};

describe("spore fruit renderer", () => {
  it("follows a deterministic arc from release to impact", () => {
    const start = getSporeFruitPosition(fruit, 1000);
    const middle = getSporeFruitPosition(fruit, 1500);
    const end = getSporeFruitPosition(fruit, 2000);
    expect(start).toMatchObject({ x: 100, y: 120, progress: 0 });
    expect(middle.x).toBe(200);
    expect(middle.y).toBeLessThan(150);
    expect(end).toMatchObject({ x: 300, y: 180, progress: 1 });
  });

  it("selects animated frames approximately every 65ms and remains visible at low quality", () => {
    const ctx = context(); const frames = Array.from({ length: 8 }, (_, index) => ({ index }));
    drawSporeFruit(ctx, fruit, 1110, frames, { quality: "low" });
    expect(ctx.drawImage).toHaveBeenCalledWith(frames[1], -21, -21, 42, 42);
  });

  it("loops the fruit animation throughout a long flight", () => {
    const ctx = context(); const frames = Array.from({ length: 8 }, (_, index) => ({ index }));
    drawSporeFruit(ctx, fruit, fruit.startedAt + SPORE_FRUIT_FRAME_MS * 8, frames, { quality: "low" });
    expect(ctx.drawImage).toHaveBeenCalledWith(frames[0], -21, -21, 42, 42);
    drawSporeFruit(ctx, fruit, fruit.startedAt + SPORE_FRUIT_FRAME_MS * 9, frames, { quality: "low" });
    expect(ctx.drawImage).toHaveBeenLastCalledWith(frames[1], -21, -21, 42, 42);
  });

  it("keeps the sprite in the effect layer contract even when bloom is disabled", () => {
    const ctx = context();
    drawSporeFruit(ctx, fruit, 1300, [{ id: "fruit-frame" }], { quality: "medium", bloom: false });
    expect(ctx.drawImage).toHaveBeenCalledTimes(1);
  });

  it("draws the orange impact cloud without depending on loop state outside the cloud", () => {
    const ctx = context();
    expect(() => drawSporeClouds(ctx, [{ x: 200, y: 140, radius: 100, startedAt: 0, endsAt: 950 }], 250)).not.toThrow();
    expect(ctx.arc).toHaveBeenCalledTimes(8);
  });

  it("ships eight transparent 128px flying frames", async () => {
    for (let frame = 0; frame < 8; frame += 1) {
      const file = path.join(process.cwd(), "src", "game", "assets", "effects", "sporeFruit", "flying", `frame${frame}.png`);
      const metadata = await sharp(await readFile(file)).metadata();
      expect(metadata).toMatchObject({ width: 128, height: 128, hasAlpha: true });
    }
  });
});
