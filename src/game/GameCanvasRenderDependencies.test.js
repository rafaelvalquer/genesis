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
const entityRendererPath = path.join(
  repoRoot,
  "src",
  "game",
  "render",
  "entityRenderer.js",
);

describe("dependências de renderização da BattleScreen", () => {
  it("mantém a geometria de sprite no entityRenderer", () => {
    const screenSource = fs.readFileSync(battleScreenPath, "utf8");
    const entitySource = fs.readFileSync(entityRendererPath, "utf8");

    const reactImport = findNamedImport(screenSource, "react");
    const geometryImport = findNamedImport(
      entitySource,
      "../visualGeometry.js",
    );

    expect(reactImport).not.toBeNull();
    expect(geometryImport).not.toBeNull();

    expect(reactImport.symbols)
      .not.toContain("getAnchoredSpriteRect");

    expect(screenSource)
      .not.toContain("getAnchoredSpriteRect");

    expect(
      geometryImport.symbols.filter(
        (symbol) => symbol === "getAnchoredSpriteRect",
      ),
    ).toHaveLength(1);
  });

  it("delega a montagem de renderizadores de camada ao módulo de render", () => {
    const screenSource = fs.readFileSync(battleScreenPath, "utf8");

    expect(screenSource).toContain("./render/battleFrameRenderer.js");
    expect(screenSource).not.toContain("./render/battleLayerRenderers.js");
    expect(screenSource).not.toContain("./chapter07/forestObstacleRenderer.js");
    expect(screenSource).not.toContain("./chapter07/convoyRenderer.js");
    expect(screenSource).not.toContain("./render/entityRenderer.js");
  });

  it("delega reações de eventos do frame a um módulo de hook", () => {
    const screenSource = fs.readFileSync(battleScreenPath, "utf8");

    expect(screenSource).toContain("./hooks/battleStepEvents.js");
    expect(screenSource).toContain("handleBattleStepEvents(events");
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
