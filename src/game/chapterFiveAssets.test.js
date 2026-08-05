import { existsSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { getArenaUrl } from "./assets/arenaCatalog.js";

const assetPath = (relative) => fileURLToPath(new URL(relative, import.meta.url));

describe("assets do Capítulo 5", () => {
  it.each(Array.from({ length: 8 }, (_, index) => index + 33))(
    "entrega fase_%i como WebP 1100x600",
    async (phaseNumber) => {
      const path = assetPath(`./assets/arenas/fase_${phaseNumber}.webp`);
      expect(existsSync(path)).toBe(true);
      const metadata = await sharp(path).metadata();
      expect(metadata).toMatchObject({ width: 1100, height: 600, format: "webp" });
      expect(statSync(path).size).toBeGreaterThan(50000);
      expect(getArenaUrl(`fase_${phaseNumber}`)).toMatch(/fase_\d{2}.*\.webp/i);
    },
  );
});
