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
export function getTemporaryMagmaAt(session, row, col) {
  return (session?.temporaryMagmaHazards || []).find((hazard) => hazard.active
    && hazard.row === row && hazard.col === col) || null;
}
export function isSessionMagmaCell(session, row, col) {
  return isMagmaCell(session?.phase, row, col) || Boolean(getTemporaryMagmaAt(session, row, col));
}
export function createTemporaryMagmaHazard(session, row, col, sourceEnemyId, durationMs = 8000, visualDurationMs = 600, type = "temporaryMagma") {
  session.temporaryMagmaHazards ||= [];
  const hazard = {
    id: `incubator_fissure_${session.temporaryMagmaHazards.length + 1}_${Math.round(session.elapsed)}`,
    type,
    sourceEnemyId,
    row,
    col,
    thermalState: "eruption",
    startedAt: session.elapsed,
    endsAt: session.elapsed + durationMs,
    visualEndsAt: session.elapsed + durationMs + visualDurationMs,
    active: true,
  };
  session.temporaryMagmaHazards.push(hazard);
  return hazard;
}
// Compatibility wrapper for the Incubator and existing save/replay contracts.
export function createTemporaryMagmaEruption(session, row, col, sourceEnemyId, durationMs = 8000, visualDurationMs = 600) {
  return createTemporaryMagmaHazard(session, row, col, sourceEnemyId, durationMs, visualDurationMs, "incubatorEruption");
}
export function updateTemporaryMagmaHazards(session, events = []) {
  for (const hazard of session.temporaryMagmaHazards || []) {
    if (hazard.active && session.elapsed >= hazard.endsAt) hazard.active = false;
    if (!hazard.active && session.elapsed >= hazard.visualEndsAt) {
      const platform = session.supportStructures?.find((entry) => entry.temporaryHazardId === hazard.id && !entry.destroyed);
      if (platform) {
        platform.destroyed = true;
        platform.destroyedAt = session.elapsed;
        const freePlacement = session.sandbox && session.sandboxSettings?.rulesMode === "free";
        if (!freePlacement) session.energy = Math.min(session.energyMax, session.energy + Math.round((platform.paidEnergy || 8) * .5));
        events.push({ type: "thermalPlatformReclaimed", supportId: platform.id, row: platform.row, col: platform.col, refund: freePlacement ? 0 : Math.round((platform.paidEnergy || 8) * .5) });
      }
    }
  }
  session.temporaryMagmaHazards = (session.temporaryMagmaHazards || [])
    .filter((hazard) => session.elapsed < hazard.visualEndsAt);
}
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

export function coolThermalPlatform(session, row, col, coolingPercent, sourceTroopId = null, events = []) {
  const platform = getThermalPlatformAt(session, row, col);
  if (!platform) return 0;
  const amount = Math.max(0, Number(platform.maxHeat) || 0) * Math.max(0, Number(coolingPercent) || 0);
  const previous = platform.heat;
  platform.heat = Math.max(0, platform.heat - amount);
  const removed = previous - platform.heat;
  if (removed > 0) {
    events.push({
      type: "thermalPlatformCooled", sourceTroopId, supportId: platform.id, row, col,
      x: col * 100 + 50, y: row * 70 + 35, amount: removed, heat: platform.heat,
    });
  }
  return removed;
}

export function createThermalPlatform(session, row, col, config, id) {
  const platform = { id: id(), type: "thermalPlatform", row, col, hp: config.hp, maxHp: config.hp, heat: 0, maxHeat: config.maxHeat || 100, overheated: false, createdAt: session.elapsed, destroyed: false, paidEnergy: config.price || 8 };
  session.supportStructures.push(platform);
  const troop = session.troops.find((entry) => !entry.dead && entry.row === row && entry.col === col);
  if (troop) { if (troop.thermalBurning) troop.thermalBurnEndedAt = session.elapsed; troop.thermalExposed = false; troop.thermalBurning = false; troop.thermalAttackSpeedFactor = 1; }
  return platform;
}

export function renewThermalPlatform(session, platform, config) {
  const previousHeat = platform.heat;
  const previousHp = platform.hp;
  platform.hp = config.hp;
  platform.maxHp = config.hp;
  platform.heat = 0;
  platform.maxHeat = config.maxHeat || 100;
  platform.overheated = false;
  platform.destroyed = false;
  platform.renewedAt = session.elapsed;
  platform.renewalCount = (platform.renewalCount || 0) + 1;
  const troop = session.troops.find((entry) => !entry.dead
    && entry.row === platform.row && entry.col === platform.col);
  if (troop) {
    troop.thermalExposed = false;
    troop.thermalBurning = false;
    troop.thermalBurnEndedAt = session.elapsed;
    troop.thermalAttackSpeedFactor = 1;
  }
  return { platform, previousHeat, previousHp };
}

function removeExpiredDestroyedPlatforms(session) {
  session.supportStructures = (session.supportStructures || []).filter((entry) => !entry.destroyed || session.elapsed - entry.destroyedAt < 450);
}

function syncTroopThermalExposure(session, config, hazardActive) {
  for (const troop of session.troops || []) {
    if (troop.dead) continue;
    const onMagma = isSessionMagmaCell(session, troop.row, troop.col);
    const protectedByPlatform = onMagma && hasThermalPlatform(session, troop.row, troop.col);
    const compatible = isTroopThermalCompatible(session.troopConfigs?.[troop.type]);
    const exposed = onMagma && !protectedByPlatform && !compatible;
    const burning = hazardActive && exposed;
    if (burning && !troop.thermalBurning) troop.thermalBurnStartedAt = session.elapsed;
    if (!burning && troop.thermalBurning) troop.thermalBurnEndedAt = session.elapsed;
    troop.thermalExposed = exposed;
    troop.thermalBurning = burning;
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
  updateTemporaryMagmaHazards(session, events);
  let cycle = session.thermalCycle || createThermalCycleState(config, session.elapsed);
  const hazardActive = isThermalHazardActive(session);
  const forcedState = session.sandbox && session.sandboxSettings?.magmaThermalState;
  if (hazardActive && forcedState && forcedState !== "auto" && THERMAL_STATES[forcedState]) {
    cycle.state = forcedState;
    cycle.cycleIndex = -1;
    cycle.stateStartedAt = session.elapsed;
    cycle.stateEndsAt = Infinity;
    cycle.heatRatePerSecond = THERMAL_STATES[forcedState].heatPerSecond;
    cycle.paused = false;
  }
  // Broken supports still need their short visual handoff while the danger is paused.
  removeExpiredDestroyedPlatforms(session);
  if (!hazardActive) {
    cycle.stateStartedAt += dt;
    cycle.stateEndsAt += dt;
    cycle.paused = true;
    session.thermalCycle = cycle;
    syncTroopThermalExposure(session, config, false);
    session.troops.filter((troop) => !troop.dead && isSessionMagmaCell(session, troop.row, troop.col))
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
    if (cycle.cycleIndex === 0) {
      cycle.completedCycles = (cycle.completedCycles || 0) + 1;
      events.push({ type: "thermalCycleCompleted", cycleNumber: cycle.completedCycles, previousState: previous, state: next.state });
    }
  }
  session.thermalCycle = cycle;
  const seconds = dt / 1000;
  for (const platform of [...(session.supportStructures || [])]) {
    if (platform.destroyed) continue;
      const localHazard = getTemporaryMagmaAt(session, platform.row, platform.col);
      const heatRate = localHazard ? THERMAL_STATES.eruption.heatPerSecond : cycle.heatRatePerSecond;
      platform.heat = clamp(platform.heat + heatRate * seconds, 0, platform.maxHeat);
    platform.overheated = platform.overheated
      ? platform.heat > platform.maxHeat * 0.95
      : platform.heat >= platform.maxHeat;
    if (platform.overheated) {
      platform.hp -= platform.maxHp * (config.thermalOverheatDamagePerSecond / 100) * seconds;
      if (platform.hp <= 0) {
        platform.destroyed = true;
        platform.destroyedAt = session.elapsed;
        const troop = session.troops.find((entry) => !entry.dead && entry.row === platform.row && entry.col === platform.col);
        if (troop && !isTroopThermalCompatible(session.troopConfigs?.[troop.type] || null)) {
          if (!troop.thermalBurning) troop.thermalBurnStartedAt = session.elapsed;
          troop.thermalBurning = true;
        }
        events.push({ type: "thermalPlatformDestroyed", row: platform.row, col: platform.col, troopId: troop?.id || null });
        if (troop?.thermalBurning) events.push({ type: "thermalBurnStarted", troopId: troop.id, row: platform.row, col: platform.col });
      }
    }
  }
  // Retain the broken support for a brief visual handoff without letting it
  // support a troop (getSupportAt already excludes destroyed structures).
  removeExpiredDestroyedPlatforms(session);
  syncTroopThermalExposure(session, config, true);
  session.troops.filter((troop) => !troop.dead && isSessionMagmaCell(session, troop.row, troop.col))
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
  const forcedState = session?.sandbox && session.sandboxSettings?.magmaThermalState;
  const state = forcedState && forcedState !== "auto" && THERMAL_STATES[forcedState] ? forcedState : cycle?.state || null;
  const heatRate = forcedState && forcedState !== "auto" && THERMAL_STATES[forcedState]
    ? THERMAL_STATES[forcedState].heatPerSecond
    : cycle?.paused ? 0 : cycle?.heatRatePerSecond || 0;
  return { state, nextStateAt: cycle?.stateEndsAt || null, remainingMs: cycle ? Math.max(0, cycle.stateEndsAt - session.elapsed) : 0, paused: Boolean(cycle?.paused), heatRate, eruptionCount: cycle?.eruptionCount || 0, platforms: (session?.supportStructures || []).map(({ id, row, col, hp, maxHp, heat, maxHeat, overheated }) => ({ id, row, col, hp, maxHp, heat, maxHeat, overheated })) };
}
