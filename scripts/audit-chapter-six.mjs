import {
  CHAPTER_SIX_PHASE_POLICIES,
  analyzeChapterSixSpawnPattern,
  createChapterSixWaves,
  getChapterSixPhaseMetrics,
  violatesConsecutiveLimit,
  violatesRoleLimit,
} from "../src/game/chapterSixWaves.js";
import { CHAPTER_SIX_PHASES } from "../src/game/chapterSixPhases.js";
import { PHASE_48_SCENARIO } from "../src/game/chapter06/phase48Scenario.js";
import { ENEMIES } from "../src/game/content.js";

let errors = 0;
for (let phase = 0; phase < 8; phase += 1) {
  const policy = CHAPTER_SIX_PHASE_POLICIES[phase];
  console.log(`F${41 + phase}`);
  let previousDifficulty = null;
  createChapterSixWaves(phase).forEach((wave, index) => {
    const keys = wave.chapterSixPacketKeys;
    const air = wave.airThreatRatio;
    const cadence = analyzeChapterSixSpawnPattern(wave.chapterSixSpawnPattern);
    const growth = previousDifficulty === null ? null : wave.difficulty / previousDifficulty - 1;
    const violatesPacketLimit = keys.some((key, position) => violatesConsecutiveLimit(keys.slice(0, position), key, policy));
    const violatesDisruptionLimit = keys.some((key, position) => violatesRoleLimit(keys.slice(0, position), key, policy));
    const issues = [
      previousDifficulty !== null && wave.difficulty < Math.ceil(previousDifficulty * 1.05) && `difficulty growth ${(growth * 100).toFixed(1)}% < 5.0%`,
      air > policy.maxAirThreatRatio && `air threat ${(air * 100).toFixed(0)}% > ${(policy.maxAirThreatRatio * 100).toFixed(0)}%`,
      violatesPacketLimit && !(phase === 0 && index === 0) && `more than ${policy.maxConsecutiveSame} identical packets consecutively`,
      violatesDisruptionLimit && !(phase === 0 && index === 0) && `more than ${policy.maxDisruptionConsecutive} disruption packet consecutively`,
      index >= 3 && cadence.longestBurst > 3 && `burst has ${cadence.longestBurst} packets > 3`,
      cadence.minBurstInterval !== null && cadence.minBurstInterval < 900 && `burst interval ${cadence.minBurstInterval}ms < 900ms`,
      index >= 3 && !cadence.maxPause && "missing reading pause between bursts",
    ].filter(Boolean);
    previousDifficulty = wave.difficulty;
    const growthLabel = growth === null ? "n/a" : `${(growth * 100).toFixed(1)}%`;
    console.log(`W${index + 1} packets=${keys.length} threat=${wave.packetThreat} difficulty=${wave.difficulty} growth=${growthLabel} pattern=${JSON.stringify(wave.chapterSixSpawnPattern)} duration=${wave.spawnWindowMs}ms bursts=${cadence.burstCount} minBurst=${cadence.minBurstInterval ?? "n/a"}ms maxPause=${cadence.maxPause ?? "n/a"}ms airUnits=${wave.airUnitCount}/${wave.totalUnitCount} (${(wave.airUnitRatio * 100).toFixed(0)}%) airThreat=${wave.airThreat}/${wave.totalThreat} (${(air * 100).toFixed(0)}%)${issues.length ? ` ERROR: ${issues.join("; ")}` : ""}`);
    errors += issues.length;
  });
  const metrics = getChapterSixPhaseMetrics(phase);
  console.log(`summary opening=${metrics.phaseOpeningDifficulty} average=${metrics.phaseAverageDifficulty.toFixed(1)} peak=${metrics.phasePeakDifficulty}`);
}
const phase48 = CHAPTER_SIX_PHASES.find((phase) => phase.id === PHASE_48_SCENARIO.id);
const phase48BossIssues = [
  !phase48?.boss && "Fase 48 deve ser marcada como boss",
  phase48?.waves?.slice(0, PHASE_48_SCENARIO.finalWaveIndex).some((wave) => wave.bossEncounter) && "boss fora da Wave 6",
  phase48?.waves?.[PHASE_48_SCENARIO.finalWaveIndex]?.bossEncounter?.type !== "colossoCaldeira" && "Colosso ausente na Wave 6",
  phase48?.waves?.[PHASE_48_SCENARIO.finalWaveIndex]?.maximumLivingEnemies > PHASE_48_SCENARIO.maximumLivingEnemies && "limite de inimigos do boss inválido",
  ENEMIES.colossoCaldeira?.rift?.maxActive?.[3] !== 3 && "limite de fissuras da fase 3 ausente",
  ENEMIES.colossoCaldeira?.rift?.maxSpawnedEnemies?.[3] !== 13 && "limite de invocações da fase 3 ausente",
].filter(Boolean);
console.log(`F48 boss=${phase48?.waves?.[5]?.bossEncounter?.type || "ausente"} maxLiving=${phase48?.waves?.[5]?.maximumLivingEnemies ?? "n/a"}${phase48BossIssues.length ? ` ERROR: ${phase48BossIssues.join("; ")}` : ""}`);
errors += phase48BossIssues.length;
if (errors) process.exitCode = 1;
