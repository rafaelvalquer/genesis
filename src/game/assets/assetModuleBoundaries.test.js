import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { modulesFor } from "./assetModuleUtils.js";

const repoRoot = process.cwd();

it("carrega somente frames recortados, nunca a folha de sprites ao lado deles", () => {
  const modules = {
    "/enemy/leviathanNereida/idleSurface/frame0.png": () => {},
    "/enemy/leviathanNereida/idleSurface/frame1.png": () => {},
    "/enemy/leviathanNereida/idleSurface/idleSurface-spritesheet.png": () => {},
  };

  expect(modulesFor(modules, "leviathanNereida", "idleSurface").map(([key]) => key)).toEqual([
    "/enemy/leviathanNereida/idleSurface/frame0.png",
    "/enemy/leviathanNereida/idleSurface/frame1.png",
  ]);
});

function source(relativePath) {
  return fs.readFileSync(
    path.join(repoRoot, relativePath),
    "utf8",
  );
}

describe("limites dos módulos de assets", () => {
  it("mantém o loader de batalha sem previews, conceitos e arenas", () => {
    const battleLoader = source(
      "src/game/assets/battleAssetLoader.js",
    );

    expect(battleLoader)
      .toContain("./troop/**/*.png");
    expect(battleLoader)
      .toContain("./enemy/**/*.png");
    expect(battleLoader)
      .not.toContain("frame0.png");
    expect(battleLoader)
      .not.toContain("./arenas/");
    expect(battleLoader)
      .not.toContain("./enemy/concepts/");
  });

  it("mantém o preview estático limitado a frame0", () => {
    const troopPreview = source(
      "src/game/assets/troopPreviewCatalog.js",
    );

    expect(troopPreview)
      .toContain("frame0.png");
    expect(troopPreview)
      .not.toContain("./troop/**/*.png");
  });

  it("mantém App fora do loader de batalha", () => {
    const app = source("src/App.jsx");

    expect(app)
      .not.toContain("assetCatalog.js");
    expect(app)
      .not.toContain("battleAssetLoader.js");
  });

  it("mantém o facade sem globs e apenas para compatibilidade", () => {
    const facade = source(
      "src/game/assetCatalog.js",
    );

    expect(facade)
      .not.toContain("import.meta.glob");
    expect(facade)
      .toContain("Compatibility facade");
  });
});
