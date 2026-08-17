import {
  CHAPTER_SIX_PHASE_POLICIES,
  createChapterSixWaves,
  violatesConsecutiveLimit,
  violatesRoleLimit,
} from "../src/game/chapterSixWaves.js";

let errors = 0;
for (let phase = 0; phase < 8; phase += 1) {
  const policy = CHAPTER_SIX_PHASE_POLICIES[phase];
  console.log(`F${41 + phase}`);
  let previousDifficulty = null;
  createChapterSixWaves(phase).forEach((wave, index) => {
    const keys = wave.chapterSixPacketKeys;
    const air = wave.chapterSixRoleCounts.air / keys.length;
    const gap = wave.spawnBlocks[0].packets[1]?.spawnAtMs || 0;
    const growth = previousDifficulty === null ? null : wave.difficulty / previousDifficulty - 1;
    const violatesPacketLimit = keys.some((key, position) => violatesConsecutiveLimit(keys.slice(0, position), key, policy));
    const violatesDisruptionLimit = keys.some((key, position) => violatesRoleLimit(keys.slice(0, position), key, policy));
    const issues = [
      previousDifficulty !== null && wave.difficulty < Math.ceil(previousDifficulty * 1.05) && `difficulty growth ${(growth * 100).toFixed(1)}% < 5.0%`,
      air > policy.maxAirRatio && `air ${(air * 100).toFixed(0)}% > ${(policy.maxAirRatio * 100).toFixed(0)}%`,
      violatesPacketLimit && !(phase === 0 && index === 0) && `more than ${policy.maxConsecutiveSame} identical packets consecutively`,
      violatesDisruptionLimit && !(phase === 0 && index === 0) && `more than ${policy.maxDisruptionConsecutive} disruption packet consecutively`,
    ].filter(Boolean);
    previousDifficulty = wave.difficulty;
    const growthLabel = growth === null ? "n/a" : `${(growth * 100).toFixed(1)}%`;
    console.log(`W${index + 1} packets=${keys.length} threat=${wave.packetThreat} difficulty=${wave.difficulty} growth=${growthLabel} gap=${gap}ms components=${JSON.stringify(wave.difficultyBreakdown)} air=${(air * 100).toFixed(0)}% roles=${JSON.stringify(wave.chapterSixRoleCounts)} routes=${JSON.stringify(wave.chapterSixRouteCounts)}${issues.length ? ` ERROR: ${issues.join("; ")}` : ""}`);
    errors += issues.length;
  });
}
if (errors) process.exitCode = 1;
