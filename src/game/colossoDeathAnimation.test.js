import fs from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import sharp from "sharp";
import { getColossoAnimation } from "./colossoCaldeira.js";

const deathRoot = path.resolve("src/game/assets/enemy/colossoCaldeira/death");

async function geometry(frame) {
  const { data, info } = await sharp(path.join(deathRoot, `frame${frame}.png`)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let minY = info.height; let maxY = -1; let weightedY = 0; let weight = 0;
  for (let y = 0; y < info.height; y += 1) for (let x = 0; x < info.width; x += 1) {
    const alpha = data[(y * info.width + x) * info.channels + 3];
    if (alpha < 20) continue;
    minY = Math.min(minY, y); maxY = Math.max(maxY, y); weightedY += y * alpha; weight += alpha;
  }
  return { minY, maxY, centerY: weightedY / Math.max(1, weight) };
}

describe("animação de morte do Colosso", () => {
  it("mantém a queda vertical sem saltos para cima", async () => {
    const frames = await Promise.all(Array.from({ length: 14 }, (_, index) => geometry(index)));
    for (let index = 1; index < frames.length; index += 1) {
      expect(frames[index].centerY + 8).toBeGreaterThanOrEqual(frames[index - 1].centerY);
      if (index >= 2) expect(frames[index].minY + 12).toBeGreaterThanOrEqual(frames[index - 1].minY);
    }
  });

  it("não deixa frames vazios e mantém o hold final estável", async () => {
    const files = await fs.readdir(deathRoot);
    expect(files.filter((file) => /^frame\d+\.png$/.test(file))).toHaveLength(14);
    const final = await geometry(13); const penultimate = await geometry(12);
    expect(final.maxY).toBe(penultimate.maxY);
    expect(final.minY).toBe(penultimate.minY);
  });

  it.each(["idle", "slamAttack", "fractureAttack", "seismicAttack", "coreExposed"])(
    "faz a entrada curta de %s para death sem crossfade longo",
    (previousState) => {
      const enemy = {
        colossoState: "death",
        colossoPreviousState: previousState,
        colossoPreviousFrame: 2,
        colossoStateStartedAt: 1000,
        colossoStateEndsAt: 5600,
      };
      const animation = getColossoAnimation(enemy, 1020, {
        death: 14, idle: 8, slamAttack: 8, fractureAttack: 8, seismicAttack: 8, coreExposed: 8,
      });
      expect(animation).toMatchObject({ previousState, previousFrame: 2, transitionProgress: .5 });
    },
  );
});
