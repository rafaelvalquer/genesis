import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { createConvoyFlow, createConvoyState } from "../chapter07/convoyState.js";
import { updateConvoyThreat } from "../chapter07/convoyTargeting.js";
import { damageForestObstacle } from "../chapter07/forestObstacleSystem.js";
import { updateSporeField } from "../chapter07/sporeField.js";
import { getBattleSystemRegistry } from "./systems/battleSystemRegistry.js";

describe("BattleSystemRegistry", () => {
  it("registra o Chapter 7 usando as mesmas funções de runtime, sem wrappers", () => {
    const registry = getBattleSystemRegistry();
    const plugin = registry.chapterPlugins.require("chapter_07");

    expect(plugin.createConvoyState).toBe(createConvoyState);
    expect(plugin.createConvoyFlow).toBe(createConvoyFlow);
    expect(plugin.updateConvoyThreat).toBe(updateConvoyThreat);
    expect(plugin.damageForestObstacle).toBe(damageForestObstacle);
    expect(plugin.updateSporeField).toBe(updateSporeField);
  });

  it("mantém registry e plugin imutáveis e falha explicitamente para capítulo ausente", () => {
    const registry = getBattleSystemRegistry();
    const plugin = registry.chapterPlugins.require("chapter_07");

    expect(Object.isFrozen(registry)).toBe(true);
    expect(Object.isFrozen(registry.chapterPlugins)).toBe(true);
    expect(Object.isFrozen(plugin)).toBe(true);
    expect(registry.chapterPlugins.list()).toEqual(["chapter_07"]);
    expect(registry.chapterPlugins.get("chapter_08")).toBeNull();
    expect(() => registry.chapterPlugins.require("chapter_08")).toThrow("Chapter plugin not registered: chapter_08");
  });

  it("impede o engine central de voltar a importar Chapter 7 diretamente", () => {
    const enginePath = resolve(process.cwd(), "src/game/battle/engine.js");
    const engineSource = readFileSync(enginePath, "utf8");

    expect(engineSource).toContain('from "./systems/battleSystemRegistry.js"');
    expect(engineSource).not.toMatch(/from\s+["']\.\.\/chapter07\//);
  });
});