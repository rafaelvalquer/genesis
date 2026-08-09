import { createThermalHazard, DEFAULT_THERMAL_CYCLE } from "./thermalTerrain.js";
import { createChapterSixWaves } from "./chapterSixWaves.js";
import { deepFreeze } from "./deepFreeze.js";

const fullRows = (rows) => rows.flatMap((row) => Array.from({ length: 9 }, (_, col) => [row, col + 1]));
const central = fullRows([2, 3]);
const cells = [
  [[2, 4], [2, 5], [2, 6], [3, 4], [3, 5], [3, 6]], central, central, central,
  [...central, [1, 6], [1, 7], [4, 6], [4, 7]], central, [...central, [1, 6], [1, 7], [4, 6], [4, 7]], [...central, [0, 4], [0, 5], [4, 8]], [...central, [0, 4], [0, 5], [1, 6], [1, 7], [4, 7], [4, 8]],
];
const names = ["Primeiras Fissuras", "Lago Incandescente", "Respiração da Caldeira", "Fornalhas Naturais", "Fendas Laterais", "Linha de Ruptura", "Veias do Mundo", "Núcleo da Caldeira"];
const arenaIds = ["volcanic-threshold", "magma-lake", "breathing-caldera", "natural-forges", "lateral-rifts", "rupture-line", "world-veins", "caldera-core"];
const cycleFor = (index) => index === 0 ? [{ state: "stable", durationMs: 60000 }] : index === 1 ? [{ state: "stable", durationMs: 30000 }, { state: "active", durationMs: 18000 }] : DEFAULT_THERMAL_CYCLE;

export const CHAPTER_SIX_PHASES = deepFreeze(Array.from({ length: 8 }, (_, index) => {
  const waves = createChapterSixWaves(index);
  const thermalCycle = cycleFor(index);
  return {
    id: `fase_${String(41 + index).padStart(2, "0")}`, name: names[index], subtitle: "A superfície vulcânica exige gestão térmica.",
    energy: 930 + index * 30, arenaId: `fase_${41 + index}`, chapterId: "chapter_06", chapterIndex: index,
    supplyLimit: 40, loadoutLimit: 9, baseIntegrity: 100, cadenceMs: 900, targetDurationMs: 1080000,
    waves, waveCompletionEnergy: 20, waveIntensity: waves.map((_, wave) => .4 + .6 * wave / Math.max(1, waves.length - 1)),
    environment: "volcanic", ambientEffects: ["embers", "smoke", "heat", "magma"], magmaTerrain: { cells: cells[index] }, thermalCycle,
    environmentHazard: createThermalHazard(cells[index], { cycle: thermalCycle, thermalOverheatDamagePerSecond: 4 + Math.max(0, index - 4), thermalBurnDamagePerSecond: 6 }),
    battlefieldTheme: { id: arenaIds[index], seed: 4141 + index * 101, material: "volcanic", base: "basalt", entrance: "magma-rift", lane: "#2a1713", laneAlt: "#392019", edge: "#f97316", detail: "#fbbf24" },
    palette: { primary: "#f97316", accent: "#fbbf24", shadow: "#090402", haze: "#ef4444" }, boss: false,
  };
}));
export const CHAPTER_SIX_PHASE_IDS = Object.freeze(CHAPTER_SIX_PHASES.map((phase) => phase.id));
