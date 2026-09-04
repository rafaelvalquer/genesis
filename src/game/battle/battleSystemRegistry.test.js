import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { createConvoyFlow, createConvoyState } from "../chapter07/convoyState.js";
import { updateConvoyThreat } from "../chapter07/convoyTargeting.js";
import { damageForestObstacle } from "../chapter07/forestObstacleSystem.js";
import { updateSporeField } from "../chapter07/sporeField.js";
import { getBattleSystemRegistry } from "./systems/battleSystemRegistry.js";

describe("BattleSystemRegistry", () => {
  it("registra o Chapter 7 mantendo as funções de runtime como referências diretas", () => {
    const registry = getBattleSystemRegistry();
    const plugin = registry.chapterPlugins.require("chapter_07");

    expect(typeof plugin.initializeSession).toBe("function");
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

  it("preserva a inicialização de comboio já existente ao delegar para o plugin", () => {
    const plugin = getBattleSystemRegistry().chapterPlugins.require("chapter_07");
    const phase = {
      chapterId: "chapter_07",
      progressionMode: "convoy",
      convoy: {
        row: 2,
        maxHp: 1200,
        reserveInitial: 80,
        reserveMax: 140,
        entryDurationMs: 2200,
      },
      forestObstacles: { enabled: false },
    };
    const queue = [{ enemyId: "test" }];
    const session = {
      phase,
      seed: 12345,
      queue,
      forestObstacles: [],
      chapterSevenMetrics: { forestTreesSpawned: 0 },
    };

    expect(plugin.initializeSession(session)).toBe(session);
    expect(session.convoy).toEqual(createConvoyState(phase));
    expect(session.convoyFlow).toEqual(createConvoyFlow());
    expect(session.convoySectorQueue).toBe(queue);
    expect(session.forestObstacles).toEqual([]);
    expect(session.chapterSevenMetrics.forestTreesSpawned).toBe(0);
  });

  it("mantém inalterada uma sessão fora das mecânicas do Chapter 7", () => {
    const plugin = getBattleSystemRegistry().chapterPlugins.require("chapter_07");
    const session = {
      phase: { chapterId: "chapter_01", progressionMode: "waves" },
      seed: 123,
      queue: [],
      forestObstacles: [],
      chapterSevenMetrics: { forestTreesSpawned: 0 },
    };

    expect(plugin.initializeSession(session)).toBe(session);
    expect(session).not.toHaveProperty("convoy");
    expect(session).not.toHaveProperty("convoyFlow");
    expect(session.forestObstacles).toEqual([]);
    expect(session.chapterSevenMetrics.forestTreesSpawned).toBe(0);
  });

  it("impede o engine central de voltar a importar ou inicializar Chapter 7 diretamente", () => {
    const enginePath = resolve(process.cwd(), "src/game/battle/engine.js");
    const engineSource = readFileSync(enginePath, "utf8");

    expect(engineSource).toContain('from "./systems/battleSystemRegistry.js"');
    expect(engineSource).not.toMatch(/from\s+["']\.\.\/chapter07\//);
    expect(engineSource).toContain("chapterSevenPlugin.initializeSession(session);");
    expect(engineSource).not.toContain("session.convoy = createConvoyState(sessionPhase);");
    expect(engineSource).not.toContain("session.convoyFlow = createConvoyFlow();");
    expect(engineSource).not.toContain("session.forestObstacles = generateForestObstacles(sessionPhase, seed);");
  });
});