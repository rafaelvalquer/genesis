import { deepFreeze } from "./deepFreeze.js";

const NAMES = ["Posto Ferrugem", "Estrada da Fronteira", "Rota Bombardeada", "Ferrovia de Carga",
  "Complexo de Extração", "Ponte do Abismo", "Cemitério de Comboios", "Terminal de Evacuação"];
const ROUTES = ["pavedRoad", "dirtRoad", "damagedRoad", "railway", "industrialTrack", "bridge", "warRoad", "evacuationCorridor"];
const SUBTITLES = [
  "Mantenha uma escolta operacional ao lado do transporte.", "Proteja as rotas adjacentes durante a marcha.",
  "Avance antes que os reforços dominem a estrada.", "Caçadores de comboio ocupam o pátio ferroviário.",
  "Administre a reserva durante setores industriais extensos.", "A travessia concentra pressão lateral sobre a patrulha.",
  "Defenda simultaneamente a base e o transporte.", "Alcance o terminal mesmo sob o comando do Marechal da Forja.",
];
const POOLS = [
  ["rastejanteMata", "saqueadorEscoria"],
  ["rastejanteMata", "saqueadorEscoria", "couracadoHematita"],
  ["rastejanteMata", "saqueadorEscoria", "sabotadorOxido"],
  ["rastejanteMata", "couracadoHematita", "cacadorComboio"],
  ["rastejanteMata", "couracadoHematita", "sabotadorOxido", "cacadorComboio"],
  ["cacadorComboio", "couracadoHematita", "saltadorAlado", "atiradorRavina", "macacoEsporos"],
  ["rastejanteMata", "saqueadorEscoria", "couracadoHematita", "saltadorAlado", "cacadorComboio", "sabotadorOxido", "atiradorRavina", "macacoEsporos"],
  ["couracadoHematita", "cacadorComboio", "sabotadorOxido", "atiradorRavina", "macacoEsporos"],
];

const packet = (id, atMs, units, routeStrategy = "split", fixedRows) => ({ id, atMs,
  units: units.map(([type, count]) => ({ type, count, intervalMs: 220 })), routeStrategy, ...(fixedRows ? { fixedRows } : {}) });

function createSector(phaseIndex, sectorIndex) {
  const pool = POOLS[phaseIndex];
  const intensity = phaseIndex + sectorIndex;
  const adjacent = phaseIndex >= 1 ? [1, 3] : null;
  const packets = [
    packet(`p${phaseIndex + 49}s${sectorIndex + 1}a`, 0, [[pool[0], 3 + Math.floor(intensity / 3)]], adjacent ? "scripted" : "split", adjacent),
    packet(`p${phaseIndex + 49}s${sectorIndex + 1}b`, 11000 - Math.min(3000, phaseIndex * 350), [[pool[1] || pool[0], 2 + Math.floor(intensity / 4)]], sectorIndex % 2 ? "spread" : "focused"),
    packet(`p${phaseIndex + 49}s${sectorIndex + 1}c`, 23000 - Math.min(5000, phaseIndex * 450), [[pool[Math.min(pool.length - 1, 2)], 1 + Math.floor(intensity / 5)]], phaseIndex >= 3 ? "scripted" : "split", phaseIndex >= 3 ? [1, 3] : undefined),
    packet(`p${phaseIndex + 49}s${sectorIndex + 1}d`, 37000 - Math.min(7000, phaseIndex * 550), [[pool[(sectorIndex + 1) % pool.length], 2 + Math.floor(intensity / 5)]], "spread"),
  ];
  if (phaseIndex >= 5) packets.push(packet(`p${phaseIndex + 49}s${sectorIndex + 1}saltador`, 30000, [["saltadorAlado", 1]], "scripted", [1, 3]));
  if (phaseIndex >= 2) packets.push(packet(`p${phaseIndex + 49}s${sectorIndex + 1}esporos`, 27000, [["macacoEsporos", 1]], "scripted", [1, 3]));
  if (phaseIndex === 7 && sectorIndex === 3) packets.unshift(packet("terminal-boss", 4000, [["marechalForja", 1]], "scripted", [0]));
  const warningAtMs = Math.max(38000, 62000 - phaseIndex * 3000);
  const startsAtMs = warningAtMs + 12000;
  return {
    id: `sector_${sectorIndex + 1}`, endsAtProgress: (sectorIndex + 1) * .25,
    openingPackets: packets,
    routeWeights: phaseIndex >= 4 ? { 0: 1.2, 1: 2.2, 3: 2.2, 4: 1.2 } : { 0: 1, 1: 1.5, 3: 1.5, 4: 1 },
    reinforcement: { warningAtMs, startsAtMs,
      intervalMs: phaseIndex >= 5 ? 300000 : Math.max(14000, 22000 - phaseIndex * 700),
      maxAliveEnemies: phaseIndex >= 5 ? 14 : 18 + phaseIndex * 2,
      packetPool: pool.map((type, index) => packet(`reinforcement-${index}`, 0, [[type, type === "couracadoHematita" ? 1 : 2]], "focused")) },
  };
}

export const CHAPTER_SEVEN_PHASES = deepFreeze(Array.from({ length: 8 }, (_, index) => ({
  id: `fase_${49 + index}`, name: NAMES[index], subtitle: SUBTITLES[index], chapterId: "chapter_07", chapterIndex: index,
  progressionMode: "convoy", arenaId: `fase_${49 + index}`, energy: 100, energyCapacity: 200,
  waves: [],
  ambientEffects: ["ferricSpores", "bioluminescentVeins", "livingHaze"],
  waveIntensity: [.42, .62, .82, 1],
  baseIntegrity: 500 + index * 50, supplyLimit: 32, loadoutLimit: 7, cadenceMs: 900,
  targetDurationMs: 390000 + index * 20000,
  rules: { combatRows: [0, 1, 3, 4], transportRow: 2, defaultTroopDeploymentLimit: 4,
    blockedTroopIds: ["reator", "thermalPlatform"],
    disabledSystems: ["dematerializationPulse", "legacyWaveOutro", "legacyWaveDecisions", "waveCompletionEnergy", "enemyEnergyPickups", "reactor", "thermalPlatform"] },
  convoy: { vehicleId: ["tr7_pioneiro", "tr7r_peregrino", "tr7a_bastilha", "tr7f_ferrum", "tr9_atlas", "tr9p_vertice", "tr9s_sobrevivente", "trx_exodo"][index], row: 2,
    maxHp: 1000,
    sectorStops: [0.06, 0.28, 0.51, 0.74, 0.96], entryDurationMs: 2200, transitDurationMs: 2400, targetUninterruptedTravelMs: 180000 + index * 6000,
    reserveInitial: 80, reserveMax: 80, energyPerPulse: 3, energyPulseEveryMs: 5000,
    checkpointRewards: { repairHp: 200, reserveAmount: 40 }, lateralAttackRangeTiles: 1 },
  terrain: { mode: "convoy", routeType: ROUTES[index], seed: 7049 + index * 101 },
  sectors: Array.from({ length: 4 }, (_, sectorIndex) => createSector(index, sectorIndex)),
  battlefieldTheme: { id: ROUTES[index], seed: 7049 + index * 101, material: "ferrivore", base: "overgrownFrontier",
    entrance: "colonyEdge", lane: "#261B17", laneAlt: "#472A20", edge: "#C65A33", detail: "#63E6D6" },
  palette: { primary: "#C65A33", accent: "#63E6D6", shadow: "#070A09", haze: "#6F3526" },
  boss: index === 7,
  ...(index === 7 ? { bossEncounter: { completionPolicy: "objective", objective: "convoyDestination", bossType: "marechalForja" } } : {}),
})));

export const CHAPTER_SEVEN_PHASE_IDS = Object.freeze(CHAPTER_SEVEN_PHASES.map((phase) => phase.id));
