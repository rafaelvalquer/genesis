const freezeEntries = (entries) => Object.freeze(entries.map((entry) => Object.freeze({ ...entry })));

export const PHASE_48_SCENARIO = Object.freeze({
  id: "fase_48",
  finalPhaseIndex: 7,
  finalWaveIndex: 5,
  maximumLivingEnemies: 54,
  bossEncounter: Object.freeze({
    type: "colossoCaldeira",
    spawnAtMs: 15000,
    permanentEruption: Object.freeze({
      type: "permanentEruption",
      thermalState: "eruption",
      cells: Object.freeze(Array.from({ length: 5 }, (_, row) => Object.freeze([row, 9]))),
    }),
    packetCatalog: "chapterSix",
    reinforcementIntervalMs: 1100,
    reinforcements: freezeEntries([
      { hpFactor: .82, packet: "C6-06" }, { hpFactor: .62, packet: "C6-08" },
      { hpFactor: .42, packet: "C6-10" }, { hpFactor: .22, packet: "C6-12" },
    ]),
    maximumLivingByType: Object.freeze({
      cuspidorBrasa: 7, vermeIncubador: 4, predadorCaldeira: 6,
      devoradorCaldeira: 4, rasgaCeusCinereo: 4, salamandraCinerea: 7,
    }),
  }),
});

export function applyPhase48Scenario(wave, phaseIndex, waveIndex) {
  if (phaseIndex !== PHASE_48_SCENARIO.finalPhaseIndex || waveIndex !== PHASE_48_SCENARIO.finalWaveIndex) return wave;
  return {
    ...wave,
    maximumLivingEnemies: PHASE_48_SCENARIO.maximumLivingEnemies,
    bossEncounter: PHASE_48_SCENARIO.bossEncounter,
    boss: true,
  };
}
