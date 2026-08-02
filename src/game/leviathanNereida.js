import { CELL, FIELD } from "./visualGeometry.js";
import { isTideCellFlooded } from "./tideCycle.js";

export const LEVIATHAN_PHASE_ATTACKS = Object.freeze({
  1: ["biteAbyss", "tailSweep", "brineJet"],
  2: ["biteAbyss", "tailSweep", "brineJet", "predatoryVortex", "devastatingDive", "tideCommand", "abyssRoar"],
  3: ["biteAbyss", "tailSweep", "brineJet", "predatoryVortex", "devastatingDive", "tideCommand", "abyssRoar", "deluge"],
});
export const LEVIATHAN_ATTACK_WEIGHTS = Object.freeze({ biteAbyss: 22, tailSweep: 18, brineJet: 18, predatoryVortex: 14, devastatingDive: 12, tideCommand: 10, abyssRoar: 8, deluge: 100 });
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const aquatic = (enemy) => enemy?.type === "enguiaRasgamar" || enemy?.type === "carapacaNereida" || enemy?.type === "medusaVeuSalino" || enemy?.type === "mordelume";
const living = (session) => session.troops.filter((troop) => !troop.dead);
const cooldownField = { biteAbyss: "leviathanBiteReadyAt", tailSweep: "leviathanTailReadyAt", brineJet: "leviathanBrineReadyAt", predatoryVortex: "leviathanVortexReadyAt", devastatingDive: "leviathanDiveReadyAt", tideCommand: "leviathanTideReadyAt", abyssRoar: "leviathanRoarReadyAt", deluge: "leviathanDelugeReadyAt" };

function cooldownFactor(enemy, config) { return enemy.leviathanPhase === 3 ? config.phaseThreeCooldownFactor : enemy.leviathanPhase === 2 ? config.phaseTwoCooldownFactor : 1; }
function attackReady(session, enemy, attack) { return session.elapsed >= Number(enemy[cooldownField[attack]] || 0); }
function floodedTroops(session) { return living(session).filter((troop) => isTideCellFlooded(session, troop.row, troop.col)); }
function targetRows(session, enemy, count) {
  const scores = Array.from({ length: FIELD.rows }, (_, row) => ({ row, score: 0 }));
  for (const troop of living(session)) scores[troop.row].score += 1 + (troop.attack || 0) / 10 + (troop.type.includes("muralha") ? .5 : 0);
  return scores.sort((a, b) => b.score - a.score || (a.row === enemy.row ? -1 : 1)).slice(0, count).map(({ row }) => row);
}
function setState(session, enemy, state, duration = Infinity) {
  enemy.leviathanState = state; enemy.leviathanStateStartedAt = session.elapsed;
  enemy.leviathanStateEndsAt = Number.isFinite(duration) ? session.elapsed + duration : Infinity;
  enemy.leviathanAttackApplied = false; enemy.leviathanProjectileReleased = false; enemy.leviathanPulseIndex = 0;
  enemy.leviathanSubmerged = ["submerge", "submergedTravel"].includes(state);
  enemy.leviathanTargetable = !enemy.leviathanSubmerged && state !== "spawnRise" && state !== "death";
  enemy.leviathanDamageFactor = state === "exposedGills" ? enemy._leviathanConfig.exposedGillsDamageFactor : 1;
}
function moveTroop(session, troop, columns, hooks, collisionFactor = 0) {
  if (troop.dead || (troop.massClass || "medium") === "heavy") return false;
  const destination = clamp(troop.col + columns, FIELD.firstTroopCol, FIELD.lastTroopCol);
  const blocked = living(session).some((other) => other.id !== troop.id && other.row === troop.row && other.col === destination);
  if (blocked || destination === troop.col) { if (collisionFactor) hooks.damageTroop(session, troop, troop.maxHp * collisionFactor, hooks.events); return false; }
  troop.col = destination; troop.x = destination * CELL.width + CELL.width / 2; return true;
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
  if (attack === "tailSweep") living(session).filter((troop) => enemy.leviathanTargetRows.includes(troop.row)).forEach((troop) => { hooks.damageTroop(session, troop, troop.maxHp * config.tailSweep.damageMaxHpFactor, events); moveTroop(session, troop, enemy.leviathanSweepDirection || 1, { ...hooks, events }, config.tailSweep.collisionDamageMaxHpFactor); });
  if (attack === "brineJet") living(session).filter((troop) => enemy.leviathanTargetRows.includes(troop.row)).forEach((troop) => { hooks.damageTroop(session, troop, troop.maxHp * config.brineJet.damageMaxHpFactor, events); troop.leviathanBrineAttackSpeedFactor = config.brineJet.attackSpeedFactor; troop.leviathanBrineUntil = session.elapsed + config.brineJet.attackSpeedDurationMs; hooks.refreshTroop(session, troop); });
  if (attack === "predatoryVortex") living(session).filter((troop) => enemy.leviathanTargetRows.includes(troop.row)).forEach((troop) => { hooks.damageTroop(session, troop, troop.maxHp * config.predatoryVortex.damageMaxHpFactorPerPulse, events); moveTroop(session, troop, -1, { ...hooks, events }); });
  if (attack === "devastatingDive") { living(session).filter((troop) => enemy.leviathanTargetRows.includes(troop.row)).forEach((troop) => { hooks.damageTroop(session, troop, troop.maxHp * config.devastatingDive.impactDamageMaxHpFactor, events); moveTroop(session, troop, -1, { ...hooks, events }); }); }
  if (attack === "tideCommand") setTideOverride(session, enemy, config.tideCommand.extraLevels, config.tideCommand.durationMs, events);
  if (attack === "abyssRoar") session.enemies.filter((ally) => !ally.dead && ally.id !== enemy.id && aquatic(ally)).forEach((ally) => { ally.hp = Math.min(ally.maxHp, ally.hp + ally.maxHp * config.abyssRoar.healFactor); ally.leviathanRoarSpeedFactor = config.abyssRoar.speedFactor; ally.leviathanRoarUntil = session.elapsed + config.abyssRoar.buffDurationMs; });
  if (attack === "deluge") { living(session).forEach((troop) => { hooks.damageTroop(session, troop, Math.min(troop.maxHp * config.deluge.damageMaxHpFactor, Math.max(0, troop.hp - 1)), events); if ((troop.massClass || "medium") === "light") moveTroop(session, troop, -config.deluge.lightTroopPushTiles, { ...hooks, events }); troop.leviathanBrineAttackSpeedFactor = config.deluge.attackSpeedFactor; troop.leviathanBrineUntil = session.elapsed + config.deluge.attackSpeedDurationMs; hooks.refreshTroop(session, troop); }); setTideOverride(session, enemy, config.deluge.extraTideLevels, config.deluge.floodedDurationMs, events); enemy.leviathanDelugeUsed = true; session.enemyProjectiles = []; }
  events.push({ type: `leviathan${attack[0].toUpperCase()}${attack.slice(1)}Impact`, bossId: enemy.id, rows: [...enemy.leviathanTargetRows] });
}
function validAttack(session, enemy, attack) {
  if (attack === enemy.leviathanPreviousAttack || !attackReady(session, enemy, attack)) return false;
  if (attack === "biteAbyss" && !floodedTroops(session).length) return false;
  if (attack === "abyssRoar" && !session.enemies.some((ally) => !ally.dead && ally.id !== enemy.id && aquatic(ally))) return false;
  return !(attack === "deluge" && (enemy.leviathanPhase < 3 || enemy.leviathanDelugeUsed));
}
function choose(session, enemy) {
  const candidates = LEVIATHAN_PHASE_ATTACKS[enemy.leviathanPhase].filter((attack) => validAttack(session, enemy, attack));
  if (!candidates.length) return null;
  const total = candidates.reduce((sum, attack) => sum + LEVIATHAN_ATTACK_WEIGHTS[attack], 0); let roll = session.rng() * total;
  return candidates.find((attack) => ((roll -= LEVIATHAN_ATTACK_WEIGHTS[attack]) <= 0)) || candidates.at(-1);
}
function startAttack(session, enemy, attack, config, events) {
  enemy.leviathanQueuedAttack = attack; enemy.leviathanPreviousAttack = attack;
  const phase = enemy.leviathanPhase;
  const rows = attack === "tailSweep" ? config.tailSweep[`rowsPhase${phase === 1 ? "One" : phase === 2 ? "Two" : "Three"}`] : 1;
  enemy.leviathanTargetRows = targetRows(session, enemy, attack === "deluge" ? 5 : rows);
  if (attack === "biteAbyss") enemy.leviathanTargetTroopIds = floodedTroops(session).sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp || b.col - a.col).slice(0, config.biteAbyss[`targetsPhase${phase === 1 ? "One" : phase === 2 ? "Two" : "Three"}`]).map((troop) => troop.id);
  else enemy.leviathanTargetTroopIds = living(session).filter((troop) => enemy.leviathanTargetRows.includes(troop.row)).map((troop) => troop.id);
  enemy.leviathanTargetCells = enemy.leviathanTargetTroopIds.map((troopId) => { const troop = session.troops.find((entry) => entry.id === troopId); return troop ? { row: troop.row, col: troop.col } : null; }).filter(Boolean);
  enemy.leviathanSweepDirection = session.rng() < .72 ? 1 : -1;
  const telegraph = attack === "deluge" ? config.deluge.chargeDurationMs : config[attack]?.telegraphMs || 0;
  const state = ({ biteAbyss: "biteAbyss", tailSweep: "tailSweep", brineJet: "brineJet", predatoryVortex: "vortexCast", devastatingDive: "submerge", tideCommand: "tideCommand", abyssRoar: "abyssRoar", deluge: "delugeCharge" })[attack];
  setState(session, enemy, state, telegraph + (config[attack]?.durationMs || config[attack]?.castDurationMs || config.deluge?.releaseDurationMs || 0));
  events.push({ type: "leviathanTelegraph", bossId: enemy.id, attack, rows: [...enemy.leviathanTargetRows], cells: [...enemy.leviathanTargetCells], endsAt: session.elapsed + telegraph });
}
export function updateLeviathan(session, enemy, config, hooks, events) {
  enemy._leviathanConfig = config;
  const ratio = enemy.hp / Math.max(1, enemy.maxHp); const phase = ratio <= config.phaseThreeHpFactor ? 3 : ratio <= config.phaseTwoHpFactor ? 2 : 1;
  if (phase !== enemy.leviathanPhase) { enemy.leviathanPhase = phase; events.push({ type: "leviathanPhaseChanged", enemyId: enemy.id, phase, x: enemy.x, y: enemy.y }); }
  if (session.tideCycle?.bossOverride?.sourceId === enemy.id && session.elapsed >= session.tideCycle.bossOverride.until) delete session.tideCycle.bossOverride;
  if (enemy.leviathanState === "spawnRise" && session.elapsed >= enemy.leviathanStateEndsAt) { setState(session, enemy, "idleSurface"); enemy.leviathanGlobalAttackReadyAt = session.elapsed + 1500; return; }
  if (enemy.leviathanState === "submerge" && session.elapsed >= enemy.leviathanStateStartedAt + config.devastatingDive.submergeDurationMs) { setState(session, enemy, "submergedTravel", config.devastatingDive.travelDurationMs); return; }
  if (enemy.leviathanState === "submergedTravel" && session.elapsed >= enemy.leviathanStateEndsAt) { setState(session, enemy, "emergeImpact", config.devastatingDive.emergeDurationMs); return; }
  if (enemy.leviathanState === "emergeImpact" && !enemy.leviathanAttackApplied && session.elapsed >= enemy.leviathanStateStartedAt + config.devastatingDive.emergeDurationMs * .65) { applyAttack(session, enemy, "devastatingDive", config, hooks, events); enemy.leviathanAttackApplied = true; return; }
  if (enemy.leviathanState === "emergeImpact" && session.elapsed >= enemy.leviathanStateEndsAt) { enemy.leviathanExposedUntil = session.elapsed + config.devastatingDive.exposedDurationMs; setState(session, enemy, "exposedGills", config.devastatingDive.exposedDurationMs); return; }
  if (enemy.leviathanState === "exposedGills" && session.elapsed >= enemy.leviathanStateEndsAt) { setState(session, enemy, "idleSurface"); return; }
  const attack = enemy.leviathanQueuedAttack;
  if (attack && enemy.leviathanState !== "idleSurface") {
    const attackConfig = config[attack]; const trigger = attack === "deluge" ? config.deluge.chargeDurationMs : attackConfig?.telegraphMs || Math.min(600, attackConfig?.castDurationMs || 0);
    if (attack === "predatoryVortex" && session.elapsed >= enemy.leviathanStateStartedAt + trigger) {
      const expectedPulses = Math.min(config.predatoryVortex.pulseCount, Math.floor((session.elapsed - enemy.leviathanStateStartedAt - trigger) / config.predatoryVortex.pulseEveryMs) + 1);
      while (enemy.leviathanPulseIndex < expectedPulses) {
        applyAttack(session, enemy, attack, config, hooks, events);
        enemy.leviathanPulseIndex += 1;
      }
      enemy.leviathanAttackApplied = enemy.leviathanPulseIndex >= config.predatoryVortex.pulseCount;
    }
    if (attack !== "predatoryVortex" && !enemy.leviathanAttackApplied && session.elapsed >= enemy.leviathanStateStartedAt + trigger) { applyAttack(session, enemy, attack, config, hooks, events); enemy.leviathanAttackApplied = true; }
    if (attack === "deluge" && enemy.leviathanAttackApplied && enemy.leviathanState === "delugeCharge") {
      setState(session, enemy, "delugeRelease", config.deluge.releaseDurationMs);
      enemy.leviathanAttackApplied = true;
      return;
    }
    if (session.elapsed >= enemy.leviathanStateEndsAt) { enemy[cooldownField[attack]] = session.elapsed + (config[attack]?.cooldownMs || 0) * cooldownFactor(enemy, config); enemy.leviathanGlobalAttackReadyAt = session.elapsed + config.globalAttackLockMs; enemy.leviathanQueuedAttack = null; setState(session, enemy, "idleSurface"); }
    return;
  }
  if (enemy.leviathanState !== "idleSurface" || session.elapsed < enemy.leviathanNextDecisionAt || session.elapsed < enemy.leviathanGlobalAttackReadyAt) return;
  enemy.leviathanNextDecisionAt = session.elapsed + config.attackDecisionEveryMs;
  const next = choose(session, enemy); if (next) startAttack(session, enemy, next, config, events);
}
