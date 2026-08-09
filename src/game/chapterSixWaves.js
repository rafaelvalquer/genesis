// Chapter 6 intentionally uses only Chapter 1 creatures while the volcanic roster is pending.
const POOLS = Object.freeze([
  ["medu", "neurax", "oculis"], ["crix", "vexar", "silex"], ["krulax", "myrkon", "zhyra"], ["krakhul", "brakor", "aurakh"],
]);

export const CHAPTER_SIX_ENEMY_POOL = Object.freeze(POOLS.flat());

export function createChapterSixWaves(phaseIndex) {
  const waveCount = phaseIndex < 3 ? 4 : phaseIndex < 6 ? 5 : 6;
  return Array.from({ length: waveCount }, (_, waveIndex) => {
    const count = 12 + phaseIndex * 3 + waveIndex * 5;
    const types = POOLS.slice(0, Math.min(4, 1 + Math.floor((phaseIndex + waveIndex) / 2))).flat();
    const enemies = types.map((type, index) => ({ type, count: Math.max(1, Math.floor(count / types.length) + (index < count % types.length ? 1 : 0)) }));
    return { enemies, spawnWindowMs: 9000 + waveIndex * 1000, maximumLivingEnemies: 24 + phaseIndex * 3, coordinated: false, chapterSix: true };
  });
}
