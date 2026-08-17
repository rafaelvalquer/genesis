import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { TROOPS } from "./content.js";

const runtimeRoot = path.join(process.cwd(), "src", "game", "assets", "troop", "mantis");
const artRoot = path.join(process.cwd(), "art", "sprites", "mantis");
const sheetRoot = path.join(process.cwd(), "art", "spritesheets", "mantis");

function readPngMetadata(file) {
  const png = fs.readFileSync(file);
  expect(png.subarray(0, 8).toString("hex")).toBe("89504e470d0a1a0a");
  return {
    width: png.readUInt32BE(16),
    height: png.readUInt32BE(20),
    colorType: png.readUInt8(25),
  };
}

describe("assets da MANTIS", () => {
  it("expõe 6 estados com 8 quadros RGBA de 384px", () => {
    expect(TROOPS.mantis.assetStates).toEqual(["idle", "targetLock", "arcSpikeAttack", "rearm", "paralyzed", "death"]);
    for (const state of TROOPS.mantis.assetStates) {
      for (const root of [artRoot, runtimeRoot]) {
        const files = fs.readdirSync(path.join(root, state)).filter((file) => /frame\d+\.png$/i.test(file));
        expect(files.sort()).toEqual(Array.from({ length: 8 }, (_, frame) => `frame${frame}.png`));
        for (const file of files) {
          expect(readPngMetadata(path.join(root, state, file))).toEqual({ width: 384, height: 384, colorType: 6 });
        }
      }
    }
    for (const root of [artRoot, runtimeRoot]) {
      for (const obsoleteState of ["attackBurst", "reload", "hit"]) {
        expect(fs.existsSync(path.join(root, obsoleteState))).toBe(false);
      }
    }
    expect(readPngMetadata(path.join(sheetRoot, "mantis-6x8.png"))).toEqual({ width: 3072, height: 2304, colorType: 6 });
  });

  it("mantém uma fonte de alta resolução separada para cada estado", () => {
    for (const state of TROOPS.mantis.assetStates) {
      const metadata = readPngMetadata(path.join(sheetRoot, "sources", `${state}-8x1.png`));
      expect(metadata.colorType).toBe(6);
      expect(metadata.width).toBeGreaterThanOrEqual(2000);
      expect(metadata.height).toBeGreaterThanOrEqual(700);
    }
  });
});
