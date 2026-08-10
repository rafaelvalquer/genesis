const clamp = (value, minimum, maximum) => Math.max(minimum, Math.min(maximum, value));

export const THERMAL_STATES = Object.freeze({
  stable: Object.freeze({ heatPerSecond: .5 }),
  active: Object.freeze({ heatPerSecond: 2 }),
  eruption: Object.freeze({ heatPerSecond: 5 }),
  cooldown: Object.freeze({ heatPerSecond: -4 }),
});

export const DEFAULT_THERMAL_CYCLE = Object.freeze([
  Object.freeze({ state: "stable", durationMs: 40000 }),
  Object.freeze({ state: "active", durationMs: 15000 }),
  Object.freeze({ state: "eruption", durationMs: 8000 }),
  Object.freeze({ state: "cooldown", durationMs: 25000 }),
]);

export function createThermalHazard(cells = [], options = {}) {
  return Object.freeze({
    id: "thermal_cycle",
    cells: Object.freeze(cells.map((cell) => Object.freeze([...cell]))),
    cycle: Object.freeze((options.cycle || DEFAULT_THERMAL_CYCLE).map((entry) => Object.freeze({ ...entry }))),
    thermalOverheatDamagePerSecond: options.thermalOverheatDamagePerSecond ?? 4,
    thermalBurnDamagePerSecond: options.thermalBurnDamagePerSecond ?? 6,
    attackSpeedFactor: options.attackSpeedFactor ?? .75,
  });
}

export function getMagmaCells(phase) { return phase?.magmaTerrain?.cells || phase?.environmentHazard?.cells || []; }
export function isMagmaCell(phase, row, col) { return getMagmaCells(phase).some(([r, c]) => r === row && c === col); }
export function isTroopThermalCompatible(troop) { return Boolean(troop?.thermalTerrainCompatible || troop?.canDeployOnMagma); }
export function canSupportThermalPlatform(phase, row, col) { return isMagmaCell(phase, row, col); }

export function createThermalCycleState(config, elapsed = 0) {
  const first = config?.cycle?.[0] || DEFAULT_THERMAL_CYCLE[0];
  return { state: first.state, cycleIndex: 0, stateStartedAt: elapsed, stateEndsAt: elapsed + first.durationMs, heatRatePerSecond: THERMAL_STATES[first.state]?.heatPerSecond ?? 0, eruptionCount: 0, paused: false };
}

export function isThermalHazardActive(session) { return Boolean(session?.waveActive || session?.sandbox); }

export function getSupportAt(session, row, col) { return session.supportStructures?.find((entry) => entry.row === row && entry.col === col && !entry.destroyed) || null; }
export function getThermalPlatformAt(session, row, col) { const support = getSupportAt(session, row, col); return support?.type === "thermalPlatform" ? support : null; }
export function hasThermalPlatform(session, row, col) { return Boolean(getThermalPlatformAt(session, row, col)); }

export function createThermalPlatform(session, row, col, config, id) {
  const platform = { id: id(), type: "thermalPlatform", row, col, hp: config.hp, maxHp: config.hp, heat: 0, maxHeat: config.maxHeat || 100, overheated: false, createdAt: session.elapsed, destroyed: false };
  session.supportStructures.push(platform);
  const troop = session.troops.find((entry) => !entry.dead && entry.row === row && entry.col === col);
  if (troop) { troop.thermalExposed = false; troop.thermalBurning = false; troop.thermalAttackSpeedFactor = 1; }
  return platform;
}

function removeExpiredDestroyedPlatforms(session) {
  session.supportStructures = (session.supportStructures || []).filter((entry) => !entry.destroyed || session.elapsed - entry.destroyedAt < 450);
}

function syncTroopThermalExposure(session, config, hazardActive) {
  for (const troop of session.troops || []) {
    if (troop.dead) continue;
    const onMagma = isMagmaCell(session.phase, troop.row, troop.col);
    const protectedByPlatform = onMagma && hasThermalPlatform(session, troop.row, troop.col);
    const compatible = isTroopThermalCompatible(session.troopConfigs?.[troop.type]);
    const exposed = onMagma && !protectedByPlatform && !compatible;
    troop.thermalExposed = exposed;
    troop.thermalBurning = hazardActive && exposed;
    troop.thermalAttackSpeedFactor = hazardActive && getThermalPlatformAt(session, troop.row, troop.col)?.overheated
      ? config.attackSpeedFactor
      : 1;
  }
}

export function enterThermalIntermission(session) {
  const config = session?.phase?.environmentHazard;
  if (config?.id !== "thermal_cycle") return;
  const cycle = session.thermalCycle || createThermalCycleState(config, session.elapsed);
  cycle.paused = true;
  session.thermalCycle = cycle;
  syncTroopThermalExposure(session, config, false);
}

export function resumeThermalHazard(session) {
  const config = session?.phase?.environmentHazard;
  if (config?.id !== "thermal_cycle") return;
  const cycle = session.thermalCycle || createThermalCycleState(config, session.elapsed);
  cycle.paused = false;
  session.thermalCycle = cycle;
  syncTroopThermalExposure(session, config, true);
}

export function updateThermalTerrain(session, dt, events, { eliminateTroop, refreshTroop }) {
  const config = session.phase?.environmentHazard;
  if (config?.id !== "thermal_cycle") return;
  let cycle = session.thermalCycle || createThermalCycleState(config, session.elapsed);
  const hazardActive = isThermalHazardActive(session);
  // Broken supports still need their short visual handoff while the danger is paused.
  removeExpiredDestroyedPlatforms(session);
  if (!hazardActive) {
    cycle.stateStartedAt += dt;
    cycle.stateEndsAt += dt;
    cycle.paused = true;
    session.thermalCycle = cycle;
    syncTroopThermalExposure(session, config, false);
    session.troops.filter((troop) => !troop.dead && isMagmaCell(session.phase, troop.row, troop.col))
      .forEach((troop) => refreshTroop?.(session, troop));
    return;
  }
  cycle.paused = false;
  while (session.elapsed >= cycle.stateEndsAt) {
    const previous = cycle.state;
    cycle.cycleIndex = (cycle.cycleIndex + 1) % config.cycle.length;
    const next = config.cycle[cycle.cycleIndex];
    cycle.state = next.state; cycle.stateStartedAt = cycle.stateEndsAt; cycle.stateEndsAt += next.durationMs;
    cycle.heatRatePerSecond = THERMAL_STATES[next.state]?.heatPerSecond ?? 0;
    if (next.state === "eruption") cycle.eruptionCount += 1;
    events.push({ type: "thermalCycleChanged", previousState: previous, state: next.state, endsAt: cycle.stateEndsAt });
  }
  session.thermalCycle = cycle;
  const seconds = dt / 1000;
  for (const platform of [...(session.supportStructures || [])]) {
    if (platform.destroyed) continue;
    platform.heat = clamp(platform.heat + cycle.heatRatePerSecond * seconds, 0, platform.maxHeat);
    platform.overheated = platform.heat >= platform.maxHeat;
    if (platform.overheated) {
      platform.hp -= platform.maxHp * (config.thermalOverheatDamagePerSecond / 100) * seconds;
      if (platform.hp <= 0) {
        platform.destroyed = true;
        platform.destroyedAt = session.elapsed;
        const troop = session.troops.find((entry) => !entry.dead && entry.row === platform.row && entry.col === platform.col);
        if (troop && !isTroopThermalCompatible(session.troopConfigs?.[troop.type] || null)) troop.thermalBurning = true;
        events.push({ type: "thermalPlatformDestroyed", row: platform.row, col: platform.col, troopId: troop?.id || null });
        if (troop?.thermalBurning) events.push({ type: "thermalBurnStarted", troopId: troop.id, row: platform.row, col: platform.col });
      }
    }
  }
  // Retain the broken support for a brief visual handoff without letting it
  // support a troop (getSupportAt already excludes destroyed structures).
  removeExpiredDestroyedPlatforms(session);
  syncTroopThermalExposure(session, config, true);
  session.troops.filter((troop) => !troop.dead && isMagmaCell(session.phase, troop.row, troop.col))
    .forEach((troop) => refreshTroop?.(session, troop));
  for (const troop of session.troops.filter((entry) => !entry.dead && entry.thermalBurning)) {
    if (troop.thermalBurning) {
      const damage = troop.maxHp * (config.thermalBurnDamagePerSecond / 100) * seconds;
      troop.hp -= damage;
      if (session.thermalMetrics) session.thermalMetrics.burnDamage += damage;
      if (troop.hp <= 0) { if (session.thermalMetrics) session.thermalMetrics.troopsLost += 1; eliminateTroop(session, troop, events, "thermalBurn"); }
    }
  }
  if (session.supportStructures.length && session.thermalMetrics) {
    session.thermalMetrics.heatSampleTotal += session.supportStructures.reduce((sum, platform) => sum + platform.heat, 0) / session.supportStructures.length;
    session.thermalMetrics.heatSampleCount += 1;
  }
}

export function getThermalSnapshot(session) {
  const cycle = session?.thermalCycle;
  return { state: cycle?.state || null, nextStateAt: cycle?.stateEndsAt || null, remainingMs: cycle ? Math.max(0, cycle.stateEndsAt - session.elapsed) : 0, paused: Boolean(cycle?.paused), heatRate: cycle?.paused ? 0 : cycle?.heatRatePerSecond || 0, eruptionCount: cycle?.eruptionCount || 0, platforms: (session?.supportStructures || []).map(({ id, row, col, hp, maxHp, heat, maxHeat, overheated }) => ({ id, row, col, hp, maxHp, heat, maxHeat, overheated })) };
}
