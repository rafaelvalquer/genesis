import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { TROOPS } from "./content.js";

const root = path.join(process.cwd(), "src", "game", "assets", "troop", "interceptadorIcaro");
const sourceRoot = path.join(process.cwd(), "art", "sprites", "interceptadorIcaro");
const expected = {
  idle: 8,
  attackBurst: 8,
  interceptionLock: 8,
  interceptionFire: 8,
  interceptionFireUp: 8,
  interceptionFireDown: 8,
  paralyzed: 8,
  death: 8,
};
const directionalStates = ["interceptionFireUp", "interceptionFireDown"];

const visuals = [
  "idleVisual",
  "attackVisual",
  "interceptionLockVisual",
  "interceptionFireVisual",
  "interceptionFireUpVisual",
  "interceptionFireDownVisual",
  "paralyzedVisual",
  "deathVisual",
];

describe("assets do Interceptador Ícaro", () => {
  it("usa 115,5 px de altura em todos os estados", () => {
    for (const visual of visuals) {
      expect(TROOPS.interceptadorIcaro[visual].height).toBe(115.5);
    }
  });

  it("registra os oito estados aprovados com oito quadros cada", () => {
    expect(TROOPS.interceptadorIcaro.assetStates).toEqual(
      Object.keys(expected).filter((state) => !directionalStates.includes(state)),
    );
    expect(TROOPS.interceptadorIcaro.assetDirectionalStates).toEqual(directionalStates);
    for (const [state, count] of Object.entries(expected)) {
      expect(fs.readdirSync(path.join(root, state)).filter((name) => name.endsWith(".png")))
        .toHaveLength(count);
      expect(fs.readdirSync(path.join(sourceRoot, state)).filter((name) => name.endsWith(".png")))
        .toHaveLength(count);
    }
    expect(fs.existsSync(path.join(root, "hit"))).toBe(false);
  });

  it("mantém margem segura, escala e raiz comuns nos cinco estados em pé", async () => {
    for (const state of Object.keys(expected).filter((name) => name !== "death")) {
      for (let frame = 0; frame < 8; frame += 1) {
        const decoded = await sharp(path.join(root, state, `frame${frame}.png`))
          .ensureAlpha()
          .raw()
          .toBuffer({ resolveWithObject: true });
        const { width, height, channels } = decoded.info;
        let left = width;
        let right = -1;
        let top = height;
        let bottom = -1;
        let footLeft = width;
        let footRight = -1;
        for (let y = 0; y < height; y += 1) {
          for (let x = 0; x < width; x += 1) {
            if (decoded.data[(y * width + x) * channels + 3] <= 3) continue;
            left = Math.min(left, x);
            right = Math.max(right, x);
            top = Math.min(top, y);
            bottom = Math.max(bottom, y);
            if (y >= 327) {
              footLeft = Math.min(footLeft, x);
              footRight = Math.max(footRight, x);
            }
          }
        }
        expect(top).toBeGreaterThanOrEqual(12);
        expect(bottom).toBe(371);
        expect(left).toBeGreaterThanOrEqual(12);
        expect(right).toBeLessThanOrEqual(371);
        expect(Math.abs((footLeft + footRight) / 2 - 192)).toBeLessThanOrEqual(12);
      }
    }
  });

  it("inicia a morte exatamente no mesmo quadro do idle", () => {
    expect(fs.readFileSync(path.join(root, "death", "frame0.png")))
      .toEqual(fs.readFileSync(path.join(root, "idle", "frame0.png")));
  });

  it("mantém os 48 quadros em alta resolução, distintos e transparentes", async () => {
    for (const [state, count] of Object.entries(expected)) {
      const hashes = new Set();
      for (let frame = 0; frame < count; frame += 1) {
        const file = path.join(root, state, `frame${frame}.png`);
        const buffer = fs.readFileSync(file);
        const image = sharp(buffer);
        const metadata = await image.metadata();
        expect({
          width: metadata.width,
          height: metadata.height,
          channels: metadata.channels,
        }).toEqual({ width: 384, height: 384, channels: 4 });

        const alpha = await image.extractChannel(3).stats();
        // Lanczos may retain a two-level alpha fringe around a sharp transparent edge.
        expect(alpha.channels[0].min).toBeLessThanOrEqual(3);
        if (state !== "death" || frame < 6) expect(alpha.channels[0].max).toBeGreaterThan(240);
        hashes.add(createHash("sha256").update(buffer).digest("hex"));
      }
      expect(hashes.size).toBe(count);
    }
  });

  it("registra os quatro canais de áudio", () => {
    for (const name of [
      "icaro_burst_shot.wav",
      "icaro_interception_lock.wav",
      "icaro_interception_fire.wav",
      "icaro_death.wav",
    ]) {
      expect(fs.statSync(path.join(process.cwd(), "src", "game", "assets", "sfx", name)).size)
        .toBeGreaterThan(1000);
    }
  });
});
