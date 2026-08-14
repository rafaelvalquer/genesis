import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { TROOPS } from "./content.js";

const root = path.join(process.cwd(), "src", "game", "assets", "troop", "mantis");

describe("assets da MANTIS", () => {
  it("expõe 6 estados com 8 quadros RGBA 384px", () => {
    expect(TROOPS.mantis.assetStates).toEqual(["idle", "targetLock", "attackBurst", "reload", "paralyzed", "death"]);
    for (const state of TROOPS.mantis.assetStates) {
      const files = fs.readdirSync(path.join(root, state)).filter((file) => /frame\d+\.png$/i.test(file));
      expect(files).toHaveLength(8);
      const signature = fs.readFileSync(path.join(root, state, files[0]));
      expect(signature.subarray(0, 8).toString("hex")).toBe("89504e470d0a1a0a");
    }
    const sheet = fs.readFileSync(path.join(process.cwd(), "art", "spritesheets", "mantis", "mantis-6x8.png"));
    expect(sheet.subarray(0, 8).toString("hex")).toBe("89504e470d0a1a0a");
    expect(sheet.readUInt32BE(16)).toBe(3072);
    expect(sheet.readUInt32BE(20)).toBe(2304);
  });
});
