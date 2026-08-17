const MAX_ALPHA_SPAWNS = 5;
const DEFAULT_WARNING_MS = 1800;

export const CHAPTER_SIX_ALPHA_MODIFIERS = Object.freeze({
  hpMultiplier: 1.65,
  damageMultiplier: 1.25,
  speedMultiplier: 1.10,
  scaleMultiplier: 1.12,
});

const numeric = (value, fallback = 0) => Number.isFinite(value) ? value : fallback;

export function createAlphaPressureState(config, troopCount = 0) {
  return {
    enabled: Boolean(config?.enabled),
    cycleNumber: 0,
    cycleStartTroopCount: null,
    previousCycleEndTroopCount: troopCount,
    level: 0,
    totalAlphaSpawned: 0,
    lastTriggeredAt: null,
    pendingSpawns: [],
  };
}

export function countPressureTroops(session) {
  return (session?.troops || []).filter((troop) => !troop.dead
    && troop.type !== "thermalPlatform"
    && troop.countsTowardAlphaPressure !== false).reduce((count, troop) => count + Math.max(1, numeric(troop.alphaPressureCount, 1)), 0);
}

export function startAlphaPressureCycle(session) {
  const state = session?.alphaPressure;
  if (!state?.enabled || state.cycleStartTroopCount != null) return false;
  const count = countPressureTroops(session);
  state.cycleStartTroopCount = count;
  state.previousCycleEndTroopCount = count;
  return true;
}

function shuffleWithSessionRng(rows, rng) {
  for (let index = rows.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.min(index, Math.floor(rng() * (index + 1)));
    [rows[index], rows[swapIndex]] = [rows[swapIndex], rows[index]];
  }
  return rows;
}

export function selectAlphaSpawnRows(session, count) {
  const rng = typeof session?.rng === "function" ? session.rng : () => .5;
  return shuffleWithSessionRng([0, 1, 2, 3, 4], rng).slice(0, Math.max(0, Math.min(MAX_ALPHA_SPAWNS, Math.floor(count) || 0)));
}

export function selectAlphaEnemyTypes(session, config, count) {
  const pool = config?.enemyPool?.length ? config.enemyPool : [config?.enemyType].filter(Boolean);
  if (!pool.length) return [];
  const rng = typeof session?.rng === "function" ? session.rng : () => .5;
  return Array.from({ length: count }, () => pool[Math.min(pool.length - 1, Math.floor(rng() * pool.length))]);
}

export function evaluateAlphaPressureCycle(session, config = session?.phase?.alphaPressure) {
  const state = session?.alphaPressure;
  if (!state?.enabled || !config?.enabled) return { evaluated: false, triggered: false };
  startAlphaPressureCycle(session);
  const troopCountStart = numeric(state.cycleStartTroopCount);
  const troopCountEnd = countPressureTroops(session);
  const metrics = session.metrics.alphaPressure;
  const maximumLevel = Math.max(0, Math.floor(numeric(config.maxLevel, MAX_ALPHA_SPAWNS)));
  state.cycleNumber += 1;
  metrics.cyclesEvaluated += 1;
  let nextLevel = 0;
  if (troopCountEnd < troopCountStart) {
    if (state.level > 0) metrics.resets += 1;
  } else if (state.level === 0) {
    nextLevel = troopCountEnd > troopCountStart ? 1 : 0;
  } else {
    nextLevel = Math.min(maximumLevel, state.level + 1);
  }
  state.level = nextLevel;
  state.cycleStartTroopCount = troopCountEnd;
  state.previousCycleEndTroopCount = troopCountEnd;
  if (nextLevel <= 0) return { evaluated: true, triggered: false, level: 0, troopCountStart, troopCountEnd };

  const alphaCount = Math.min(MAX_ALPHA_SPAWNS, nextLevel);
  const rows = selectAlphaSpawnRows(session, alphaCount);
  const enemyTypes = selectAlphaEnemyTypes(session, config, alphaCount);
  state.lastTriggeredAt = session.elapsed;
  metrics.triggers += 1;
  metrics.peakLevel = Math.max(metrics.peakLevel, nextLevel);
  return { evaluated: true, triggered: true, level: nextLevel, troopCountStart, troopCountEnd, alphaCount, rows, enemyTypes, warningMs: Math.max(0, numeric(config.warningMs, DEFAULT_WARNING_MS)) };
}
