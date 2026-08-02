import { describe, expect, it } from "vitest";
import { CHAPTER_FIVE_PHASES } from "./chapterFivePhases.js";
import { CHAPTER_FIVE_PACKETS } from "./chapterFivePackets.js";
import { buildSpawnQueue, wavePressure } from "./domain.js";

const TOTAL_DEPLOYABLE_CELLS = 45;
const key = ([row, col]) => `${row}:${col}`;

function floodedAtMaximum(hazard) {
  return new Set([
    ...hazard.permanentWaterCells,
    ...hazard.intertidalBands
      .filter((band) => band.level <= hazard.maximumLevel)
      .flatMap((band) => band.cells),
  ].map(key));
}

describe("Capítulo 5 — Maré Territorial Progressiva", () => {
  it("contém oito missões da fase 33 até a 40", () => {
    expect(CHAPTER_FIVE_PHASES).toHaveLength(8);
    expect(CHAPTER_FIVE_PHASES.map((phase) => phase.id)).toEqual(
      Array.from({ length: 8 }, (_, index) => `fase_${33 + index}`),
    );
  });

  it("preserva seis ondas, Supply 40 e loadout de oito tropas", () => {
    for (const phase of CHAPTER_FIVE_PHASES) {
      expect(phase.waves).toHaveLength(6);
      expect(phase.supplyLimit).toBe(40);
      expect(phase.loadoutLimit).toBe(8);
      expect(phase.environmentHazard.id).toBe("tide_cycle");
      expect(phase.environmentHazard.mode).toBe("territorial_progressive");
      expect(phase.waves.flatMap((wave) => wave.enemies).length).toBeGreaterThan(0);
    }
  });

  it("define água profunda, faixas intermaré e pelo menos 15 células seguras", () => {
    for (const phase of CHAPTER_FIVE_PHASES) {
      const hazard = phase.environmentHazard;
      expect(hazard.permanentWaterCells.length).toBeGreaterThan(0);
      expect(hazard.intertidalBands.length).toBeGreaterThan(0);
      expect(hazard.maximumLevel).toBeGreaterThan(0);
      expect(TOTAL_DEPLOYABLE_CELLS - floodedAtMaximum(hazard).size).toBeGreaterThanOrEqual(15);
    }
  });

  it("aumenta a pressão territorial ao longo das missões", () => {
    const hazards = CHAPTER_FIVE_PHASES.map((phase) => phase.environmentHazard);
    for (let index = 1; index < hazards.length; index += 1) {
      expect(hazards[index].maximumAdvanceChance)
        .toBeGreaterThanOrEqual(hazards[index - 1].maximumAdvanceChance);
      expect(hazards[index].enemySpeedFactor)
        .toBeGreaterThanOrEqual(hazards[index - 1].enemySpeedFactor);
      expect(hazards[index].maximumRetreatChance)
        .toBeLessThanOrEqual(hazards[index - 1].maximumRetreatChance);
    }
    expect(hazards.at(-1).pressureMaximumHpRatio).toBe(0.28);
    expect(hazards.at(-1).submergedAttackSpeedFactor).toBe(0.70);
  });

  it("usa somente os inimigos de Nereida e pacotes coordenados", () => {
    const allowed = new Set([
      "mordelume", "enguiaRasgamar", "carapacaNereida", "medusaVeuSalino",
    ]);
    for (const phase of CHAPTER_FIVE_PHASES) {
      for (const wave of phase.waves) {
        expect(wave.coordinated).toBe(true);
        expect(wave.packetThreat).toBeGreaterThan(0);
        expect(Number.isFinite(wavePressure(phase, phase.waves.indexOf(wave)))).toBe(true);
        for (const enemy of wave.enemies) {
        expect(allowed.has(enemy.type)).toBe(true);
        }
      }
    }
  });

  it("mantém os pacotes em uma rota e não repete três pacotes na mesma rota", () => {
    for (const phase of CHAPTER_FIVE_PHASES) {
      for (let waveIndex = 0; waveIndex < phase.waves.length; waveIndex += 1) {
        const queue = buildSpawnQueue(phase, waveIndex, 99);
        const rowsByPacket = new Map();
        for (const entry of queue) {
          if (!rowsByPacket.has(entry.packetId)) rowsByPacket.set(entry.packetId, new Set());
          rowsByPacket.get(entry.packetId).add(entry.row);
        }
        expect([...rowsByPacket.values()].every((rows) => rows.size === 1)).toBe(true);
        const packetRows = [...rowsByPacket.values()].map((rows) => [...rows][0]);
        for (let index = 2; index < packetRows.length; index += 1) {
          expect(packetRows[index] === packetRows[index - 1] && packetRows[index] === packetRows[index - 2]).toBe(false);
        }
      }
    }
  });

  it("não inclui o Leviatã em pacotes comuns e configura o encontro final", () => {
    expect(Object.values(CHAPTER_FIVE_PACKETS).flatMap((packet) => packet.units).some((unit) => unit.type === "leviathanNereida")).toBe(false);
    const bossWave = CHAPTER_FIVE_PHASES.at(-1).waves.at(-1);
    expect(bossWave.bossEncounter).toMatchObject({ type: "leviathanNereida", spawnAtMs: 20000 });
    expect(bossWave.bossEncounter.reinforcements).toEqual([{ hpFactor: .70, packet: "N4" }, { hpFactor: .35, packet: "N8" }]);
  });
});
