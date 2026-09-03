import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const rendererPath = path.join(process.cwd(), "src", "game", "render", "battleFrameRenderer.js");

describe("battle frame renderer boundary", () => {
  it("não importa React, BattleScreen nem executa a simulação", () => {
    const source = fs.readFileSync(rendererPath, "utf8");

    expect(source).not.toContain("from \"react\"");
    expect(source).not.toContain("BattleScreen");
    expect(source).not.toContain("stepBattle(");
  });

  it("mantém a ordem visual: runtime, camadas, apresentação", () => {
    const source = fs.readFileSync(rendererPath, "utf8");

    const runtimeIndex = source.indexOf("updateGraphicsRuntime(");
    const layersIndex = source.indexOf("drawBattleLayers(");
    const presentIndex = source.indexOf("presentScene(");

    expect(runtimeIndex).toBeGreaterThan(-1);
    expect(layersIndex).toBeGreaterThan(runtimeIndex);
    expect(presentIndex).toBeGreaterThan(layersIndex);
  });
});
