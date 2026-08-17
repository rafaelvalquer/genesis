import { createThermalHazard, DEFAULT_THERMAL_CYCLE } from "./thermalTerrain.js";
import { CHAPTER_SIX_INTRODUCTIONS, CHAPTER_SIX_TIER_PROFILES, createChapterSixWaves } from "./chapterSixWaves.js";
import { deepFreeze } from "./deepFreeze.js";
import { applyPhase48Scenario } from "./chapter06/phase48Scenario.js";

const fullRows = (rows) => rows.flatMap((row) => Array.from({ length: 9 }, (_, col) => [row, col + 1]));
const central = fullRows([2, 3]);
const cells = [
  [[2, 4], [2, 5], [2, 6], [3, 4], [3, 5], [3, 6]], central, central, central,
  [...central, [1, 6], [1, 7], [4, 6], [4, 7]], central, [...central, [1, 6], [1, 7], [4, 6], [4, 7]], [...central, [0, 4], [0, 5], [4, 8]], [...central, [0, 4], [0, 5], [1, 6], [1, 7], [4, 7], [4, 8]],
];
const names = ["Primeiras Fissuras", "Lago Incandescente", "Respiração da Caldeira", "Fornalhas Naturais", "Fendas Laterais", "Linha de Ruptura", "Veias do Mundo", "Núcleo da Caldeira"];
const arenaIds = ["volcanic-threshold", "magma-lake", "breathing-caldera", "natural-forges", "lateral-rifts", "rupture-line", "world-veins", "caldera-core"];
const crustDensities = [.44, .43, .42, .41, .43, .42, .41, .4];
const cycleFor = (index) => index === 0 ? [{ state: "stable", durationMs: 60000 }] : index === 1 ? [{ state: "stable", durationMs: 30000 }, { state: "active", durationMs: 18000 }] : DEFAULT_THERMAL_CYCLE;
const alphaPressureFor = (index) => {
  const configs = [
    { enabled: false },
    { enabled: true, maxLevel: 2, enemyType: "vermeIncubador" },
    { enabled: true, maxLevel: 3, enemyType: "predadorCaldeira" },
    { enabled: true, maxLevel: 3, enemyType: "predadorCaldeira" },
    { enabled: true, maxLevel: 4, enemyType: "devoradorCaldeira" },
    { enabled: true, maxLevel: 4, enemyType: "rasgaCeusCinereo" },
    { enabled: true, maxLevel: 5, enemyType: "salamandraCinerea" },
    { enabled: true, maxLevel: 5, enemyPool: ["devoradorCaldeira", "rasgaCeusCinereo", "salamandraCinerea"] },
  ];
  return { ...configs[index], warningMs: 1800, uniqueRows: true };
};

export const CHAPTER_SIX_PHASES = deepFreeze(Array.from({ length: 8 }, (_, index) => {
  const waves = createChapterSixWaves(index).map((wave, waveIndex) => applyPhase48Scenario(wave, index, waveIndex));
  const thermalCycle = cycleFor(index);
  return {
    id: `fase_${String(41 + index).padStart(2, "0")}`, name: names[index], subtitle: "A superfície vulcânica exige gestão térmica.",
    energy: 630 + index * 30, arenaId: `fase_${41 + index}`, chapterId: "chapter_06", chapterIndex: index,
    chapterSixFocus: CHAPTER_SIX_INTRODUCTIONS[index], chapterSixTierProfile: CHAPTER_SIX_TIER_PROFILES[index], alphaPressure: alphaPressureFor(index),
    supplyLimit: 40, loadoutLimit: 9, baseIntegrity: 100, cadenceMs: 900, targetDurationMs: 1080000,
    waves, waveCompletionEnergy: 20, waveIntensity: waves.map((_, wave) => .4 + .6 * wave / Math.max(1, waves.length - 1)),
    environment: "volcanic", ambientEffects: ["embers", "smoke", "heat", "magma"], magmaTerrain: { cells: cells[index], visual: { seed: 4141 + index * 101, flow: { x: -1, y: .025 }, speed: 26, viscosity: .82, turbulence: .16, crustDensity: crustDensities[index] } }, thermalCycle,
    environmentHazard: createThermalHazard(cells[index], { cycle: thermalCycle, thermalOverheatDamagePerSecond: 4 + Math.max(0, index - 4), thermalBurnDamagePerSecond: 6 }),
    battlefieldTheme: { id: arenaIds[index], seed: 4141 + index * 101, material: "volcanic", base: "basalt", entrance: "magma-rift", lane: "#2a1713", laneAlt: "#392019", edge: "#f97316", detail: "#fbbf24" },
    palette: { primary: "#f97316", accent: "#fbbf24", shadow: "#090402", haze: "#ef4444" }, boss: index === 7,
  };
}));
export const CHAPTER_SIX_PHASE_IDS = Object.freeze(CHAPTER_SIX_PHASES.map((phase) => phase.id));
