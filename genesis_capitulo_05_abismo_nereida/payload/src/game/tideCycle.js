import { CELL, FIELD } from "./visualGeometry.js";

export const TIDE_CYCLE_STATES = Object.freeze([
  "idle",
  "warning",
  "rising",
  "high",
  "receding",
]);

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const livingTroops = (session) => session.troops.filter((troop) => !troop.dead);

export function createTideCycleHazard(chapterIndex = 0, overrides = {}) {
  return {
    id: "tide_cycle",
    minTroops: 5,
    firstCheckDelayMs: 20000,
    checkEveryMs: 12000,
    warningMs: 3000,
    risingMs: 1800,
    highDurationMs: 8500 + chapterIndex * 450,
    recedingMs: 1800,
    baseChance: 0.18 + chapterIndex * 0.012,
    chancePerExtraTroop: 0.025,
    maxChance: Math.min(0.52, 0.4 + chapterIndex * 0.015),
    repeatLossToleranceRatio: 0,
    floodedFromCol: Math.max(5, 8 - Math.floor(chapterIndex / 2)),
    enemySpeedFactor: 1.15 + Math.min(0.12, chapterIndex * 0.015),
    ...overrides,
  };
}

export function createTideCycleState() {
  return {
    state: "idle",
    warningStartedAt: -Infinity,
    startsAt: Infinity,
    risingStartedAt: Infinity,
    highStartsAt: Infinity,
    endsAt: Infinity,
    recedingStartedAt: Infinity,
    recedingEndsAt: Infinity,
    nextCheckAt: Infinity,
    tidesThisWave: 0,
    floodedFromCol: FIELD.enemyEntryCol,
    troopCountAtStart: 0,
    troopCountAtEnd: 0,
    troopLossCount: 0,
    troopLossRatio: 0,
    repeatLossToleranceRatio: 0,
    repeatEligible: true,
    eliminatedTroopIds: [],
  };
}

export function resetTideCycleForWave(session, config = session.phase?.environmentHazard) {
  session.tideCycle = {
    ...createTideCycleState(),
    floodedFromCol: config?.floodedFromCol ?? FIELD.enemyEntryCol,
    repeatLossToleranceRatio: config?.repeatLossToleranceRatio || 0,
    nextCheckAt: config?.id === "tide_cycle"
      ? session.elapsed + config.firstCheckDelayMs
      : Infinity,
  };
  return session.tideCycle;
}

export function recordTideTroopElimination(session, troop, reason = "enemy") {
  const tide = session?.tideCycle;
  if (!tide || tide.state !== "high" || !troop?.id || reason === "remove") return false;
  if (tide.eliminatedTroopIds.includes(troop.id)) return false;
  tide.eliminatedTroopIds.push(troop.id);
  tide.troopLossCount = tide.eliminatedTroopIds.length;
  return true;
}

function startWarning(session, config, events) {
  const tide = session.tideCycle;
  tide.state = "warning";
  tide.warningStartedAt = session.elapsed;
  tide.startsAt = session.elapsed + config.warningMs;
  tide.floodedFromCol = clamp(
    Math.round(config.floodedFromCol),
    FIELD.firstTroopCol,
    FIELD.enemyEntryCol,
  );
  events.push({
    type: "tideWarning",
    startsAt: tide.startsAt,
    floodedFromCol: tide.floodedFromCol,
  });
}

function startRising(session, config, events) {
  const tide = session.tideCycle;
  tide.state = "rising";
  tide.risingStartedAt = session.elapsed;
  tide.highStartsAt = session.elapsed + config.risingMs;
  events.push({
    type: "tideRisingStarted",
    highStartsAt: tide.highStartsAt,
    floodedFromCol: tide.floodedFromCol,
  });
}

function startHighTide(session, config, events) {
  const tide = session.tideCycle;
  tide.state = "high";
  tide.highStartsAt = session.elapsed;
  tide.endsAt = session.elapsed + config.highDurationMs;
  tide.tidesThisWave += 1;
  tide.troopCountAtStart = livingTroops(session).length;
  tide.troopCountAtEnd = 0;
  tide.troopLossCount = 0;
  tide.troopLossRatio = 0;
  tide.eliminatedTroopIds = [];
  tide.repeatLossToleranceRatio = config.repeatLossToleranceRatio || 0;
  events.push({
    type: "tideHighStarted",
    tideNumber: tide.tidesThisWave,
    endsAt: tide.endsAt,
    floodedFromCol: tide.floodedFromCol,
    enemySpeedFactor: config.enemySpeedFactor,
  });
}

function startReceding(session, config, events) {
  const tide = session.tideCycle;
  tide.troopCountAtEnd = livingTroops(session).length;
  tide.troopLossCount = tide.eliminatedTroopIds.length;
  tide.troopLossRatio = tide.troopCountAtStart > 0
    ? tide.troopLossCount / tide.troopCountAtStart
    : 0;
  const toleranceBasisPoints = Math.round((config.repeatLossToleranceRatio || 0) * 10000);
  tide.repeatEligible = tide.troopLossCount * 10000
    <= tide.troopCountAtStart * toleranceBasisPoints;
  tide.state = "receding";
  tide.recedingStartedAt = session.elapsed;
  tide.recedingEndsAt = session.elapsed + config.recedingMs;
  tide.nextCheckAt = tide.repeatEligible
    ? tide.recedingEndsAt + config.checkEveryMs
    : Infinity;
  events.push({
    type: "tideRecedingStarted",
    tideNumber: tide.tidesThisWave,
    recedingEndsAt: tide.recedingEndsAt,
    troopCountAtStart: tide.troopCountAtStart,
    troopCountAtEnd: tide.troopCountAtEnd,
    troopLossCount: tide.troopLossCount,
    repeatEligible: tide.repeatEligible,
  });
}

export function endTideCycle(session, events = [], forced = false) {
  const tide = session?.tideCycle;
  if (!tide || tide.state === "idle") return tide;
  const previousState = tide.state;
  tide.state = "idle";
  tide.warningStartedAt = -Infinity;
  tide.startsAt = Infinity;
  tide.risingStartedAt = Infinity;
  tide.highStartsAt = Infinity;
  tide.endsAt = Infinity;
  tide.recedingStartedAt = Infinity;
  tide.recedingEndsAt = Infinity;
  if (forced) {
    tide.repeatEligible = false;
    tide.nextCheckAt = Infinity;
  }
  events.push({
    type: "tideLowStarted",
    forced,
    previousState,
    tideNumber: tide.tidesThisWave,
    repeatEligible: tide.repeatEligible,
  });
  return tide;
}

export function updateTideCycle(session, events = []) {
  const config = session.phase?.environmentHazard;
  const tide = session.tideCycle;
  if (!tide || config?.id !== "tide_cycle" || !session.waveActive) return events;

  if (tide.state === "warning") {
    if (session.elapsed >= tide.startsAt) startRising(session, config, events);
    return events;
  }
  if (tide.state === "rising") {
    if (session.elapsed >= tide.highStartsAt) startHighTide(session, config, events);
    return events;
  }
  if (tide.state === "high") {
    if (session.elapsed >= tide.endsAt) startReceding(session, config, events);
    return events;
  }
  if (tide.state === "receding") {
    if (session.elapsed >= tide.recedingEndsAt) endTideCycle(session, events, false);
    return events;
  }
  if (tide.state !== "idle" || !tide.repeatEligible || session.elapsed < tide.nextCheckAt) return events;

  tide.nextCheckAt += config.checkEveryMs;
  const activeTroops = livingTroops(session);
  if (activeTroops.length < config.minTroops) return events;
  const chance = Math.min(
    config.maxChance,
    config.baseChance + (activeTroops.length - config.minTroops) * config.chancePerExtraTroop,
  );
  if (session.rng() >= chance) return events;
  startWarning(session, config, events);
  return events;
}

export function getTideEnemySpeedFactor(session, enemy) {
  const config = session?.phase?.environmentHazard;
  const tide = session?.tideCycle;
  if (config?.id !== "tide_cycle" || tide?.state !== "high" || !enemy || enemy.dead) return 1;
  const floodedFromCol = tide.floodedFromCol ?? config.floodedFromCol ?? FIELD.enemyEntryCol;
  const floodedStartX = floodedFromCol * CELL.width;
  return enemy.x >= floodedStartX ? config.enemySpeedFactor || 1 : 1;
}

export function getTideWaterlineX(session, now = session?.elapsed || 0) {
  const config = session?.phase?.environmentHazard;
  const tide = session?.tideCycle;
  if (config?.id !== "tide_cycle" || !tide) return FIELD.width;
  const target = clamp(tide.floodedFromCol * CELL.width, 0, FIELD.width);
  if (tide.state === "high") return target;
  if (tide.state === "rising") {
    const progress = clamp((now - tide.risingStartedAt) / Math.max(1, config.risingMs), 0, 1);
    const eased = progress * progress * (3 - 2 * progress);
    return FIELD.width + (target - FIELD.width) * eased;
  }
  if (tide.state === "receding") {
    const progress = clamp((now - tide.recedingStartedAt) / Math.max(1, config.recedingMs), 0, 1);
    const eased = progress * progress * (3 - 2 * progress);
    return target + (FIELD.width - target) * eased;
  }
  return FIELD.width;
}

export function getTideSnapshot(session) {
  const tide = session?.tideCycle || createTideCycleState();
  const now = session?.elapsed || 0;
  const remainingMs = tide.state === "warning"
    ? Math.max(0, tide.startsAt - now)
    : tide.state === "rising"
      ? Math.max(0, tide.highStartsAt - now)
      : tide.state === "high"
        ? Math.max(0, tide.endsAt - now)
        : tide.state === "receding"
          ? Math.max(0, tide.recedingEndsAt - now)
          : 0;
  return {
    state: tide.state,
    floodedFromCol: tide.floodedFromCol,
    tidesThisWave: tide.tidesThisWave,
    remainingMs,
    nextCheckInMs: Number.isFinite(tide.nextCheckAt)
      ? Math.max(0, tide.nextCheckAt - now)
      : 0,
    troopCountAtStart: tide.troopCountAtStart,
    troopCountAtEnd: tide.troopCountAtEnd,
    troopLossCount: tide.troopLossCount,
    troopLossRatio: tide.troopLossRatio,
    repeatLossToleranceRatio: tide.repeatLossToleranceRatio,
    repeatEligible: tide.repeatEligible,
    eliminatedTroopIds: [...tide.eliminatedTroopIds],
  };
}
