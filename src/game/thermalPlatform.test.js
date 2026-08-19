import { describe, expect, it } from "vitest";
import { CHAPTER_SIX_PHASES } from "./chapterSixPhases.js";
import { createBattleSession, placeTroop, stepBattle } from "./battleModel.js";
import { TROOPS } from "./content.js";
import { getThermalPlatformAttackSpeedFactor, getThermalPlatformEffectState, getThermalPlatformAt } from "./thermalTerrain.js";

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

  it("aplica a penalidade progressiva somente a partir de 80%", () => {
    const config = TROOPS.thermalPlatform;
    const platform = { maxHeat: 100, heat: 59, overheated: false };
    expect(getThermalPlatformEffectState(platform, config)).toBe("normal");
    expect(getThermalPlatformAttackSpeedFactor(platform, config)).toBe(1);
    platform.heat = 60;
    expect(getThermalPlatformEffectState(platform, config)).toBe("heated");
    expect(getThermalPlatformAttackSpeedFactor(platform, config)).toBe(1);
    platform.heat = 79;
    expect(getThermalPlatformAttackSpeedFactor(platform, config)).toBe(1);
    platform.heat = 80;
    expect(getThermalPlatformEffectState(platform, config)).toBe("critical");
    expect(getThermalPlatformAttackSpeedFactor(platform, config)).toBe(.9);
    platform.heat = 99;
    expect(getThermalPlatformAttackSpeedFactor(platform, config)).toBe(.9);
  });

  it("mantém a penalidade de overheat pela histerese até 95%", () => {
    const config = TROOPS.thermalPlatform;
    const platform = { maxHeat: 100, heat: 100, overheated: true };
    expect(getThermalPlatformAttackSpeedFactor(platform, config)).toBe(.75);
    platform.heat = 96;
    expect(getThermalPlatformAttackSpeedFactor(platform, config)).toBe(.75);
    platform.heat = 95;
    platform.overheated = false;
    expect(getThermalPlatformAttackSpeedFactor(platform, config)).toBe(.9);
    platform.heat = 79;
    expect(getThermalPlatformAttackSpeedFactor(platform, config)).toBe(1);
  });
});
