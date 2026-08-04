const freezeEntries = (entries) => Object.freeze(
  entries.map((entry) => Object.freeze({ ...entry })),
);

const fullColumn = (type, col) => Array.from(
  { length: 5 },
  (_, row) => ({ type, row, col }),
);

const startingDefense = freezeEntries([
  ...fullColumn("bastiaoMare", 6),
  ...fullColumn("fuzileiroVoltaico", 5),
  ...fullColumn("medicaNanites", 3),
]);

const deploymentLimits = Object.freeze({
  bastiaoMare: 5,
  fuzileiroVoltaico: 5,
  medicaNanites: 5,
});

const startingTroopRules = Object.freeze({
  consumeEnergy: false,
  consumeSupply: false,
  requireLoadout: false,
  removable: false,
  refundable: false,
  countTowardDeploymentLimit: true,
  deploymentLimits,
});

const troopAssetDependencies = Object.freeze({
  required: Object.freeze([
    "bastiaoMare",
    "fuzileiroVoltaico",
    "medicaNanites",
  ]),
  alliedSummons: Object.freeze([]),
  temporaryTroops: Object.freeze([]),
  transformations: Object.freeze([]),
});

// Alias derivado e temporário para consumidores anteriores.
const requiredTroopAssetIds = troopAssetDependencies.required;

const packetSequences = Object.freeze([
  ["N3", "N5", "N10", "N8", "N11"],
  ["N7", "N10", "N8", "N12", "N11"],
  ["N10", "N13", "N8", "N12", "N11"],
  ["N13", "N10", "N14", "N8", "N12", "N11"],
  ["N10", "N13", "N8", "N12", "N11", "N14", "N13"],
  ["N10", "N11", "N8", "N12", "N13", "N14"],
].map((wave) => Object.freeze(wave)));

const packetGaps = Object.freeze([
  9000,
  8500,
  7500,
  6800,
  6200,
  5500,
]);

const bossEncounter = Object.freeze({
  type: "leviathanNereida",
  spawnAtMs: 18000,
  reinforcements: freezeEntries([
    { hpFactor: 0.85, packet: "N6" },
    { hpFactor: 0.70, packet: "N10" },
    { hpFactor: 0.55, packet: "N11" },
    { hpFactor: 0.40, packet: "N12" },
    { hpFactor: 0.25, packet: "N13" },
    { hpFactor: 0.12, packet: "N14" },
  ]),
  maximumLivingByType: Object.freeze({
    medusaVeuSalino: 3,
    carapacaNereida: 4,
    enguiaRasgamar: 5,
    mordelume: 16,
  }),
});

const phaseExtra = Object.freeze({
  boss: true,
  providedByMission: "fase_40",
  startingTroops: startingDefense,
  startingTroopRules,
  troopAssetDependencies,
  requiredTroopAssetIds,
});

export const PHASE_40_SCENARIO = Object.freeze({
  id: "fase_40",
  finalPhaseIndex: 7,
  finalWaveIndex: 5,
  startingDefense,
  startingTroopRules,
  troopAssetDependencies,
  requiredTroopAssetIds,
  packetSequences,
  packetGaps,
  maximumLivingEnemies: 48,
  bossEncounter,
  phaseExtra,
});

export function isPhase40Scenario({ phaseId, phaseIndex, finalMission } = {}) {
  const hasPhaseId = typeof phaseId === "string" && phaseId.length > 0;
  const hasPhaseIndex = Number.isInteger(phaseIndex);
  const byId = hasPhaseId ? phaseId === PHASE_40_SCENARIO.id : null;
  const byIndex = hasPhaseIndex
    ? phaseIndex === PHASE_40_SCENARIO.finalPhaseIndex
    : null;

  if (byId != null && byIndex != null && byId !== byIndex) {
    throw new Error(`Configuração inconsistente entre phaseId ${phaseId} e phaseIndex ${phaseIndex}.`);
  }

  const expected = byId ?? byIndex ?? false;
  if (typeof finalMission === "boolean" && finalMission !== expected) {
    throw new Error(`Configuração inconsistente para ${phaseId || `phaseIndex ${phaseIndex}`}.`);
  }
  return expected;
}
