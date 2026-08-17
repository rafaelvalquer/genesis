import { CHAPTER_SIX_PHASE_POLICIES, createChapterSixWaves } from "../src/game/chapterSixWaves.js";

let errors = 0;
for (let phase = 0; phase < 8; phase += 1) {
  const policy = CHAPTER_SIX_PHASE_POLICIES[phase];
  console.log(`F${41 + phase}`);
  let previousDifficulty = -Infinity;
  createChapterSixWaves(phase).forEach((wave, index) => {
    const keys = wave.chapterSixPacketKeys;
    const air = wave.chapterSixRoleCounts.air / keys.length;
    const spam = keys.some((key, position) => position > 1 && key === keys[position - 1] && key === keys[position - 2]);
    const issues = [
      wave.difficulty <= previousDifficulty && "difficulty did not increase",
      air > policy.maxAirRatio && `air ${(air * 100).toFixed(0)}% > ${(policy.maxAirRatio * 100).toFixed(0)}%`,
      spam && !(phase === 0 && index === 0) && "three identical packets consecutively",
    ].filter(Boolean);
    previousDifficulty = wave.difficulty;
    console.log(`W${index + 1} packets=${keys.length} threat=${wave.packetThreat} difficulty=${wave.difficulty} air=${(air * 100).toFixed(0)}% roles=${JSON.stringify(wave.chapterSixRoleCounts)} routes=${JSON.stringify(wave.chapterSixRouteCounts)}${issues.length ? ` ERROR: ${issues.join("; ")}` : ""}`);
    errors += issues.length;
  });
}
if (errors) process.exitCode = 1;
