import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const repoRoot = process.cwd();
const gameCanvasPath = path.join(
  repoRoot,
  "src",
  "game",
  "GameCanvas.jsx",
);

describe("dependências de renderização do GameCanvas", () => {
  it("importa getAnchoredSpriteRect quando calcula halos ancorados", () => {
    const source = fs.readFileSync(gameCanvasPath, "utf8");

    const visualGeometryImport = (
      /import\s*\{([\s\S]*?)\}\s*from\s*["']\.\/visualGeometry\.js["'];?/
        .exec(source)
    );

    expect(visualGeometryImport).not.toBeNull();

    const importedSymbols = new Set(
      visualGeometryImport[1]
        .split(",")
        .map((entry) => entry.trim())
        .filter(Boolean),
    );

    expect(source).toContain("getAnchoredSpriteRect(");
    expect(importedSymbols.has("getAnchoredSpriteRect"))
      .toBe(true);
  });

  it("mantém a função disponível em visualGeometry.js", async () => {
    const module = await import("./visualGeometry.js");

    expect(module.getAnchoredSpriteRect)
      .toEqual(expect.any(Function));

    const rect = module.getAnchoredSpriteRect(
      { x: 100, y: 120 },
      80,
      2,
      { x: 0.5, y: 1 },
    );

    expect(rect).toMatchObject({
      width: 160,
      height: 80,
    });
    expect(Number.isFinite(rect.x)).toBe(true);
    expect(Number.isFinite(rect.y)).toBe(true);
  });
});
