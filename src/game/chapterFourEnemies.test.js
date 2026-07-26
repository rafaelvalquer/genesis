import { describe, expect, it } from "vitest";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { CHAPTERS, ENEMIES, PHASES } from "./content.js";
import { createBattleSession, placeTroop, spawnEnemy, tryGorjalFormationPush } from "./battleModel.js";
import { CHAPTER_FOUR_ENEMY_IDS } from "./chapterFourEnemies.js";

describe("inimigos do Capítulo 4", () => {
  it("expõe os cinco inimigos no Campo de Provas e não declara estado hit", () => {
    const session = createBattleSession(PHASES[24], ["colono"], 1, { sandbox: true });
    CHAPTER_FOUR_ENEMY_IDS.forEach((enemyId) => {
      expect(spawnEnemy(session, { type: enemyId, row: 2 }).ok).toBe(true);
      expect(ENEMIES[enemyId].assetStates).not.toContain("hit");
      expect(ENEMIES[enemyId].assetStates.every((state) => (
        existsSync(join(process.cwd(), "src", "game", "assets", "enemy", enemyId, state, "frame0.png"))
      ))).toBe(true);
    });
  });

  it("configura resistências, voo e alcance conforme o papel tático", () => {
    expect(ENEMIES.voltriz).toMatchObject({ airborne: true, range: 3.5, canBeWindEjected: false });
    expect(ENEMIES.nimbarca).toMatchObject({ airborne: true, preferredRange: 2, windResistance: 0.7 });
    expect(ENEMIES.gorjal).toMatchObject({ chargeDamage: 40, knockbackFactor: 0.3 });
    expect(ENEMIES.derivante.assetStates).toContain("windGlide");
    expect(ENEMIES.raizFulgor).toMatchObject({ range: 4.5, preferredRange: 4 });
  });

  it("empurra a rota atomicamente e respeita âncoras absolutas", () => {
    const session = createBattleSession(PHASES[24], ["colono", "muralhaReforcada"], 2, { sandbox: true });
    placeTroop(session, "colono", 1, 4);
    placeTroop(session, "colono", 1, 6);
    const gorjal = spawnEnemy(session, { type: "gorjal", row: 1 }).enemies[0];
    expect(tryGorjalFormationPush(session, gorjal)).toBe(true);
    expect(session.troops.map((troop) => troop.col)).toEqual([3, 5]);
    placeTroop(session, "muralhaReforcada", 1, 7);
    const before = session.troops.map((troop) => troop.col);
    expect(tryGorjalFormationPush(session, gorjal)).toBe(false);
    expect(session.troops.map((troop) => troop.col)).toEqual(before);
  });

  it("torna as oito operações jogáveis com 5/6/7 ondas e loadout sete", () => {
    const chapter = CHAPTERS.find((entry) => entry.id === "chapter_04");
    const phases = PHASES.slice(24, 32);
    expect(chapter.phaseIds).toHaveLength(8);
    expect(phases.map((phase) => phase.waves.length)).toEqual([5, 5, 5, 5, 6, 6, 6, 7]);
    expect(phases.every((phase) => phase.loadoutLimit === 7 && phase.supplyLimit === 35)).toBe(true);
  });
});
