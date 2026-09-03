import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  findNamedImport,
} from "../../scripts/gamecanvas-import-tools.mjs";
import {
  getAnchoredSpriteRect,
} from "./visualGeometry.js";

const repoRoot = process.cwd();
const battleScreenPath = path.join(
  repoRoot,
  "src",
  "game",
  "BattleScreen.jsx",
);

describe("dependências de renderização da BattleScreen", () => {
  it("importa getAnchoredSpriteRect somente de visualGeometry.js", () => {
    const source = fs.readFileSync(battleScreenPath, "utf8");

    const reactImport = findNamedImport(source, "react");
    const geometryImport = findNamedImport(
      source,
      "./visualGeometry.js",
    );

    expect(reactImport).not.toBeNull();
    expect(geometryImport).not.toBeNull();

    expect(reactImport.symbols)
      .not.toContain("getAnchoredSpriteRect");

    expect(
      geometryImport.symbols.filter(
        (symbol) => symbol === "getAnchoredSpriteRect",
      ),
    ).toHaveLength(1);
  });

  it("executa getAnchoredSpriteRect como função", () => {
    expect(getAnchoredSpriteRect)
      .toEqual(expect.any(Function));

    const rect = getAnchoredSpriteRect(
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
