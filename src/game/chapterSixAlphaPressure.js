const DEFAULT_WARNING_MS = 1800;

export const CHAPTER_SIX_ALPHA_MODIFIERS = Object.freeze({
  hpMultiplier: 1.65, damageMultiplier: 1.25, speedMultiplier: 1.10, scaleMultiplier: 1.12,
});
const numeric = (value, fallback = 0) => Number.isFinite(value) ? value : fallback;

export function createAlphaPressureState(config) {
  return { enabled: Boolean(config?.enabled), nextCheckAt: Infinity, checksThisWave: 0, failedChecksThisWave: 0, spawnsThisWave: 0, totalAlphaSpawned: 0, lastCheckAt: null, lastTriggeredAt: null, lastSpawnType: null, lastSpawnRow: null, pendingSpawns: [] };
}

export function countPressureTroops(session) {
  return (session?.troops || []).filter((troop) => !troop.dead && troop.type !== "thermalPlatform" && troop.countsTowardAlphaPressure !== false)
    .reduce((count, troop) => count + Math.max(1, numeric(troop.alphaPressureCount, 1)), 0);
}

export function resetAlphaPressureForWave(session, config = session?.phase?.alphaPressure) {
  const state = session?.alphaPressure;
  if (!state) return false;
  state.enabled = Boolean(config?.enabled);
  state.nextCheckAt = state.enabled ? session.elapsed + numeric(config.firstCheckDelayMs, 18000) : Infinity;
  state.checksThisWave = 0; state.failedChecksThisWave = 0; state.spawnsThisWave = 0; state.lastCheckAt = null; state.lastTriggeredAt = null;
  state.lastSpawnType = null; state.lastSpawnRow = null; state.pendingSpawns = [];
  return true;
}

export function calculateAlphaChance(troopCount, config = {}) {
  if (troopCount < numeric(config.minTroops, 5)) return 0;
  return Math.min(numeric(config.maxChance, .4), numeric(config.baseChance, .04) + (troopCount - numeric(config.minTroops, 5)) * numeric(config.chancePerExtraTroop, .035));
}

export function hasActiveAlpha(session, config = session?.phase?.alphaPressure) {
  const activeCount = (session?.alphaPressure?.pendingSpawns || []).length
    + (session?.enemies || []).filter((enemy) => !enemy.dead && enemy.variant === "alpha" && enemy.spawnSource === "alphaPressure").length;
  return activeCount >= Math.max(1, numeric(config?.maximumAlphaAlive, 1));
}

export function getAlphaEligibleEnemyTypes(session, config = session?.phase?.alphaPressure, enemyCatalog = {}) {
  const wave = session?.phase?.waves?.[session.waveIndex];
  const waveTypes = [...(wave?.enemies || []).map((entry) => entry.type), ...(session?.queue || []).map((entry) => entry.type), ...(session?.enemies || []).filter((enemy) => !enemy.dead && enemy.spawnSource !== "alphaPressure").map((enemy) => enemy.type)];
  const candidates = config?.enemyPool?.length ? config.enemyPool : waveTypes;
  let eligible = [...new Set(candidates)].filter((type) => {
    const entry = enemyCatalog[type] || {};
    return type && entry.boss !== true && entry.allowAlphaVariant !== false && entry.summoned !== true && entry.hiddenFromCatalog !== true;
  });
  if (eligible.length > 1 && statefulLastType(session)) eligible = eligible.filter((type) => type !== statefulLastType(session));
  if (eligible.length) return eligible;
  return [...new Set(waveTypes)].filter((type) => enemyCatalog[type]?.boss !== true && enemyCatalog[type]?.allowAlphaVariant !== false);
}

function statefulLastType(session) { return session?.alphaPressure?.lastSpawnType || null; }

function selectAlphaSpawnRow(session, state) {
  const previous = Number.isInteger(state.lastSpawnRow) ? state.lastSpawnRow : null;
  const rows = Array.from({ length: 5 }, (_, row) => row).filter((row) => row !== previous);
  return rows[Math.min(rows.length - 1, Math.floor(session.rng() * rows.length))] ?? 0;
}

export function evaluateAlphaPressure(session, config = session?.phase?.alphaPressure, enemyCatalog = {}) {
  const state = session?.alphaPressure;
  if (!state?.enabled || !config?.enabled || !session.waveActive || session.elapsed < state.nextCheckAt) return null;
  state.lastCheckAt = session.elapsed; state.checksThisWave += 1; state.nextCheckAt = session.elapsed + numeric(config.checkEveryMs, 12000);
  const troopCount = countPressureTroops(session);
  const result = { checked: true, triggered: false, troopCount, chance: calculateAlphaChance(troopCount, config), nextCheckAt: state.nextCheckAt };
  if (troopCount < numeric(config.minTroops, 5) || hasActiveAlpha(session, config)) return result;
  const failures = state.failedChecksThisWave || 0;
  const adjustedChance = failures >= 3
    ? 1
    : Math.min(numeric(config.maxChance, .4), result.chance + (failures >= 2 ? .10 : failures >= 1 ? .05 : 0));
  result.chance = adjustedChance;
  if (session.rng() >= adjustedChance) { state.failedChecksThisWave = failures + 1; return result; }
  state.failedChecksThisWave = 0;
  const types = getAlphaEligibleEnemyTypes(session, config, enemyCatalog);
  if (!types.length) return result;
  const type = types[Math.min(types.length - 1, Math.floor(session.rng() * types.length))];
  const row = selectAlphaSpawnRow(session, state);
  state.lastTriggeredAt = session.elapsed; state.lastSpawnType = type; state.lastSpawnRow = row;
  return { ...result, triggered: true, type, row, warningMs: numeric(config.warningMs, DEFAULT_WARNING_MS) };
}

export const updateAlphaPressure = evaluateAlphaPressure;
