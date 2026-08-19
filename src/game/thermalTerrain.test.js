import { describe, expect, it } from "vitest";
import { CHAPTER_SIX_PHASES } from "./chapterSixPhases.js";
import { canPlaceTroop, createBattleSession, createTroopEntity, eliminateTroop, placeTroop, setSandboxSettings, startWave, stepBattle } from "./battleModel.js";
import { getPermanentThermalHazardAt, getSessionMagmaCells, getSessionThermalStateAt, getThermalPlatformAt, getThermalSnapshot, isSessionMagmaCell } from "./thermalTerrain.js";
import { getThermalPlatformVisual } from "./thermalPlatformRenderer.js";

describe("terreno térmico", () => {
  it("prioriza a erupção permanente sobre o ciclo térmico local", () => {
    const session = { phase: { magmaTerrain: { cells: [] } }, thermalCycle: { state: "cooldown" }, permanentThermalHazards: [{ thermalState: "eruption", cells: [[0, 9]], active: true }] };
    expect(getPermanentThermalHazardAt(session, 0, 9)?.thermalState).toBe("eruption");
    expect(isSessionMagmaCell(session, 0, 9)).toBe(true);
    expect(getSessionThermalStateAt(session, 0, 9)).toBe("eruption");
    expect(getSessionThermalStateAt(session, 0, 8)).toBe("cooldown");
  });

  it("inclui células permanentes na lista usada pelo runtime visual", () => {
    const session = { phase: { magmaTerrain: { cells: [[2, 9]] } }, permanentThermalHazards: [{ cells: [[0, 9], [2, 9]], active: true }] };
    expect(getSessionMagmaCells(session)).toEqual([[2, 9], [0, 9]]);
  });

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

  it("freezes thermal values during planning", () => {
    const session = createBattleSession(CHAPTER_SIX_PHASES[2], ["colono", "thermalPlatform"], 19);
    const [row, col] = session.phase.magmaTerrain.cells[0];
    expect(placeTroop(session, "thermalPlatform", row, col).ok).toBe(true);
    expect(placeTroop(session, "colono", row, col).ok).toBe(true);
    const platform = getThermalPlatformAt(session, row, col);
    platform.heat = 100; platform.hp = 3; platform.overheated = true;
    const remaining = getThermalSnapshot(session).remainingMs;
    stepBattle(session, 120000);
    expect(platform.heat).toBe(100);
    expect(platform.hp).toBe(3);
    expect(getThermalSnapshot(session)).toMatchObject({ paused: true, heatRate: 0, remainingMs: remaining });
    expect(session.troops[0].thermalAttackSpeedFactor).toBe(1);
  });

  it("warns exposed troops without damage during planning and rescues them", () => {
    const session = createBattleSession(CHAPTER_SIX_PHASES[2], ["colono", "thermalPlatform"], 20);
    const [row, col] = session.phase.magmaTerrain.cells[0];
    const troop = createTroopEntity(session, "colono", row, col);
    session.troops.push(troop);
    const hp = troop.hp;
    stepBattle(session, 60000);
    expect(troop).toMatchObject({ thermalExposed: true, thermalBurning: false, hp });
    const deployed = placeTroop(session, "thermalPlatform", row, col);
    expect(deployed.ok).toBe(true);
    expect(deployed.events[0].rescuedTroopId).toBe(troop.id);
    expect(troop).toMatchObject({ thermalExposed: false, thermalBurning: false });
  });

  it("resumes thermal damage only after the wave starts", () => {
    const session = createBattleSession(CHAPTER_SIX_PHASES[2], ["colono"], 21);
    const [row, col] = session.phase.magmaTerrain.cells[0];
    const troop = createTroopEntity(session, "colono", row, col);
    session.troops.push(troop);
    stepBattle(session, 1000);
    const hp = troop.hp;
    expect(startWave(session)).toBe(true);
    stepBattle(session, 1000);
    expect(troop.thermalBurning).toBe(true);
    expect(troop.hp).toBeLessThan(hp);
  });

  it("compacts eliminated troops during planning", () => {
    const session = createBattleSession(CHAPTER_SIX_PHASES[2], ["colono"], 22);
    const troop = createTroopEntity(session, "colono", 0, 0);
    session.troops.push(troop);
    eliminateTroop(session, troop, []);
    stepBattle(session, 16);
    expect(session.troops).toHaveLength(0);
  });

  it("keeps the hazard active in sandbox without a wave", () => {
    const session = createBattleSession(CHAPTER_SIX_PHASES[2], ["colono"], 23, { sandbox: true, sandboxSettings: { rulesMode: "free" } });
    const [row, col] = session.phase.magmaTerrain.cells[0];
    const troop = createTroopEntity(session, "colono", row, col);
    session.troops.push(troop);
    const hp = troop.hp;
    stepBattle(session, 1000);
    expect(troop.thermalBurning).toBe(true);
    expect(troop.hp).toBeLessThan(hp);
  });

  it("emite thermalCycleCompleted apenas ao retornar ao início do ciclo", () => {
    const session = createBattleSession(CHAPTER_SIX_PHASES[2], [], 231, { sandbox: true, sandboxSettings: { rulesMode: "free" } });
    session.thermalCycle = {
      ...session.thermalCycle,
      state: "cooldown",
      cycleIndex: 3,
      stateEndsAt: 0,
      completedCycles: 0,
    };
    const events = stepBattle(session, 1);
    expect(events.filter((event) => event.type === "thermalCycleChanged")).toHaveLength(1);
    expect(events.filter((event) => event.type === "thermalCycleCompleted")).toEqual([
      expect.objectContaining({ cycleNumber: 1, previousState: "cooldown", state: "stable" }),
    ]);
  });

  it("renova a plataforma existente in-place, limpa calor e preserva o ID", () => {
    const session = createBattleSession(CHAPTER_SIX_PHASES[2], ["colono", "thermalPlatform"], 24, { sandbox: true, sandboxSettings: { rulesMode: "free" } });
    const [row, col] = session.phase.magmaTerrain.cells[0];
    expect(placeTroop(session, "thermalPlatform", row, col).ok).toBe(true);
    expect(placeTroop(session, "colono", row, col).ok).toBe(true);
    const platform = getThermalPlatformAt(session, row, col);
    platform.heat = 78; platform.hp = 54; platform.overheated = true;
    const id = platform.id;
    const count = session.supportStructures.length;
    const result = placeTroop(session, "thermalPlatform", row, col);
    expect(result).toMatchObject({ ok: true, renewed: true });
    expect(session.supportStructures).toHaveLength(count);
    expect(platform).toMatchObject({ id, hp: 100, maxHp: 100, heat: 0, overheated: false, renewalCount: 1 });
    expect(session.thermalMetrics.platformRenewals).toBe(1);
    expect(session.troops[0]).toMatchObject({ thermalExposed: false, thermalBurning: false, thermalAttackSpeedFactor: 1 });
  });

  it("calcula a barra progressiva pelos thresholds configurados", () => {
    const config = { maxHeat: 100, heatThresholds: { heated: .6, critical: .8, overheat: 1 } };
    expect(getThermalPlatformVisual({ heat: 25 }, config)).toMatchObject({ ratio: .25, percent: 25, state: "idle" });
    expect(getThermalPlatformVisual({ heat: 60 }, config).state).toBe("heated");
    expect(getThermalPlatformVisual({ heat: 80 }, config).state).toBe("critical");
    expect(getThermalPlatformVisual({ heat: 120 }, config)).toMatchObject({ ratio: 1, percent: 100, state: "overheat" });
  });

  it("aplica o estado Cooldown selecionado no Campo de Provas", () => {
    const session = createBattleSession(CHAPTER_SIX_PHASES[2], ["thermalPlatform"], 25, { sandbox: true, sandboxSettings: { rulesMode: "free" } });
    const [row, col] = session.phase.magmaTerrain.cells[0];
    placeTroop(session, "thermalPlatform", row, col);
    const platform = getThermalPlatformAt(session, row, col);
    platform.heat = 80;
    setSandboxSettings(session, { magmaThermalState: "cooldown" });
    stepBattle(session, 1000);
    expect(getThermalSnapshot(session)).toMatchObject({ state: "cooldown", heatRate: -4 });
    expect(platform.heat).toBe(76);
  });
});
