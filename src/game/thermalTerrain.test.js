import { describe, expect, it } from "vitest";
import { CHAPTER_SIX_PHASES } from "./chapterSixPhases.js";
import { canPlaceTroop, createBattleSession, placeTroop, stepBattle } from "./battleModel.js";
import { getThermalPlatformAt } from "./thermalTerrain.js";

describe("terreno térmico", () => {
  it("bloqueia tropas comuns no magma, aceita Drone e permite resgate com plataforma", () => {
    const session = createBattleSession(CHAPTER_SIX_PHASES[2], ["colono", "droneSentinela", "thermalPlatform"], 7, { sandbox: true, sandboxSettings: { rulesMode: "free" } });
    const [row, col] = session.phase.magmaTerrain.cells[0];
    expect(canPlaceTroop(session, "colono", row, col)).toContain("Magma");
    expect(canPlaceTroop(session, "droneSentinela", row, col)).toBeNull();
    expect(canPlaceTroop(session, "thermalPlatform", row, col)).toBeNull();
    expect(placeTroop(session, "thermalPlatform", row, col).ok).toBe(true);
    expect(canPlaceTroop(session, "colono", row, col)).toBeNull();
  });

  it("aquece, quebra o suporte e deixa a tropa queimando até o resgate", () => {
    const session = createBattleSession(CHAPTER_SIX_PHASES[2], ["colono", "thermalPlatform"], 8, { sandbox: true, sandboxSettings: { rulesMode: "free" } });
    const [row, col] = session.phase.magmaTerrain.cells[0];
    placeTroop(session, "thermalPlatform", row, col); placeTroop(session, "colono", row, col);
    const platform = getThermalPlatformAt(session, row, col); platform.heat = 100; platform.hp = 1;
    stepBattle(session, 1000);
    const troop = session.troops.find((entry) => entry.row === row && entry.col === col);
    expect(getThermalPlatformAt(session, row, col)).toBeNull();
    expect(troop.thermalBurning).toBe(true);
    expect(placeTroop(session, "thermalPlatform", row, col).ok).toBe(true);
    expect(troop.thermalBurning).toBe(false);
  });
});
