import { describe, expect, it } from "vitest";
import { CHAPTER_SIX_PHASES } from "./chapterSixPhases.js";
import { createBattleSession, placeTroop, stepBattle } from "./battleModel.js";
import { TROOPS } from "./content.js";
import { getThermalPlatformAt } from "./thermalTerrain.js";

describe("Plataforma Térmica", () => {
  it("desloca o sprite 16 px abaixo do centro da rota", () => {
    expect(TROOPS.thermalPlatform.spriteOffsetY).toBe(16);
  });

  it("limita calor, entra em superaquecimento e reduz a cadência", () => {
    const session = createBattleSession(CHAPTER_SIX_PHASES[2], ["colono", "thermalPlatform"], 12, { sandbox: true, sandboxSettings: { rulesMode: "free" } });
    const [row, col] = session.phase.magmaTerrain.cells[0];
    placeTroop(session, "thermalPlatform", row, col); placeTroop(session, "colono", row, col);
    const platform = getThermalPlatformAt(session, row, col); platform.heat = 99;
    session.thermalCycle.state = "eruption"; session.thermalCycle.heatRatePerSecond = 5;
    stepBattle(session, 1000);
    expect(platform.heat).toBe(100); expect(platform.overheated).toBe(true);
    expect(session.troops[0].thermalAttackSpeedFactor).toBe(.75);
  });
});
