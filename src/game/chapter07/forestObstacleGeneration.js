import { getForestObstacleConfig, getForestObstacleType, forestObstaclePosition } from "./forestObstacleConfig.js";

const hash = (value) => {
  let h = 2166136261 >>> 0;
  for (const char of String(value)) { h ^= char.charCodeAt(0); h = Math.imul(h, 16777619); }
  return h >>> 0;
};
const rng = (seed) => () => {
  seed = (Math.imul(seed ^ seed >>> 16, 2246822519) ^ Math.imul(seed ^ seed >>> 13, 3266489917)) >>> 0;
  return ((seed ^ seed >>> 16) >>> 0) / 4294967296;
};

function weightedType(random, weights, usedSpores, maxSpores) {
  const entries = Object.entries(weights).filter(([type]) => type !== "spores" || usedSpores < maxSpores);
  const total = entries.reduce((sum, [, weight]) => sum + weight, 0);
  let cursor = random() * total;
  for (const [type, weight] of entries) { cursor -= weight; if (cursor <= 0) return type; }
  return entries.at(-1)?.[0] || "ferrivore";
}

export function generateForestObstacleLayout(phase, sessionSeed = 0, config = getForestObstacleConfig(phase)) {
  if (!config.enabled) return [];
  const random = rng(hash(`${phase?.terrain?.seed || 0}:${sessionSeed}:forest-obstacles`));
  const fixedCells = new Set((phase?.startingTroops || []).map((entry) => `${entry.row}:${entry.col}`));
  const count = config.minCount + Math.floor(random() * (config.maxCount - config.minCount + 1));
  const cells = [];
  let spores = 0;
  let attempts = 0;
  while (cells.length < count && attempts++ < count * 80) {
    const row = config.rows[Math.floor(random() * config.rows.length)];
    const col = config.minCol + Math.floor(random() * (config.maxCol - config.minCol + 1));
    if (col <= 1 || col >= 9 || fixedCells.has(`${row}:${col}`)) continue;
    if (cells.some((entry) => entry.row === row && entry.col === col)) continue;
    if ((config.maxPerRow || Infinity) <= cells.filter((entry) => entry.row === row).length) continue;
    if (config.avoidAdjacent && cells.some((entry) => entry.row === row && Math.abs(entry.col - col) <= 1)) continue;
    const type = weightedType(random, config.types, spores, config.maxSporeTrees || 0);
    if (type === "spores") spores += 1;
    const position = forestObstaclePosition(row, col);
    cells.push({ row, col, type, x: position.x, y: position.y });
  }
  return cells;
}

export function createForestObstacle(entry, index = 0) {
  const type = getForestObstacleType(entry.type);
  return {
    id: entry.id || `tree_${index + 1}`,
    kind: "forestObstacle",
    type: type.id,
    row: entry.row,
    col: entry.col,
    x: entry.x,
    y: entry.y,
    hp: type.hp,
    maxHp: type.hp,
    alive: true,
    damageStage: "healthy",
    blocksPlacement: true,
    blocksLineOfSight: true,
    lastHitAt: -Infinity,
    hitShakeUntil: 0,
    destroyedAt: null,
    deathEffectTriggered: false,
    brood: { spawnedCount: 0, nextRollAt: 0 },
    flipX: Boolean(entry.flipX),
    scale: Number(entry.scale) || 1,
  };
}

export function generateForestObstacles(phase, sessionSeed = 0) {
  return generateForestObstacleLayout(phase, sessionSeed).map(createForestObstacle);
}
