import { CELL, FIELD } from "./visualGeometry.js";

export const WIND_CURRENT_DIRECTIONS = Object.freeze([
  "headwind",
  "tailwind",
  "lateral",
]);

const WIND_CLASS_WEIGHTS = Object.freeze({
  light: 4,
  medium: 2,
  heavy: 1,
  structure: 0,
});

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const livingTroops = (session) => session.troops.filter((troop) => !troop.dead);
const actionableTroops = (session) =>
  livingTroops(session).filter((troop) => !troop.windRecovery);

export function createWindCurrentHazard(
  chapterIndex,
  directionWeights = { headwind: 0.5, tailwind: 0.4, lateral: 0.1 },
  affectedRouteRange = [1, 1],
) {
  return {
    id: "wind_current",
    minTroops: 5,
    firstCheckDelayMs: 18000,
    checkEveryMs: 12000,
    warningMs: 2500,
    recoveryMs: 2000,
    durationMs: 7000 + chapterIndex * 400,
    primaryGustDelayMs: 1200,
    baseChance: 0.04 + chapterIndex * 0.01,
    chancePerExtraTroop: 0.035,
    maxChance: 0.4,
    repeatLossToleranceRatio: 0.1,
    troopShiftColumns: 1,
    enemyLongitudinalPushTiles: 0.75,
    lateralEnemyMinRatio: 0.2,
    lateralEnemyMaxRatio: 0.4,
    emergencyFallDurationMs: 8000,
    emergencyFallHpFactor: 0.25,
    directionWeights: { ...directionWeights },
    affectedRouteRange: [...affectedRouteRange],
  };
}

export function createWindCurrentState() {
  return {
    state: "idle",
    warningStartedAt: -Infinity,
    startsAt: Infinity,
    endsAt: Infinity,
    recoveryStartedAt: Infinity,
    recoveryEndsAt: Infinity,
    nextCheckAt: Infinity,
    currentsThisWave: 0,
    direction: null,
    verticalDirection: null,
    selectedRows: [],
    sourceRow: null,
    targetRow: null,
    primaryGustAt: Infinity,
    displacementApplied: false,
    selectedTroopId: null,
    shiftedTroopIds: [],
    shiftedEnemyIds: [],
    ejectedEnemyIds: [],
    troopCountAtStart: 0,
    troopCountAtEnd: 0,
    troopLossCount: 0,
    troopLossRatio: 0,
    repeatLossToleranceRatio: 0,
    repeatEligible: true,
    recoveryQueue: [],
  };
}

export function resetWindCurrentForWave(session, config = session.phase?.environmentHazard) {
  const recoveryQueue = session.windCurrent?.recoveryQueue || [];
  session.windCurrent = {
    ...createWindCurrentState(),
    recoveryQueue,
    repeatLossToleranceRatio: config?.repeatLossToleranceRatio || 0,
    nextCheckAt: config?.id === "wind_current"
      ? session.elapsed + config.firstCheckDelayMs
      : Infinity,
  };
  return session.windCurrent;
}

function weightedPick(entries, getWeight, rng) {
  const weighted = entries
    .map((entry) => ({ entry, weight: Math.max(0, Number(getWeight(entry)) || 0) }))
    .filter(({ weight }) => weight > 0);
  const total = weighted.reduce((sum, item) => sum + item.weight, 0);
  if (!total) return null;
  let roll = rng() * total;
  for (const item of weighted) {
    roll -= item.weight;
    if (roll <= 0) return item.entry;
  }
  return weighted.at(-1).entry;
}

function shuffled(values, rng) {
  const result = [...values];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(rng() * (index + 1));
    [result[index], result[swap]] = [result[swap], result[index]];
  }
  return result;
}

function selectDirection(config, rng) {
  return weightedPick(
    WIND_CURRENT_DIRECTIONS,
    (direction) => config.directionWeights?.[direction] || 0,
    rng,
  ) || "headwind";
}

function selectDistinctRows(amount, rng) {
  return shuffled(Array.from({ length: FIELD.rows }, (_, row) => row), rng)
    .slice(0, clamp(amount, 1, FIELD.rows))
    .sort((left, right) => left - right);
}

function selectRouteCount(config, rng) {
  const [minimum = 1, maximum = minimum] = config.affectedRouteRange || [1, 1];
  const min = clamp(Math.round(minimum), 1, FIELD.rows);
  const max = clamp(Math.round(maximum), min, FIELD.rows);
  return min + Math.floor(rng() * (max - min + 1));
}

function prepareDirection(session, config) {
  const wind = session.windCurrent;
  wind.direction = selectDirection(config, session.rng);
  wind.verticalDirection = null;
  wind.selectedRows = [];
  wind.sourceRow = null;
  wind.targetRow = null;
  if (wind.direction === "lateral") {
    wind.sourceRow = Math.floor(session.rng() * FIELD.rows);
    wind.verticalDirection = session.rng() < 0.5 ? -1 : 1;
    wind.targetRow = wind.sourceRow + wind.verticalDirection;
    wind.selectedRows = [wind.sourceRow];
  } else {
    wind.selectedRows = selectDistinctRows(selectRouteCount(config, session.rng), session.rng);
  }
}

function eventDirectionPayload(wind) {
  return {
    direction: wind.direction,
    verticalDirection: wind.verticalDirection,
    selectedRows: [...wind.selectedRows],
    sourceRow: wind.sourceRow,
    targetRow: wind.targetRow,
  };
}

function cellReservedByRecovery(session, row, col, ignoreTroopId = null) {
  return session.windCurrent.recoveryQueue.some((entry) =>
    entry.troopId !== ignoreTroopId
    && entry.originalRow === row
    && entry.originalCol === col);
}

function cellBlocked(session, row, col, dependencies = {}, ignoreTroopId = null) {
  if (row < 0 || row >= FIELD.rows || col < FIELD.firstTroopCol || col > FIELD.lastTroopCol) return true;
  if (session.troops.some((troop) =>
    !troop.dead && !troop.windRecovery && troop.id !== ignoreTroopId
    && troop.row === row && troop.col === col)) return true;
  if (session.mines.some((mine) => mine.active && mine.row === row && mine.col === col)) return true;
  if (session.projectiles.some((projectile) =>
    projectile.active && projectile.kind === "mine"
    && projectile.targetRow === row && projectile.targetCol === col)) return true;
  if (dependencies.isCellReserved?.(session, row, col)) return true;
  return cellReservedByRecovery(session, row, col, ignoreTroopId);
}

function moveTroop(troop, row, col, now, events, type = "windTroopShifted", extra = {}) {
  const from = { row: troop.row, col: troop.col, x: troop.x, y: troop.y };
  troop.row = row;
  troop.col = col;
  troop.x = col * CELL.width + CELL.width / 2;
  troop.y = row * CELL.height + CELL.height / 2;
  troop.previousRenderX = troop.x;
  troop.previousRenderY = troop.y;
  troop.windMotion = {
    fromX: from.x,
    fromY: from.y,
    toX: troop.x,
    toY: troop.y,
    startedAt: now,
    endsAt: now + 600,
  };
  events.push({
    type,
    troopId: troop.id,
    troopType: troop.type,
    from,
    to: { row, col, x: troop.x, y: troop.y },
    startedAt: now,
    durationMs: 600,
    ...extra,
  });
}

function tryHeadwindTroopShift(session, row, dependencies, events) {
  const candidates = shuffled(
    actionableTroops(session).filter((troop) =>
      troop.row === row
      && (dependencies.troops?.[troop.type]?.windClass || "medium") !== "structure"),
    session.rng,
  );
  for (const troop of candidates) {
    const targetCol = troop.col - 1;
    if (cellBlocked(session, row, targetCol, dependencies, troop.id)) continue;
    moveTroop(troop, row, targetCol, session.elapsed, events);
    session.windCurrent.shiftedTroopIds.push(troop.id);
    return true;
  }
  return false;
}

function openLateralDestination(session, row, col, dependencies, events) {
  if (!cellBlocked(session, row, col, dependencies)) return true;
  let freeCol = null;
  for (let candidate = col + 1; candidate <= FIELD.lastTroopCol; candidate += 1) {
    const occupant = session.troops.find((troop) =>
      !troop.dead && !troop.windRecovery && troop.row === row && troop.col === candidate);
    if (occupant && dependencies.troops?.[occupant.type]?.windClass === "structure") return false;
    if (!cellBlocked(session, row, candidate, dependencies)) {
      freeCol = candidate;
      break;
    }
  }
  if (freeCol == null) return false;
  for (let current = freeCol - 1; current >= col; current -= 1) {
    const occupant = session.troops.find((troop) =>
      !troop.dead && !troop.windRecovery && troop.row === row && troop.col === current);
    if (!occupant || dependencies.troops?.[occupant.type]?.windClass === "structure") return false;
    moveTroop(
      occupant,
      row,
      current + 1,
      session.elapsed,
      events,
      "windTroopChainShifted",
      { chain: true },
    );
    session.windCurrent.shiftedTroopIds.push(occupant.id);
  }
  return !cellBlocked(session, row, col, dependencies);
}

function ejectTroop(session, troop, config, events) {
  const wind = session.windCurrent;
  const entry = {
    troopId: troop.id,
    troopType: troop.type,
    originalRow: troop.row,
    originalCol: troop.col,
    removedAt: session.elapsed,
    returnsAt: session.elapsed + config.emergencyFallDurationMs,
    hpBeforeFall: troop.hp,
    damageAmount: troop.maxHp * config.emergencyFallHpFactor,
    status: "falling",
    direction: wind.verticalDirection,
  };
  troop.hp = Math.max(1, troop.hp - entry.damageAmount);
  troop.windRecovery = true;
  troop.row = -1;
  troop.col = -1;
  wind.recoveryQueue.push(entry);
  wind.selectedTroopId = troop.id;
  wind.shiftedTroopIds.push(troop.id);
  events.push({
    type: "windTroopEjected",
    troopId: troop.id,
    troopType: troop.type,
    entity: {
      ...troop,
      row: entry.originalRow,
      col: entry.originalCol,
      x: entry.originalCol * CELL.width + CELL.width / 2,
      y: entry.originalRow * CELL.height + CELL.height / 2,
    },
    originalRow: entry.originalRow,
    originalCol: entry.originalCol,
    verticalDirection: wind.verticalDirection,
    startedAt: session.elapsed,
    durationMs: 800,
  });
}

function tryLateralTroopShift(session, config, dependencies, events) {
  const wind = session.windCurrent;
  const remaining = actionableTroops(session).filter((troop) =>
    troop.row === wind.sourceRow
    && (dependencies.troops?.[troop.type]?.windClass || "medium") !== "structure");
  while (remaining.length) {
    const troop = weightedPick(
      remaining,
      (entry) => WIND_CLASS_WEIGHTS[dependencies.troops?.[entry.type]?.windClass || "medium"],
      session.rng,
    );
    if (!troop) return false;
    remaining.splice(remaining.indexOf(troop), 1);
    if (wind.targetRow < 0 || wind.targetRow >= FIELD.rows) {
      ejectTroop(session, troop, config, events);
      return true;
    }
    if (!openLateralDestination(session, wind.targetRow, troop.col, dependencies, events)) continue;
    wind.selectedTroopId = troop.id;
    moveTroop(troop, wind.targetRow, troop.col, session.elapsed, events);
    wind.shiftedTroopIds.push(troop.id);
    return true;
  }
  return false;
}

function enemyEligible(enemy, dependencies) {
  const config = dependencies.enemies?.[enemy.type] || {};
  return !enemy.dead && !config.windImmune;
}

function applyLongitudinalEnemyPush(session, config, dependencies, events) {
  const wind = session.windCurrent;
  const direction = wind.direction === "headwind" ? -1 : 1;
  const distance = CELL.width * config.enemyLongitudinalPushTiles;
  session.enemies
    .filter((enemy) => wind.selectedRows.includes(enemy.row) && enemyEligible(enemy, dependencies))
    .forEach((enemy) => {
      const enemyConfig = dependencies.enemies?.[enemy.type] || {};
      const factor = clamp(1 - Number(enemyConfig.windResistance || 0), 0, 1);
      const fromX = enemy.x;
      enemy.x = direction < 0
        ? Math.max(FIELD.baseX, enemy.x - distance * factor)
        : Math.min(FIELD.spawnX, enemy.x + distance * factor);
      enemy.previousRenderX = enemy.x;
      enemy.windMotion = {
        fromX,
        fromY: enemy.y,
        toX: enemy.x,
        toY: enemy.y,
        startedAt: session.elapsed,
        endsAt: session.elapsed + 520,
      };
      wind.shiftedEnemyIds.push(enemy.id);
      events.push({
        type: "windEnemyShifted",
        enemyId: enemy.id,
        enemyType: enemy.type,
        from: { row: enemy.row, x: fromX, y: enemy.y },
        to: { row: enemy.row, x: enemy.x, y: enemy.y },
        startedAt: session.elapsed,
        durationMs: 520,
      });
    });
}

function applyLateralEnemyPush(session, config, dependencies, events) {
  const wind = session.windCurrent;
  const eligible = session.enemies.filter((enemy) =>
    enemy.row === wind.sourceRow && enemyEligible(enemy, dependencies));
  if (!eligible.length) return;
  const ratio = config.lateralEnemyMinRatio
    + session.rng() * (config.lateralEnemyMaxRatio - config.lateralEnemyMinRatio);
  const amount = Math.max(1, Math.round(eligible.length * ratio));
  shuffled(eligible, session.rng).slice(0, amount).forEach((enemy) => {
    const enemyConfig = dependencies.enemies?.[enemy.type] || {};
    const from = { row: enemy.row, x: enemy.x, y: enemy.y };
    if (wind.targetRow < 0 || wind.targetRow >= FIELD.rows) {
      if (enemyConfig.airborne || enemyConfig.canBeWindEjected === false) {
        events.push({
          type: "windEnemyShifted",
          enemyId: enemy.id,
          enemyType: enemy.type,
          from,
          to: { ...from, y: from.y + wind.verticalDirection * 28 },
          resistedEjection: true,
          startedAt: session.elapsed,
          durationMs: 520,
        });
        return;
      }
      enemy.removedByWind = true;
      enemy.dead = true;
      wind.ejectedEnemyIds.push(enemy.id);
      events.push({
        type: "windEnemyEjected",
        enemyId: enemy.id,
        enemyType: enemy.type,
        entity: { ...enemy, dead: false },
        from,
        verticalDirection: wind.verticalDirection,
        startedAt: session.elapsed,
        durationMs: 800,
      });
      return;
    }
    enemy.row = wind.targetRow;
    enemy.y = wind.targetRow * CELL.height + CELL.height / 2;
    enemy.previousRenderY = enemy.y;
    enemy.windMotion = {
      fromX: from.x,
      fromY: from.y,
      toX: enemy.x,
      toY: enemy.y,
      startedAt: session.elapsed,
      endsAt: session.elapsed + 550,
    };
    wind.shiftedEnemyIds.push(enemy.id);
    events.push({
      type: "windEnemyShifted",
      enemyId: enemy.id,
      enemyType: enemy.type,
      from,
      to: { row: enemy.row, x: enemy.x, y: enemy.y },
      startedAt: session.elapsed,
      durationMs: 550,
    });
  });
}

function applyPrimaryGust(session, config, dependencies, events) {
  const wind = session.windCurrent;
  if (wind.displacementApplied) return;
  wind.displacementApplied = true;
  events.push({
    type: "windPrimaryGust",
    ...eventDirectionPayload(wind),
    at: session.elapsed,
  });
  if (wind.direction === "headwind") {
    applyLongitudinalEnemyPush(session, config, dependencies, events);
    wind.selectedRows.forEach((row) => tryHeadwindTroopShift(session, row, dependencies, events));
  } else if (wind.direction === "tailwind") {
    applyLongitudinalEnemyPush(session, config, dependencies, events);
  } else {
    tryLateralTroopShift(session, config, dependencies, events);
    applyLateralEnemyPush(session, config, dependencies, events);
  }
}

function recoveryCandidates(entry) {
  const result = [{ row: entry.originalRow, col: entry.originalCol }];
  for (let distance = 1; distance <= FIELD.lastTroopCol - FIELD.firstTroopCol; distance += 1) {
    for (const col of [entry.originalCol - distance, entry.originalCol + distance]) {
      if (col >= FIELD.firstTroopCol && col <= FIELD.lastTroopCol) {
        result.push({ row: entry.originalRow, col });
      }
    }
  }
  for (const row of [entry.originalRow - 1, entry.originalRow + 1]) {
    if (row < 0 || row >= FIELD.rows) continue;
    result.push({ row, col: entry.originalCol });
    for (let distance = 1; distance <= FIELD.lastTroopCol - FIELD.firstTroopCol; distance += 1) {
      for (const col of [entry.originalCol - distance, entry.originalCol + distance]) {
        if (col >= FIELD.firstTroopCol && col <= FIELD.lastTroopCol) result.push({ row, col });
      }
    }
  }
  return result;
}

function updateEmergencyRecoveries(session, dependencies, events) {
  const wind = session.windCurrent;
  for (const entry of [...wind.recoveryQueue]) {
    if (session.elapsed < entry.returnsAt) continue;
    const troop = session.troops.find((candidate) => candidate.id === entry.troopId && !candidate.dead);
    if (!troop) {
      wind.recoveryQueue.splice(wind.recoveryQueue.indexOf(entry), 1);
      continue;
    }
    const destination = recoveryCandidates(entry)
      .find(({ row, col }) => !cellBlocked(session, row, col, dependencies, troop.id));
    if (!destination) {
      entry.returnsAt = session.elapsed + 1000;
      entry.status = "waiting";
      continue;
    }
    troop.row = destination.row;
    troop.col = destination.col;
    troop.x = destination.col * CELL.width + CELL.width / 2;
    troop.y = destination.row * CELL.height + CELL.height / 2;
    troop.previousRenderX = troop.x;
    troop.previousRenderY = troop.y;
    troop.windRecovery = false;
    troop.windMotion = {
      fromX: troop.x,
      fromY: troop.y - 90,
      toX: troop.x,
      toY: troop.y,
      startedAt: session.elapsed,
      endsAt: session.elapsed + 650,
    };
    wind.recoveryQueue.splice(wind.recoveryQueue.indexOf(entry), 1);
    events.push({
      type: "windEmergencyReturn",
      troopId: troop.id,
      troopType: troop.type,
      row: troop.row,
      col: troop.col,
      x: troop.x,
      y: troop.y,
      startedAt: session.elapsed,
      durationMs: 650,
    });
  }
}

function beginWarning(session, config, events) {
  const wind = session.windCurrent;
  prepareDirection(session, config);
  wind.state = "warning";
  wind.warningStartedAt = session.elapsed;
  wind.startsAt = session.elapsed + config.warningMs;
  wind.endsAt = wind.startsAt + config.durationMs;
  wind.primaryGustAt = wind.startsAt + config.primaryGustDelayMs;
  wind.displacementApplied = false;
  wind.selectedTroopId = null;
  wind.shiftedTroopIds = [];
  wind.shiftedEnemyIds = [];
  wind.ejectedEnemyIds = [];
  events.push({
    type: "windCurrentWarning",
    ...eventDirectionPayload(wind),
    startsAt: wind.startsAt,
  });
}

function beginActive(session, events) {
  const wind = session.windCurrent;
  wind.state = "active";
  wind.currentsThisWave += 1;
  wind.troopCountAtStart = livingTroops(session).length;
  events.push({
    type: "windCurrentStarted",
    ...eventDirectionPayload(wind),
    currentNumber: wind.currentsThisWave,
    troopCountAtStart: wind.troopCountAtStart,
    endsAt: wind.endsAt,
  });
}

function beginRecovering(session, config, events) {
  const wind = session.windCurrent;
  wind.state = "recovering";
  wind.recoveryStartedAt = session.elapsed;
  wind.recoveryEndsAt = session.elapsed + config.recoveryMs;
  wind.troopCountAtEnd = livingTroops(session).length;
  wind.troopLossCount = Math.max(0, wind.troopCountAtStart - wind.troopCountAtEnd);
  wind.troopLossRatio = wind.troopCountAtStart > 0
    ? wind.troopLossCount / wind.troopCountAtStart
    : 0;
  wind.repeatEligible = wind.troopLossRatio <= wind.repeatLossToleranceRatio;
  wind.nextCheckAt = Infinity;
  events.push({
    type: "windCurrentRecovering",
    ...eventDirectionPayload(wind),
    troopCountAtStart: wind.troopCountAtStart,
    troopCountAtEnd: wind.troopCountAtEnd,
    troopLossCount: wind.troopLossCount,
    troopLossRatio: wind.troopLossRatio,
    repeatEligible: wind.repeatEligible,
    recoveryEndsAt: wind.recoveryEndsAt,
  });
}

export function endWindCurrent(session, events = [], forced = false) {
  const wind = session.windCurrent;
  if (!wind || (wind.state === "idle" && !Number.isFinite(wind.nextCheckAt))) return false;
  wind.state = "idle";
  wind.warningStartedAt = -Infinity;
  wind.startsAt = Infinity;
  wind.endsAt = Infinity;
  wind.recoveryStartedAt = Infinity;
  wind.recoveryEndsAt = Infinity;
  wind.nextCheckAt = Infinity;
  events.push({ type: "windCurrentEnded", forced, currentsThisWave: wind.currentsThisWave });
  return true;
}

export function updateWindCurrent(session, events = [], dependencies = {}) {
  const config = session.phase?.environmentHazard;
  if (!session.windCurrent) session.windCurrent = createWindCurrentState();
  updateEmergencyRecoveries(session, dependencies, events);
  if (config?.id !== "wind_current") return events;
  const wind = session.windCurrent;
  if (!session.waveActive && !session.sandbox) return events;
  if (wind.state === "warning" && session.elapsed >= wind.startsAt) beginActive(session, events);
  if (wind.state === "active") {
    if (!wind.displacementApplied && session.elapsed >= wind.primaryGustAt) {
      applyPrimaryGust(session, config, dependencies, events);
    }
    if (session.elapsed >= wind.endsAt) beginRecovering(session, config, events);
  }
  if (wind.state === "recovering" && session.elapsed >= wind.recoveryEndsAt) {
    wind.state = "idle";
    wind.nextCheckAt = wind.repeatEligible
      ? session.elapsed + config.checkEveryMs
      : Infinity;
    events.push({
      type: "windCurrentEnded",
      forced: false,
      repeatEligible: wind.repeatEligible,
      nextCheckAt: wind.nextCheckAt,
    });
  }
  if (wind.state !== "idle" || session.elapsed < wind.nextCheckAt) return events;
  wind.nextCheckAt = session.elapsed + config.checkEveryMs;
  const troopCount = actionableTroops(session).length;
  if (troopCount < config.minTroops) return events;
  const chance = Math.min(
    config.maxChance,
    config.baseChance + (troopCount - config.minTroops) * config.chancePerExtraTroop,
  );
  if (session.rng() >= chance) return events;
  beginWarning(session, config, events);
  return events;
}
