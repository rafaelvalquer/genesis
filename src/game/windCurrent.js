import { CELL, FIELD } from "./visualGeometry.js";

export const WIND_CURRENT_DIRECTIONS = Object.freeze([
  "headwind",
  "tailwind",
  "lateral",
]);

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const livingTroops = (session) => session.troops.filter((troop) => !troop.dead);
const actionableTroops = (session, troops = {}) => livingTroops(session)
  .filter((troop) => !troop.windRecovery && troops?.[troop.type]?.windClass !== "structure");

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
    troopLongitudinalShiftTiles: 1,
    lateralShiftRows: 1,
    collisionDamageRatio: 0.25,
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
    sourceCol: null,
    ejectedTroopIds: [],
    collisionTroopIds: [],
    shiftedTroopIds: [],
    shiftedEnemyIds: [],
    ejectedEnemyIds: [],
    recoveryQueue: [],
    troopCountAtStart: 0,
    troopCountAtEnd: 0,
    troopLossCount: 0,
    troopLossRatio: 0,
    repeatLossToleranceRatio: 0,
    repeatEligible: true,
  };
}

export function resetWindCurrentForWave(session, config = session.phase?.environmentHazard) {
  session.windCurrent = {
    ...createWindCurrentState(),
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

function prepareDirection(session, config, dependencies = {}) {
  const wind = session.windCurrent;
  wind.direction = selectDirection(config, session.rng);
  wind.verticalDirection = null;
  wind.selectedRows = [];
  wind.sourceRow = null;
  wind.sourceCol = null;
  wind.targetRow = null;
  if (wind.direction === "lateral") {
    const candidates = actionableTroops(session, dependencies.troops).filter((troop) => !isWindAnchor(troop, dependencies));
    const origin = candidates.length
      ? candidates[Math.floor(session.rng() * candidates.length)]
      : null;
    wind.sourceRow = origin?.row ?? Math.floor(session.rng() * FIELD.rows);
    wind.sourceCol = origin?.col ?? FIELD.firstTroopCol;
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
    sourceCol: wind.sourceCol,
    targetRow: wind.targetRow,
  };
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
  return false;
}

function isWindAnchor(troop, dependencies) {
  return Boolean(troop && (troop.windAnchor || dependencies.troops?.[troop.type]?.windAnchor));
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

function troopAt(session, row, col) {
  return session.troops.find((troop) => !troop.dead && troop.row === row && troop.col === col) || null;
}

function permanentlyEjectTroop(session, troop, direction, dependencies, events) {
  if (!troop || troop.dead) return;
  const from = { row: troop.row, col: troop.col, x: troop.x, y: troop.y };
  troop.windRecovery = true;
  troop.dead = false;
  troop.hp = Math.max(1, troop.hp - troop.maxHp * 0.25);
  troop.removedByWind = true;
  session.windCurrent.ejectedTroopIds.push(troop.id);
  session.windCurrent.shiftedTroopIds.push(troop.id);
  events.push({
    type: "windTroopEjected",
    troopId: troop.id,
    troopType: troop.type,
    entity: { ...troop, row: from.row, col: from.col, x: from.x, y: from.y },
    from,
    verticalDirection: direction,
    startedAt: session.elapsed,
    durationMs: 900,
  });
  session.windCurrent.recoveryQueue.push({
    troopId: troop.id,
    originalRow: from.row,
    originalCol: from.col,
    returnAt: session.elapsed + 8000,
  });
}

function applyWindCollisionDamage(session, troop, blocker, config, dependencies, events) {
  const damage = troop.maxHp * config.collisionDamageRatio;
  dependencies.damageTroop?.(session, troop, damage, events, { generateEnergy: false, environmental: true });
  session.windCurrent.collisionTroopIds.push(troop.id);
  events.push({
    type: "windTroopCollision",
    troopId: troop.id,
    blockerId: blocker.id,
    damage,
    row: troop.row,
    col: troop.col,
  });
}

function applyHeadwindTroopShift(session, row, dependencies, events) {
  const troops = actionableTroops(session, dependencies.troops)
    .filter((troop) => troop.row === row)
    .sort((left, right) => left.col - right.col);
  for (const troop of troops) {
    if (isWindAnchor(troop, dependencies)) continue;
    if (troop.col === FIELD.firstTroopCol) {
      permanentlyEjectTroop(session, troop, 0, dependencies, events);
      continue;
    }
    const targetCol = troop.col - 1;
    if (!cellBlocked(session, row, targetCol, dependencies, troop.id)) {
      moveTroop(troop, row, targetCol, session.elapsed, events);
      session.windCurrent.shiftedTroopIds.push(troop.id);
    }
  }
}

function applyLateralTroopColumnShift(session, config, dependencies, events) {
  const wind = session.windCurrent;
  const rows = wind.verticalDirection < 0
    ? Array.from({ length: wind.sourceRow + 1 }, (_, row) => row)
    : Array.from({ length: FIELD.rows - wind.sourceRow }, (_, index) => FIELD.rows - 1 - index);
  for (const row of rows) {
    const troop = troopAt(session, row, wind.sourceCol);
    if (!troop || isWindAnchor(troop, dependencies)) continue;
    if (dependencies.troops?.[troop.type]?.windClass === "structure") continue;
    const targetRow = row + wind.verticalDirection;
    if (targetRow < 0 || targetRow >= FIELD.rows) {
      permanentlyEjectTroop(session, troop, wind.verticalDirection, dependencies, events);
      continue;
    }
    const blockers = [];
    let cursor = troopAt(session, targetRow, wind.sourceCol);
    while (cursor) {
      if (isWindAnchor(cursor, dependencies) || dependencies.troops?.[cursor.type]?.windClass === "structure") break;
      blockers.push(cursor);
      cursor = troopAt(session, targetRow, cursor.col + 1);
    }
    const destination = blockers.length ? blockers.at(-1).col + 1 : wind.sourceCol;
    const chainBlocked = blockers.length && (destination > FIELD.lastTroopCol
      || cellBlocked(session, targetRow, destination, dependencies, blockers.at(-1).id));
    if (cursor || chainBlocked || (!blockers.length && cellBlocked(session, targetRow, wind.sourceCol, dependencies, troop.id))) {
      const blocker = troopAt(session, targetRow, wind.sourceCol);
      if (blocker && isWindAnchor(blocker, dependencies)) applyWindCollisionDamage(session, troop, blocker, config, dependencies, events);
      continue;
    }
    for (let index = blockers.length - 1; index >= 0; index -= 1) {
      const blocker = blockers[index];
      moveTroop(blocker, targetRow, blocker.col + 1, session.elapsed, events, "windTroopChainShifted");
      session.windCurrent.shiftedTroopIds.push(blocker.id);
    }
    moveTroop(troop, targetRow, wind.sourceCol, session.elapsed, events, "windTroopColumnShifted");
    session.windCurrent.shiftedTroopIds.push(troop.id);
  }
}

function enemyEligible(enemy, dependencies) {
  const config = dependencies.enemies?.[enemy.type] || {};
  return !enemy.dead && !enemy.rooted && !config.windImmune;
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
    if (enemy.type === "derivante") {
      const remaining = Math.max(0, Number(enemy.nextSpecialAt || 0) - session.elapsed);
      enemy.nextSpecialAt = session.elapsed + remaining * 0.5;
    }
    if (wind.targetRow < 0 || wind.targetRow >= FIELD.rows) {
      if (enemy.type === "derivante") {
        const fallbackRow = clamp(wind.sourceRow - wind.verticalDirection, 0, FIELD.rows - 1);
        const targetY = fallbackRow * CELL.height + CELL.height / 2;
        const durationMs = enemyConfig.windGlideMs || 900;
        enemy.row = fallbackRow;
        enemy.y = from.y;
        enemy.previousRenderY = from.y;
        enemy.windMotion = {
          fromX: from.x,
          fromY: from.y,
          toX: enemy.x,
          toY: targetY,
          startedAt: session.elapsed,
          endsAt: session.elapsed + durationMs,
        };
        enemy.chapterFourState = "windGlide";
        enemy.chapterFourStateStartedAt = session.elapsed;
        enemy.chapterFourStateEndsAt = session.elapsed + durationMs;
        enemy.jumpSourceRow = from.row;
        enemy.jumpSourceY = from.y;
        enemy.jumpTargetRow = fallbackRow;
        enemy.jumpTargetY = targetY;
        enemy.jumping = true;
        enemy.jumpProgress = 0;
        wind.shiftedEnemyIds.push(enemy.id);
        events.push({
          type: "windEnemyShifted", enemyId: enemy.id, enemyType: enemy.type,
          from, to: { row: fallbackRow, x: enemy.x, y: targetY },
          windGlide: true, startedAt: session.elapsed,
          durationMs,
        });
        return;
      }
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
    const targetRow = wind.targetRow;
    const targetY = targetRow * CELL.height + CELL.height / 2;
    const durationMs = enemy.type === "derivante" ? (enemyConfig.windGlideMs || 900) : 550;
    enemy.row = targetRow;
    enemy.y = enemy.type === "derivante" ? from.y : targetY;
    enemy.previousRenderY = enemy.y;
    enemy.windMotion = {
      fromX: from.x,
      fromY: from.y,
      toX: enemy.x,
      toY: targetY,
      startedAt: session.elapsed,
      endsAt: session.elapsed + durationMs,
    };
    if (enemy.type === "derivante") {
      enemy.chapterFourState = "windGlide";
      enemy.chapterFourStateStartedAt = session.elapsed;
      enemy.chapterFourStateEndsAt = session.elapsed + durationMs;
      enemy.jumpSourceRow = from.row;
      enemy.jumpSourceY = from.y;
      enemy.jumpTargetRow = targetRow;
      enemy.jumpTargetY = targetY;
      enemy.jumping = true;
      enemy.jumpProgress = 0;
    }
    wind.shiftedEnemyIds.push(enemy.id);
    events.push({
      type: "windEnemyShifted",
      enemyId: enemy.id,
      enemyType: enemy.type,
      from,
      to: { row: targetRow, x: enemy.x, y: targetY },
      startedAt: session.elapsed,
      durationMs,
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
    wind.selectedRows.forEach((row) => applyHeadwindTroopShift(session, row, dependencies, events));
  } else if (wind.direction === "tailwind") {
    applyLongitudinalEnemyPush(session, config, dependencies, events);
    // Tailwind pushes enemies only; troops keep their formation.
  } else {
    applyLateralTroopColumnShift(session, config, dependencies, events);
    applyLateralEnemyPush(session, config, dependencies, events);
  }
}

function beginWarning(session, config, events, dependencies) {
  const wind = session.windCurrent;
  prepareDirection(session, config, dependencies);
  wind.state = "warning";
  wind.warningStartedAt = session.elapsed;
  wind.startsAt = session.elapsed + config.warningMs;
  wind.endsAt = wind.startsAt + config.durationMs;
  wind.primaryGustAt = wind.startsAt + config.primaryGustDelayMs;
  wind.displacementApplied = false;
  wind.shiftedTroopIds = [];
  wind.shiftedEnemyIds = [];
  wind.ejectedEnemyIds = [];
  wind.ejectedTroopIds = [];
  wind.collisionTroopIds = [];
  wind.recoveryQueue ||= [];
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
  wind.troopCountAtStart = actionableTroops(session, session.__windTroops || {}).length;
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
  wind.troopCountAtEnd = livingTroops(session)
    .filter((troop) => session.__windTroops?.[troop.type]?.windClass !== "structure").length;
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

function processWindRecovery(session, events, dependencies) {
  const wind = session.windCurrent;
  if (!wind.recoveryQueue?.length) return;
  const pending = [];
  for (const entry of wind.recoveryQueue) {
    if (session.elapsed < entry.returnAt) { pending.push(entry); continue; }
    const troop = session.troops.find((candidate) => candidate.id === entry.troopId);
    if (!troop) continue;
    const candidates = [[entry.originalRow, entry.originalCol]];
    for (let distance = 1; distance <= FIELD.rows + FIELD.lastTroopCol; distance += 1) {
      candidates.push([entry.originalRow, entry.originalCol - distance], [entry.originalRow, entry.originalCol + distance]);
    }
    const cell = candidates.find(([row, col]) => !cellBlocked(session, row, col, dependencies, troop.id));
    if (!cell) { pending.push(entry); continue; }
    troop.dead = false;
    troop.windRecovery = false;
    troop.removedByWind = false;
    moveTroop(troop, cell[0], cell[1], session.elapsed, events, "windEmergencyReturn", { recovery: true });
    wind.ejectedTroopIds = wind.ejectedTroopIds.filter((id) => id !== troop.id);
  }
  wind.recoveryQueue = pending;
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
  if (config?.id !== "wind_current") return events;
  const wind = session.windCurrent;
  session.__windTroops = dependencies.troops || session.__windTroops || {};
  processWindRecovery(session, events, dependencies);
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
  const troopCount = actionableTroops(session, dependencies.troops).length;
  if (troopCount < config.minTroops) return events;
  const chance = Math.min(
    config.maxChance,
    config.baseChance + (troopCount - config.minTroops) * config.chancePerExtraTroop,
  );
  if (session.rng() >= chance) return events;
  beginWarning(session, config, events, dependencies);
  return events;
}
