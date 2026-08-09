import { CELL, FIELD } from "./visualGeometry.js";
import { isTideCellFlooded } from "./tideCycle.js";

export const LEVIATHAN_PHASE_ATTACKS = Object.freeze({
  1: ["biteAbyss", "tailSweep", "brineJet"],
  2: ["biteAbyss", "tailSweep", "brineJet", "predatoryVortex", "devastatingDive", "tideCommand", "abyssRoar"],
  3: ["biteAbyss", "tailSweep", "brineJet", "predatoryVortex", "devastatingDive", "tideCommand", "abyssRoar", "deluge"],
});
export const LEVIATHAN_ATTACK_WEIGHTS = Object.freeze({ biteAbyss: 22, tailSweep: 18, brineJet: 18, predatoryVortex: 14, devastatingDive: 12, tideCommand: 10, abyssRoar: 8, deluge: 100 });
export const LEVIATHAN_UNDERWATER_STATES = new Set(["submerge", "submergedTravel", "submergedStalk", "submergedFinalApproach"]);
export const LEVIATHAN_SHADOW_ONLY_STATES = new Set(["submergedTravel", "submergedStalk", "submergedFinalApproach"]);
export const LEVIATHAN_SURFACED_STATES = new Set(["idleSurface", "surfaceSwim", "biteAbyss", "biteRecover", "tailSweep", "brineJet", "vortexCast", "emergeImpact", "tideCommand", "abyssRoar", "delugeCharge", "delugeRelease", "exposedGills"]);
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const aquatic = (enemy) => enemy?.type === "enguiaRasgamar" || enemy?.type === "carapacaNereida" || enemy?.type === "medusaVeuSalino" || enemy?.type === "mordelume";
const living = (session) => session.troops.filter((troop) => !troop.dead);
const cooldownField = { biteAbyss: "leviathanBiteReadyAt", tailSweep: "leviathanTailReadyAt", brineJet: "leviathanBrineReadyAt", predatoryVortex: "leviathanVortexReadyAt", devastatingDive: "leviathanDiveReadyAt", tideCommand: "leviathanTideReadyAt", abyssRoar: "leviathanRoarReadyAt", deluge: "leviathanDelugeReadyAt" };
const impactFrame = Object.freeze({ biteAbyss: 5, tailSweep: 5, brineJet: 4, predatoryVortex: 5, devastatingDive: 5, tideCommand: 5, abyssRoar: 5, deluge: 5 });
const rightmostTileCenter = FIELD.enemyEntryCol * CELL.width + CELL.width / 2;
const brineLaneStartX = () => FIELD.enemyEntryCol * CELL.width + CELL.width * .9;
const brineLaneEndX = () => FIELD.defenseCol * CELL.width + CELL.width * .15;

export function chooseBrineJetPlacement(session, enemy, attackRow) {
  const bodyRow = attackRow === 0 ? 1 : attackRow === FIELD.rows - 1 ? FIELD.rows - 2 : attackRow <= 2 ? attackRow + 1 : attackRow - 1;
  return { bodyRow, attackRow, targetableRows: [...new Set([bodyRow, attackRow])].sort((left, right) => left - right) };
}
export function resetLeviathanBrineJet(enemy) {
  Object.assign(enemy, { leviathanBrineCastId: null, leviathanBrineReleasedAt: null, leviathanBrineEndsAt: null, leviathanBrineTargetTroopIds: [], leviathanBrineHitTroopIds: [], leviathanBrineContacts: [], leviathanBrineFrontX: null, leviathanBrinePreviousFrontX: null, leviathanBrinePhase: null });
}

export function syncLeviathanHitZones(enemy, config = enemy?._leviathanConfig) {
  if (!enemy || !config || !enemy.leviathanTargetable || !LEVIATHAN_SURFACED_STATES.has(enemy.leviathanState)) {
    if (enemy) { enemy.leviathanHitZones = []; enemy.leviathanTargetableRows = []; }
    return [];
  }
  let bodyRow = clamp(Math.round((enemy.y - CELL.height / 2) / CELL.height), 0, FIELD.rows - 1);
  let headRow;
  if (enemy.leviathanState === "brineJet" && Number.isInteger(enemy.leviathanAttackRow)) {
    headRow = enemy.leviathanAttackRow;
    bodyRow = clamp(enemy.leviathanBodyRow, 0, FIELD.rows - 1);
  } else {
    headRow = bodyRow === 0 ? 1 : bodyRow - 1;
  }
  if (headRow === bodyRow) headRow = bodyRow < FIELD.rows - 1 ? bodyRow + 1 : bodyRow - 1;
  enemy.leviathanBodyRow = bodyRow;
  enemy.leviathanHitZones = [{ part: "head", row: headRow }, { part: "neck", row: bodyRow }];
  enemy.leviathanTargetableRows = [...new Set([headRow, bodyRow])];
  return enemy.leviathanHitZones;
}

function cooldownFactor(enemy, config) { return enemy.leviathanPhase === 3 ? config.phaseThreeCooldownFactor : enemy.leviathanPhase === 2 ? config.phaseTwoCooldownFactor : 1; }
function attackReady(session, enemy, attack) { return session.elapsed >= Number(enemy[cooldownField[attack]] || 0); }
function floodedTroops(session) { return living(session).filter((troop) => isTideCellFlooded(session, troop.row, troop.col)); }
export function chooseBalancedTargetRows(session, enemy, count) {
  // The boss used to rate the current row first, which made the centre lane
  // disproportionately likely. Keep attacks meaningful by considering only
  // occupied rows, then rotate evenly among them with a seeded random tie.
  const occupiedRows = [...new Set(living(session).map((troop) => troop.row))];
  const candidates = occupiedRows.length
    ? occupiedRows
    : Array.from({ length: FIELD.rows }, (_, row) => row);
  const rowCounts = enemy.leviathanRouteAttackCounts ||= Array(FIELD.rows).fill(0);
  const selected = [];

  while (selected.length < Math.min(count, candidates.length)) {
    const available = candidates.filter((row) => !selected.includes(row));
    const leastTargeted = Math.min(...available.map((row) => rowCounts[row] || 0));
    const equallyEligible = available.filter((row) => (rowCounts[row] || 0) === leastTargeted);
    const row = equallyEligible[Math.floor(session.rng() * equallyEligible.length)];
    selected.push(row);
    rowCounts[row] = (rowCounts[row] || 0) + 1;
  }

  return selected;
}
function setState(session, enemy, state, duration = Infinity, { telegraphMs = 0, animationMs } = {}) {
  enemy.leviathanState = state; enemy.leviathanStateStartedAt = session.elapsed;
  enemy.leviathanStateEndsAt = Number.isFinite(duration) ? session.elapsed + duration : Infinity;
  enemy.leviathanTelegraphStartedAt = telegraphMs ? session.elapsed : null;
  enemy.leviathanTelegraphEndsAt = telegraphMs ? session.elapsed + telegraphMs : null;
  enemy.leviathanAnimationStartedAt = session.elapsed + telegraphMs;
  enemy.leviathanAnimationEndsAt = Number.isFinite(animationMs ?? duration) ? enemy.leviathanAnimationStartedAt + (animationMs ?? duration - telegraphMs) : Infinity;
  enemy.leviathanImpactFrame = null;
  enemy.leviathanImpactApplied = false;
  enemy.leviathanAttackApplied = false; enemy.leviathanProjectileReleased = false; enemy.leviathanPulseIndex = 0;
  enemy.leviathanSubmerged = LEVIATHAN_UNDERWATER_STATES.has(state);
  enemy.leviathanTargetable = !enemy.leviathanSubmerged && state !== "spawnRise" && state !== "death";
  enemy.leviathanDamageFactor = state === "exposedGills" ? enemy._leviathanConfig.exposedGillsDamageFactor : 1;
  syncLeviathanHitZones(enemy, enemy._leviathanConfig);
}
function setAttackState(session, enemy, state, config, attack, { telegraphMs = 0, animationMs } = {}) {
  const animationDuration = animationMs ?? config[attack]?.durationMs ?? config[attack]?.castDurationMs ?? 0;
  setState(session, enemy, state, telegraphMs + animationDuration, { telegraphMs, animationMs: animationDuration });
  enemy.leviathanImpactFrame = impactFrame[attack] ?? null;
  if (attack === "predatoryVortex") {
    const impactAt = enemy.leviathanAnimationStartedAt + animationDuration * enemy.leviathanImpactFrame / 8;
    enemy.leviathanStateEndsAt = Math.max(enemy.leviathanStateEndsAt, impactAt + config.predatoryVortex.pulseEveryMs * (config.predatoryVortex.pulseCount - 1) + 350);
  }
}
function impactReached(session, enemy) {
  if (enemy.leviathanImpactFrame == null || !Number.isFinite(enemy.leviathanAnimationEndsAt)) return false;
  const duration = Math.max(1, enemy.leviathanAnimationEndsAt - enemy.leviathanAnimationStartedAt);
  return session.elapsed >= enemy.leviathanAnimationStartedAt + duration * enemy.leviathanImpactFrame / 8;
}
const rowY = (row) => clamp(row, 0, FIELD.rows - 1) * CELL.height + CELL.height / 2;
const ease = (value, curve) => curve === "linear" ? value : value * value * (3 - 2 * value);
export function startLeviathanMovement(session, enemy, {
  x, y, durationMs, curve = "easeInOut", state = "surfaceSwim", targetRow = enemy.row,
} = {}) {
  enemy.leviathanMoveFromX = enemy.x;
  enemy.leviathanMoveFromY = enemy.y;
  const requestedX = Number.isFinite(x) ? x : enemy.x;
  enemy.leviathanMoveToX = enemy.type === "leviathanNereida"
    ? Math.min(requestedX, rightmostTileCenter)
    : requestedX;
  enemy.leviathanMoveToY = Number.isFinite(y) ? y : enemy.y;
  enemy.leviathanMoveStartedAt = session.elapsed;
  enemy.leviathanMoveEndsAt = session.elapsed + Math.max(1, durationMs || 1);
  enemy.leviathanMoveCurve = curve;
  enemy.leviathanMoveState = state;
  enemy.leviathanMoveTargetRow = targetRow;
  enemy.moving = true;
}
export function updateLeviathanMovement(session, enemy) {
  if (!enemy.moving) return true;
  const duration = Math.max(1, enemy.leviathanMoveEndsAt - enemy.leviathanMoveStartedAt);
  const raw = clamp((session.elapsed - enemy.leviathanMoveStartedAt) / duration, 0, 1);
  const progress = ease(raw, enemy.leviathanMoveCurve);
  enemy.leviathanPreviousRenderX = enemy.x;
  enemy.leviathanPreviousRenderY = enemy.y;
  enemy.previousRenderX = enemy.x;
  enemy.previousRenderY = enemy.y;
  enemy.x = enemy.leviathanMoveFromX + (enemy.leviathanMoveToX - enemy.leviathanMoveFromX) * progress;
  // A shallow sine arc keeps underwater travel from looking like a rigid line.
  const arc = enemy.leviathanMoveState === "submergedTravel" ? Math.sin(raw * Math.PI) * CELL.height * .32 : 0;
  enemy.y = enemy.leviathanMoveFromY + (enemy.leviathanMoveToY - enemy.leviathanMoveFromY) * progress + arc;
  syncLeviathanHitZones(enemy, enemy._leviathanConfig);
  if (raw < 1) return false;
  enemy.x = enemy.leviathanMoveToX;
  enemy.y = enemy.leviathanMoveToY;
  enemy.row = clamp(Math.round((enemy.y - CELL.height / 2) / CELL.height), 0, FIELD.rows - 1);
  enemy.moving = false;
  syncLeviathanHitZones(enemy, enemy._leviathanConfig);
  return true;
}
function moveToAttackPosition(session, enemy, attack, config) {
  const target = enemy.leviathanTargetCells[0] || { row: enemy.leviathanTargetRows[0] ?? enemy.row, col: FIELD.lastTroopCol };
  const underwater = attack === "biteAbyss" || attack === "devastatingDive" || attack === "predatoryVortex" || attack === "deluge";
  const x = underwater ? clamp((target.col + .55) * CELL.width, 550, 980) : 1030;
  const bodyRow = attack === "brineJet" ? enemy.leviathanBodyRow : target.row;
  const y = rowY(bodyRow);
  enemy.leviathanPendingMove = { x, y, durationMs: attack === "devastatingDive" ? config.devastatingDive.travelDurationMs : 1050, targetRow: bodyRow };
  if (!underwater) startLeviathanMovement(session, enemy, { x, y, durationMs: 680, state: "surfaceSwim", targetRow: bodyRow });
  enemy.leviathanAttackStage = underwater ? "submerging" : "movingToPosition";
  if (underwater) setState(session, enemy, "submerge", config.devastatingDive?.submergeDurationMs || 640);
  else setState(session, enemy, "surfaceSwim", 680);
}
function moveTroop(session, troop, columns, hooks, collisionFactor = 0) {
  if (troop.dead || (troop.massClass || "medium") === "heavy") return false;
  const destination = clamp(troop.col + columns, FIELD.firstTroopCol, FIELD.lastTroopCol);
  const blocked = living(session).some((other) => other.id !== troop.id && other.row === troop.row && other.col === destination);
  if (blocked || destination === troop.col) { if (collisionFactor) hooks.damageTroop(session, troop, troop.maxHp * collisionFactor, hooks.events); return false; }
  troop.col = destination; troop.x = destination * CELL.width + CELL.width / 2; return true;
}
function disableTraps(session, rows, until) {
  for (const mine of session.mines || []) {
    if (mine.active && rows.includes(mine.row)) mine.leviathanDisabledUntil = Math.max(mine.leviathanDisabledUntil || 0, until);
  }
}
function isInImpactRadius(troop, enemy, radiusTiles) {
  return Math.hypot(troop.x - enemy.x, troop.y - enemy.y) <= radiusTiles * CELL.width;
}
function setTideOverride(session, enemy, levels, duration, events) {
  if (!session.tideCycle) return;
  session.tideCycle.bossOverride = { sourceId: enemy.id, extraLevels: levels, until: session.elapsed + duration };
  events.push({ type: "leviathanTideOverride", bossId: enemy.id, extraLevels: levels, until: session.elapsed + duration });
}
function applyAttack(session, enemy, attack, config, hooks, events) {
  const targets = enemy.leviathanTargetTroopIds.map((id) => session.troops.find((troop) => troop.id === id && !troop.dead)).filter(Boolean);
  if (attack === "biteAbyss") targets.forEach((troop) => {
    if (troop.hp / Math.max(1, troop.maxHp) <= config.biteAbyss.executeBelowHpFactor) { hooks.eliminateTroop(session, troop, events, "leviathanDevour"); events.push({ type: "leviathanTroopDevoured", bossId: enemy.id, troopId: troop.id }); }
    else { hooks.damageTroop(session, troop, troop.maxHp * config.biteAbyss.damageMaxHpFactor, events); moveTroop(session, troop, 1, { ...hooks, events }); events.push({ type: "leviathanBiteImpact", bossId: enemy.id, troopId: troop.id, row: troop.row, col: troop.col }); }
  });
  if (attack === "tailSweep") {
    living(session).filter((troop) => enemy.leviathanTargetRows.includes(troop.row)).forEach((troop) => { hooks.damageTroop(session, troop, troop.maxHp * config.tailSweep.damageMaxHpFactor, events); moveTroop(session, troop, enemy.leviathanSweepDirection || 1, { ...hooks, events }, config.tailSweep.collisionDamageMaxHpFactor); });
    disableTraps(session, enemy.leviathanTargetRows, session.elapsed + config.tailSweep.trapDisableMs);
  }
  if (attack === "predatoryVortex") {
    living(session).filter((troop) => isInImpactRadius(troop, enemy, config.predatoryVortex.radiusTiles)).forEach((troop) => {
      hooks.damageTroop(session, troop, troop.maxHp * config.predatoryVortex.damageMaxHpFactorPerPulse, events);
      if ((troop.massClass || "medium") !== "heavy") {
        troop.leviathanVortexPull = (troop.leviathanVortexPull || 0) + config.predatoryVortex.pullTilesPerPulse;
        if (troop.leviathanVortexPull >= 1) { moveTroop(session, troop, 1, { ...hooks, events }); troop.leviathanVortexPull -= 1; }
      }
    });
    session.enemies.filter((ally) => !ally.dead && ally.id !== enemy.id && aquatic(ally) && isInImpactRadius(ally, enemy, config.predatoryVortex.radiusTiles)).forEach((ally) => {
      ally.leviathanVortexSpeedFactor = config.predatoryVortex.aquaticEnemySpeedFactor;
      ally.leviathanVortexSpeedUntil = session.elapsed + config.predatoryVortex.aquaticEnemyBuffDurationMs;
    });
  }
  if (attack === "devastatingDive") {
    const floodedCells = [];
    living(session).filter((troop) => isInImpactRadius(troop, enemy, config.devastatingDive.impactRadiusTiles)).forEach((troop) => { hooks.damageTroop(session, troop, troop.maxHp * config.devastatingDive.impactDamageMaxHpFactor, events); moveTroop(session, troop, -1, { ...hooks, events }); floodedCells.push([troop.row, troop.col]); });
    session.tideCycle.leviathanFloodedCells = floodedCells;
    session.tideCycle.leviathanFloodedUntil = session.elapsed + config.devastatingDive.floodedDurationMs;
  }
  if (attack === "tideCommand") setTideOverride(session, enemy, config.tideCommand.extraLevels, config.tideCommand.durationMs, events);
  if (attack === "abyssRoar") session.enemies.filter((ally) => !ally.dead && ally.id !== enemy.id && aquatic(ally)).forEach((ally) => { ally.hp = Math.min(ally.maxHp, ally.hp + ally.maxHp * config.abyssRoar.healFactor); ally.leviathanRoarSpeedFactor = config.abyssRoar.speedFactor; ally.leviathanRoarUntil = session.elapsed + config.abyssRoar.buffDurationMs; for (const field of ["slowUntil", "stunnedUntil"]) if (ally[field] > session.elapsed) ally[field] = session.elapsed + (ally[field] - session.elapsed) * config.abyssRoar.controlDurationFactor; });
  if (attack === "deluge") { living(session).forEach((troop) => { hooks.damageTroop(session, troop, Math.min(troop.maxHp * config.deluge.damageMaxHpFactor, Math.max(0, troop.hp - 1)), events); if ((troop.massClass || "medium") === "light") moveTroop(session, troop, -config.deluge.lightTroopPushTiles, { ...hooks, events }); troop.leviathanBrineAttackSpeedFactor = config.deluge.attackSpeedFactor; troop.leviathanBrineUntil = session.elapsed + config.deluge.attackSpeedDurationMs; hooks.refreshTroop(session, troop); }); disableTraps(session, [0, 1, 2, 3, 4], session.elapsed + config.deluge.trapDisableMs); setTideOverride(session, enemy, config.deluge.extraTideLevels, config.deluge.floodedDurationMs, events); enemy.leviathanDelugeUsed = true; session.enemyProjectiles = []; }
  events.push({ type: `leviathan${attack[0].toUpperCase()}${attack.slice(1)}Impact`, bossId: enemy.id, rows: [...enemy.leviathanTargetRows] });
}

function releaseBrineJet(session, enemy, config, events) {
  const attackRow = enemy.leviathanAttackRow;
  enemy.leviathanBrineCastId = `${enemy.id}:${session.elapsed}`;
  enemy.leviathanBrineReleasedAt = session.elapsed;
  enemy.leviathanBrineEndsAt = session.elapsed + config.brineJet.mouthToGroundMs + config.brineJet.groundSweepMaxMs + config.brineJet.groundSustainMs + config.brineJet.fadeOutMs;
  enemy.leviathanBrineFrontX = brineLaneStartX(); enemy.leviathanBrinePreviousFrontX = enemy.leviathanBrineFrontX;
  enemy.leviathanBrineTargetTroopIds = [];
  enemy.leviathanBrineHitTroopIds = [];
  enemy.leviathanBrineContacts = [];
  events.push({ type: "leviathanBrineReleased", bossId: enemy.id, bodyRow: enemy.leviathanBodyRow, attackRow, targetableRows: [...enemy.leviathanTargetableRows], releasedAt: session.elapsed, endsAt: enemy.leviathanBrineEndsAt, projectileSpeed: config.brineJet.projectileSpeed, seed: session.rng() });
}

function updateBrineJet(session, enemy, config, hooks, events) {
  const afterGround = session.elapsed >= enemy.leviathanBrineReleasedAt + config.brineJet.mouthToGroundMs;
  if (afterGround && enemy.leviathanBrineFrontX > brineLaneEndX()) {
    const deltaMs = Math.max(32, session.elapsed - (enemy.leviathanBrineLastUpdatedAt ?? enemy.leviathanBrineReleasedAt));
    enemy.leviathanBrinePreviousFrontX = enemy.leviathanBrineFrontX;
    enemy.leviathanBrineFrontX = Math.max(brineLaneEndX(), enemy.leviathanBrineFrontX - config.brineJet.projectileSpeed * deltaMs / 1000);
  }
  enemy.leviathanBrineLastUpdatedAt = session.elapsed;
  for (const troop of living(session)) {
    if (!afterGround || troop.row !== enemy.leviathanAttackRow || enemy.leviathanBrineHitTroopIds.includes(troop.id)) continue;
    if (!(troop.x <= enemy.leviathanBrinePreviousFrontX && troop.x >= enemy.leviathanBrineFrontX)) continue;
    hooks.damageTroop(session, troop, troop.maxHp * config.brineJet.damageMaxHpFactor, events);
    troop.leviathanBrineAttackSpeedFactor = config.brineJet.attackSpeedFactor;
    troop.leviathanBrineUntil = session.elapsed + config.brineJet.attackSpeedDurationMs;
    enemy.leviathanBrineHitTroopIds.push(troop.id);
    hooks.refreshTroop(session, troop);
    events.push({ type: "leviathanBrineTroopImpact", bossId: enemy.id, troopId: troop.id, row: troop.row, hitAt: session.elapsed });
  }
  if (enemy.leviathanBrineEndsAt && session.elapsed >= enemy.leviathanBrineEndsAt) {
    events.push({ type: "leviathanBrineEnded", bossId: enemy.id });
    return true;
  }
  events.push({ type: "leviathanBrineStream", bossId: enemy.id, attackRow: enemy.leviathanAttackRow, releasedAt: enemy.leviathanBrineReleasedAt });
  return false;
}
function validAttack(session, enemy, attack) {
  if (attack === enemy.leviathanPreviousAttack || !attackReady(session, enemy, attack)) return false;
  if (attack === "biteAbyss" && !floodedTroops(session).length) return false;
  if (attack === "abyssRoar" && !session.enemies.some((ally) => !ally.dead && ally.id !== enemy.id && aquatic(ally))) return false;
  return !(attack === "deluge" && (enemy.leviathanPhase < 3 || enemy.leviathanDelugeUsed));
}
export function dynamicAttackWeight(session, enemy, attack, config) {
  const weight = LEVIATHAN_ATTACK_WEIGHTS[attack];
  if (attack !== "brineJet") return weight;
  const elapsedSinceUse = session.elapsed - (enemy.leviathanBrineLastUsedAt ?? enemy.spawnedAt ?? 0);
  if (elapsedSinceUse >= config.brineJet.guaranteeAfterMs) return 1000;
  if (elapsedSinceUse >= config.brineJet.highPriorityAfterMs) return weight * 2;
  if (elapsedSinceUse >= config.brineJet.priorityStartsAfterMs) return weight * 1.5;
  return weight;
}
function choose(session, enemy, config) {
  const candidates = LEVIATHAN_PHASE_ATTACKS[enemy.leviathanPhase].filter((attack) => validAttack(session, enemy, attack));
  if (!candidates.length) return null;
  const total = candidates.reduce((sum, attack) => sum + dynamicAttackWeight(session, enemy, attack, config), 0); let roll = session.rng() * total;
  return candidates.find((attack) => ((roll -= dynamicAttackWeight(session, enemy, attack, config)) <= 0)) || candidates.at(-1);
}
function startAttack(session, enemy, attack, config, events) {
  if (attack === "brineJet") resetLeviathanBrineJet(enemy);
  enemy.leviathanQueuedAttack = attack; enemy.leviathanPreviousAttack = attack;
  const phase = enemy.leviathanPhase;
  const rows = attack === "tailSweep" ? config.tailSweep[`rowsPhase${phase === 1 ? "One" : phase === 2 ? "Two" : "Three"}`] : 1;
  enemy.leviathanTargetRows = chooseBalancedTargetRows(session, enemy, attack === "deluge" ? 5 : rows);
  if (attack === "brineJet") {
    const attackRow = enemy.leviathanTargetRows[0] ?? enemy.row;
    const placement = chooseBrineJetPlacement(session, enemy, attackRow);
    enemy.leviathanBodyRow = placement.bodyRow;
    enemy.leviathanAttackRow = placement.attackRow;
    enemy.leviathanTargetRows = [attackRow];
  } else {
    enemy.leviathanBodyRow = enemy.row;
    enemy.leviathanAttackRow = null;
  }
  syncLeviathanHitZones(enemy, config);
  if (attack === "biteAbyss") enemy.leviathanTargetTroopIds = floodedTroops(session).sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp || b.col - a.col).slice(0, config.biteAbyss[`targetsPhase${phase === 1 ? "One" : phase === 2 ? "Two" : "Three"}`]).map((troop) => troop.id);
  else enemy.leviathanTargetTroopIds = living(session).filter((troop) => enemy.leviathanTargetRows.includes(troop.row)).map((troop) => troop.id);
  enemy.leviathanTargetCells = enemy.leviathanTargetTroopIds.map((troopId) => { const troop = session.troops.find((entry) => entry.id === troopId); return troop ? { row: troop.row, col: troop.col } : null; }).filter(Boolean);
  enemy.leviathanSweepDirection = session.rng() < .72 ? 1 : -1;
  moveToAttackPosition(session, enemy, attack, config);
  events.push({ type: "leviathanMovementStarted", bossId: enemy.id, attack, targetRow: enemy.leviathanMoveTargetRow, x: enemy.leviathanMoveToX, y: enemy.leviathanMoveToY });
}
function returnToDeepOcean(session, enemy, config, events, underwater = false) {
  const attack = enemy.leviathanQueuedAttack;
  if (attack === "brineJet") { enemy.leviathanBrineLastUsedAt = session.elapsed; resetLeviathanBrineJet(enemy); }
  if (attack) enemy[cooldownField[attack]] = session.elapsed + (config[attack]?.cooldownMs || 0) * cooldownFactor(enemy, config);
  enemy.leviathanGlobalAttackReadyAt = session.elapsed + config.globalAttackLockMs;
  enemy.leviathanQueuedAttack = null;
  enemy.leviathanAttackRow = null;
  enemy.leviathanTargetableRows = [];
  enemy.leviathanAttackStage = "returning";
  if (underwater) {
    enemy.leviathanReturningUnderwater = true;
    enemy.leviathanPendingMove = { x: enemy.leviathanHomeX, y: enemy.leviathanHomeY, durationMs: 1050, targetRow: config.bossAnchorRow };
    setState(session, enemy, "submerge", config.devastatingDive.submergeDurationMs);
    events.push({ type: "leviathanReturningOcean", bossId: enemy.id, x: enemy.leviathanHomeX, y: enemy.leviathanHomeY, submerged: true });
    return;
  }
  startLeviathanMovement(session, enemy, { x: enemy.leviathanHomeX, y: enemy.leviathanHomeY, durationMs: 760, state: "surfaceSwim", targetRow: config.bossAnchorRow });
  setState(session, enemy, "surfaceSwim", 760);
  events.push({ type: "leviathanReturningOcean", bossId: enemy.id, x: enemy.leviathanHomeX, y: enemy.leviathanHomeY });
}
export function updateLeviathan(session, enemy, config, hooks, events) {
  enemy._leviathanConfig = config;
  syncLeviathanHitZones(enemy, config);
  const ratio = enemy.hp / Math.max(1, enemy.maxHp); const phase = ratio <= config.phaseThreeHpFactor ? 3 : ratio <= config.phaseTwoHpFactor ? 2 : 1;
  if (phase !== enemy.leviathanPhase) { enemy.leviathanPhase = phase; events.push({ type: "leviathanPhaseChanged", enemyId: enemy.id, phase, x: enemy.x, y: enemy.y }); }
  if (session.tideCycle?.bossOverride?.sourceId === enemy.id && session.elapsed >= session.tideCycle.bossOverride.until) delete session.tideCycle.bossOverride;
  if (enemy.moving && !updateLeviathanMovement(session, enemy)) return;
  if (enemy.leviathanAttackStage === "movingToPosition" && !enemy.moving) {
    const attack = enemy.leviathanQueuedAttack;
    const state = ({ biteAbyss: "biteAbyss", tailSweep: "tailSweep", brineJet: "brineJet", predatoryVortex: "vortexCast", tideCommand: "tideCommand", abyssRoar: "abyssRoar", deluge: "delugeCharge" })[attack];
    enemy.leviathanAttackStage = "telegraphing";
    if (attack === "deluge") setState(session, enemy, state, config.deluge.chargeDurationMs, { animationMs: config.deluge.chargeDurationMs });
    else setAttackState(session, enemy, state, config, attack, { telegraphMs: config[attack]?.telegraphMs || 0 });
    events.push({ type: "leviathanTelegraph", bossId: enemy.id, attack, rows: [...enemy.leviathanTargetRows], cells: [...enemy.leviathanTargetCells], endsAt: enemy.leviathanTelegraphEndsAt || session.elapsed });
  }
  if (enemy.leviathanAttackStage === "returning" && !enemy.moving && !enemy.leviathanReturningUnderwater) {
    enemy.leviathanAttackStage = null;
    setState(session, enemy, "idleSurface");
    enemy.leviathanSurfaceAnchor = "deepOcean";
  }
  if (enemy.leviathanState === "spawnRise" && session.elapsed >= enemy.leviathanStateEndsAt) { setState(session, enemy, "idleSurface"); enemy.leviathanGlobalAttackReadyAt = session.elapsed + 1500; return; }
  if (enemy.leviathanState === "submerge" && session.elapsed >= enemy.leviathanStateEndsAt) {
    const move = enemy.leviathanPendingMove || { x: enemy.x, y: enemy.y, durationMs: config.devastatingDive.travelDurationMs, targetRow: enemy.row };
    setState(session, enemy, "submergedTravel");
    startLeviathanMovement(session, enemy, { ...move, state: "submergedTravel" });
    return;
  }
  if (enemy.leviathanState === "submergedTravel" && !enemy.moving) {
    if (enemy.leviathanReturningUnderwater) {
      enemy.leviathanReturningUnderwater = false;
      enemy.leviathanAttackStage = null;
      setState(session, enemy, "idleSurface");
      enemy.leviathanSurfaceAnchor = "deepOcean";
      return;
    }
    const queued = enemy.leviathanQueuedAttack;
    if (queued === "devastatingDive") {
      setState(session, enemy, "submergedStalk", config.devastatingDive.stalkDurationByPhase?.[enemy.leviathanPhase] || 2800);
      enemy.leviathanAttackStage = "stalking";
      return;
    }
    const state = ({ biteAbyss: "biteAbyss", predatoryVortex: "vortexCast", deluge: "delugeCharge" })[queued] || "idleSurface";
    enemy.leviathanAttackStage = "telegraphing";
    if (queued === "deluge") setState(session, enemy, state, config.deluge.chargeDurationMs, { animationMs: config.deluge.chargeDurationMs });
    else setAttackState(session, enemy, state, config, queued, { telegraphMs: config[queued]?.telegraphMs || 0 });
    events.push({ type: "leviathanTelegraph", bossId: enemy.id, attack: queued, rows: [...enemy.leviathanTargetRows], cells: [...enemy.leviathanTargetCells], endsAt: enemy.leviathanTelegraphEndsAt || session.elapsed });
    return;
  }
  if (enemy.leviathanState === "submergedStalk" && session.elapsed >= enemy.leviathanStateEndsAt) {
    setState(session, enemy, "submergedFinalApproach", config.devastatingDive.finalApproachByPhase?.[enemy.leviathanPhase] || 900);
    return;
  }
  if (enemy.leviathanState === "submergedFinalApproach" && session.elapsed >= enemy.leviathanStateEndsAt) {
    setAttackState(session, enemy, "emergeImpact", config, "devastatingDive", { animationMs: config.devastatingDive.emergeDurationMs });
    enemy.leviathanAttackStage = "attacking";
    events.push({ type: "leviathanEmergeTelegraph", bossId: enemy.id, x: enemy.x, y: enemy.y });
    return;
  }
  if (enemy.leviathanState === "emergeImpact" && !enemy.leviathanImpactApplied && impactReached(session, enemy)) { applyAttack(session, enemy, "devastatingDive", config, hooks, events); enemy.leviathanAttackApplied = true; enemy.leviathanImpactApplied = true; return; }
  if (enemy.leviathanState === "emergeImpact" && session.elapsed >= enemy.leviathanStateEndsAt) { enemy.leviathanExposedUntil = session.elapsed + config.devastatingDive.exposedDurationMs; setState(session, enemy, "exposedGills", config.devastatingDive.exposedDurationMs); return; }
  if (enemy.leviathanState === "exposedGills" && session.elapsed >= enemy.leviathanStateEndsAt) { returnToDeepOcean(session, enemy, config, events, true); return; }
  if (enemy.leviathanState === "biteAbyss" && enemy.leviathanAttackApplied && session.elapsed >= enemy.leviathanStateEndsAt) { setState(session, enemy, "biteRecover", config.biteAbyss.recoverDurationMs, { animationMs: config.biteAbyss.recoverDurationMs }); return; }
  if (enemy.leviathanState === "biteRecover" && session.elapsed >= enemy.leviathanStateEndsAt) { returnToDeepOcean(session, enemy, config, events); return; }
  const attack = enemy.leviathanQueuedAttack;
  if (attack && enemy.leviathanState !== "idleSurface") {
    if (attack === "deluge" && enemy.leviathanState === "delugeCharge" && session.elapsed >= enemy.leviathanStateEndsAt) {
      setAttackState(session, enemy, "delugeRelease", config, "deluge", { animationMs: config.deluge.releaseDurationMs });
      return;
    }
    const impactAt = enemy.leviathanAnimationStartedAt + Math.max(1, enemy.leviathanAnimationEndsAt - enemy.leviathanAnimationStartedAt) * (enemy.leviathanImpactFrame || 0) / 8;
    if (attack === "predatoryVortex" && impactReached(session, enemy)) {
      const expectedPulses = Math.min(config.predatoryVortex.pulseCount, Math.floor((session.elapsed - impactAt) / config.predatoryVortex.pulseEveryMs) + 1);
      while (enemy.leviathanPulseIndex < expectedPulses) {
        applyAttack(session, enemy, attack, config, hooks, events);
        enemy.leviathanPulseIndex += 1;
      }
      enemy.leviathanAttackApplied = enemy.leviathanPulseIndex >= config.predatoryVortex.pulseCount;
    }
    if (attack === "brineJet" && !enemy.leviathanImpactApplied && impactReached(session, enemy)) {
      releaseBrineJet(session, enemy, config, events);
      enemy.leviathanAttackApplied = true;
      enemy.leviathanImpactApplied = true;
    }
    if (attack === "brineJet" && enemy.leviathanBrineReleasedAt) {
      if (updateBrineJet(session, enemy, config, hooks, events)) { returnToDeepOcean(session, enemy, config, events); }
      return;
    }
    if (attack !== "predatoryVortex" && attack !== "brineJet" && !enemy.leviathanImpactApplied && impactReached(session, enemy)) { applyAttack(session, enemy, attack, config, hooks, events); enemy.leviathanAttackApplied = true; enemy.leviathanImpactApplied = true; }
    if (session.elapsed >= enemy.leviathanStateEndsAt) {
      if (attack === "biteAbyss") { setState(session, enemy, "biteRecover", config.biteAbyss.recoverDurationMs, { animationMs: config.biteAbyss.recoverDurationMs }); return; }
      returnToDeepOcean(session, enemy, config, events);
    }
    return;
  }
  if (enemy.leviathanState !== "idleSurface" || session.elapsed < enemy.leviathanNextDecisionAt || session.elapsed < enemy.leviathanGlobalAttackReadyAt) return;
  enemy.leviathanNextDecisionAt = session.elapsed + config.attackDecisionEveryMs;
  const next = choose(session, enemy, config); if (next) startAttack(session, enemy, next, config, events);
}

export function forceLeviathanAttack(session, enemy, attack, config, events = []) {
  if (!enemy || enemy.dead || enemy.type !== "leviathanNereida") return { ok: false, reason: "Leviatã não está ativo." };
  if (!LEVIATHAN_PHASE_ATTACKS[enemy.leviathanPhase]?.includes(attack)) return { ok: false, reason: "Ataque indisponível nesta fase." };
  if (attack === "deluge" && enemy.leviathanDelugeUsed) return { ok: false, reason: "Dilúvio já foi utilizado." };
  if (enemy.leviathanState !== "idleSurface" || enemy.moving) return { ok: false, reason: "Aguarde o Leviatã terminar a ação atual." };
  enemy.leviathanGlobalAttackReadyAt = session.elapsed;
  startAttack(session, enemy, attack, config, events);
  return { ok: true, attack };
}
