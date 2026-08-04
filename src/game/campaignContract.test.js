import { describe, expect, it } from "vitest";
import { CHAPTERS, ENEMIES, PHASES, TROOPS } from "./content.js";
import {
  getArenaUrl,
  resolvePhaseEnemyAssetDependencies,
  resolvePhaseTroopAssetDependencies,
} from "./assetCatalog.js";

function waveEnemyEntries(wave) {
  const entries = [];
  (wave.enemies || []).forEach((entry) => entries.push(entry));
  (wave.spawnBlocks || []).forEach((block) => {
    (block.packets || []).forEach((packet) => {
      (packet.units || []).forEach((unit) => entries.push({
        type: unit.type,
        count: unit.rows?.length
          ? unit.rows.length * (unit.countPerRow || 1)
          : unit.count,
      }));
    });
  });
  return entries;
}

describe("contrato estrutural da campanha", () => {
  it("mantém cinco capítulos e quarenta fases sequenciais", () => {
    expect(CHAPTERS).toHaveLength(5);
    expect(PHASES).toHaveLength(40);
    expect(PHASES.map((phase) => phase.id)).toEqual(
      Array.from({ length: 40 }, (_, index) => `fase_${String(index + 1).padStart(2, "0")}`),
    );
    expect(new Set(PHASES.map((phase) => phase.id)).size).toBe(40);
    expect(CHAPTERS.flatMap((chapter) => chapter.phaseIds || [])).toHaveLength(40);
  });

  it.each(PHASES.map((phase) => [phase.id, phase]))(
    "%s possui arena, ondas e referências válidas",
    (_phaseId, phase) => {
      expect(phase.arenaId).toBeTruthy();
      expect(getArenaUrl(phase.arenaId)).toBeTruthy();
      expect(Array.isArray(phase.waves)).toBe(true);
      expect(phase.waves.length).toBeGreaterThan(0);
      expect(() => resolvePhaseTroopAssetDependencies(phase, [], { strict: true })).not.toThrow();
      expect(() => resolvePhaseEnemyAssetDependencies(phase, [], { strict: true })).not.toThrow();

      for (const wave of phase.waves) {
        const entries = waveEnemyEntries(wave);
        expect(entries.length || wave.bossEncounter).toBeTruthy();
        for (const enemy of entries) {
          expect(ENEMIES[enemy.type], `Inimigo desconhecido ${enemy.type} em ${phase.id}`).toBeTruthy();
          expect(Number(enemy.count)).toBeGreaterThan(0);
          expect(Number.isInteger(Number(enemy.count))).toBe(true);
        }
        if (wave.bossEncounter) {
          expect(ENEMIES[wave.bossEncounter.type]?.boss).toBe(true);
          expect(Number(wave.bossEncounter.spawnAtMs)).toBeGreaterThanOrEqual(0);
        }
        if (Number.isFinite(wave.spawnWindowMs) && Number.isFinite(phase.targetDurationMs)) {
          expect(phase.targetDurationMs).toBeGreaterThan(wave.spawnWindowMs);
        }
      }

      const occupied = new Set();
      const counts = new Map();
      for (const entry of phase.startingTroops || []) {
        expect(TROOPS[entry.type], `Tropa inicial desconhecida ${entry.type}`).toBeTruthy();
        expect(entry.row).toBeGreaterThanOrEqual(0);
        expect(entry.row).toBeLessThan(5);
        expect(entry.col).toBeGreaterThanOrEqual(0);
        const key = `${entry.row}:${entry.col}`;
        expect(occupied.has(key), `Célula inicial duplicada ${key} em ${phase.id}`).toBe(false);
        occupied.add(key);
        counts.set(entry.type, (counts.get(entry.type) || 0) + 1);
      }
      for (const [troopId, count] of counts) {
        const limit = phase.startingTroopRules?.deploymentLimits?.[troopId]
          ?? phase.troopDeploymentLimits?.[troopId]
          ?? TROOPS[troopId]?.maxDeployed;
        if (Number.isFinite(limit)) expect(limit).toBeGreaterThanOrEqual(count);
      }
    },
  );

  it("declara estados de assets essenciais nos catálogos", () => {
    for (const [troopId, troop] of Object.entries(TROOPS)) {
      const states = troop.assetStates
        || ((troop.spriteKey || troopId) === "muralhaReforcada" ? ["defense"] : ["idle", "attack"]);
      expect(states.length, `Tropa ${troopId} sem estados`).toBeGreaterThan(0);
    }
    for (const [enemyId, enemy] of Object.entries(ENEMIES)) {
      expect((enemy.assetStates || ["walking", "attack", "idle"]).length,
        `Inimigo ${enemyId} sem estados`).toBeGreaterThan(0);
    }
  });
});
