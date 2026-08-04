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

const startingTroopRules = Object.freeze({
  consumeEnergy: false,
  consumeSupply: false,
  requireLoadout: false,
  removable: false,
  refundable: false,
  countTowardDeploymentLimit: true,
});

const requiredTroopAssetIds = Object.freeze([
  "bastiaoMare",
  "fuzileiroVoltaico",
  "medicaNanites",
]);

const troopAssetDependencies = Object.freeze({
  required: requiredTroopAssetIds,
  alliedSummons: Object.freeze([]),
  temporaryTroops: Object.freeze([]),
  transformations: Object.freeze([]),
});

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
  requiredTroopAssetIds,
  troopAssetDependencies,
});

export const PHASE_40_SCENARIO = Object.freeze({
  id: "fase_40",
  finalPhaseIndex: 7,
  finalWaveIndex: 5,
  startingDefense,
  startingTroopRules,
  requiredTroopAssetIds,
  troopAssetDependencies,
  packetSequences,
  packetGaps,
  maximumLivingEnemies: 48,
  bossEncounter,
  phaseExtra,
});

export function isPhase40Scenario({ phaseId, phaseIndex, finalMission } = {}) {
  if (typeof finalMission === "boolean") return finalMission;
  if (phaseId) return phaseId === PHASE_40_SCENARIO.id;
  return phaseIndex === PHASE_40_SCENARIO.finalPhaseIndex;
}
