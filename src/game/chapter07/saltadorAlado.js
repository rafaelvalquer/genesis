import { CELL, FIELD } from "../visualGeometry.js";

const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
const living = (troop) => troop && !troop.dead;

function targetPriority(runtime, enemy, troop, config) {
  const escort = runtime.escortIds().includes(troop.id);
  if (escort) return 0;
  if (Math.abs(troop.x - runtime.convoyX()) <= config.escortInstinct.nearConvoyRadiusTiles * CELL.width) return 1;
  if ((runtime.phase?.convoy?.escortRows || [1, 3]).includes(troop.row)) return 2;
  return 3;
}

function chooseTarget(runtime, enemy, config) {
  const candidates = runtime.troops().filter((troop) => living(troop) && troop.row === enemy.row
    && troop.x <= enemy.x && enemy.x - troop.x <= config.escortInstinct.huntForwardTiles * CELL.width + CELL.width);
  if (!candidates.length) return null;
  if (!enemy.escortInstinctActive) return candidates.sort((a, b) => b.x - a.x || String(a.id).localeCompare(String(b.id)))[0];
  return [...candidates].sort((a, b) => targetPriority(runtime, enemy, a, config) - targetPriority(runtime, enemy, b, config)
    || Math.abs(a.x - runtime.convoyX()) - Math.abs(b.x - runtime.convoyX())
    || Math.abs(enemy.x - a.x) - Math.abs(enemy.x - b.x)
    || String(a.id).localeCompare(String(b.id)))[0];
}

function targetById(runtime, id) { return runtime.troops().find((troop) => troop.id === id && living(troop)) || null; }
function isActualEscort(runtime, troop) { return Boolean(troop && runtime.escortIds().includes(troop.id)); }

function setState(runtime, enemy, state, duration = Infinity) {
  enemy.saltadorState = state;
  enemy.saltadorStateStartedAt = runtime.elapsed;
  enemy.saltadorStateEndsAt = Number.isFinite(duration) ? runtime.elapsed + duration : Infinity;
}

function canLand(runtime, enemy, x) {
  if (x < FIELD.baseX || x > FIELD.width) return false;
  return !runtime.troops().some((troop) => living(troop) && troop.row === enemy.row && Math.abs(troop.x - x) < CELL.width * .55);
}

function beginCanopyJump(runtime, enemy, target, config, events) {
  const ideal = target.x - config.canopyJump.landingOffsetTiles * CELL.width;
  const offsets = [0, .1, -.1, .2, -.2, .25, -.25].map((value) => value * CELL.width);
  const landing = offsets.map((offset) => ideal + offset).find((x) => canLand(runtime, enemy, x));
  if (!Number.isFinite(landing)) return false;
  enemy.jumpTargetId = target.id; enemy.jumpStartX = enemy.x; enemy.jumpLandingX = landing;
  enemy.airborne = false; enemy.visualOffsetY = 0;
  setState(runtime, enemy, "jumpPrep", config.canopyJump.prepMs);
  enemy.moving = false;
  events.push({ type: "saltadorJumpStart", sourceEnemyId: enemy.id, jumpedTroopId: target.id });
  return true;
}

function updateJump(runtime, enemy, config, events) {
  if (enemy.saltadorState === "jumpPrep") {
    enemy.moving = false;
    if (runtime.elapsed < (enemy.stunnedUntil || 0)) { setState(runtime, enemy, "walking"); enemy.jumpTargetId = null; return; }
    if (runtime.elapsed >= enemy.saltadorStateEndsAt) {
      enemy.airborne = true; enemy.jumpAirStartedAt = runtime.elapsed;
      setState(runtime, enemy, "jumpAir", config.canopyJump.airMs);
    }
    return true;
  }
  if (enemy.saltadorState === "jumpAir") {
    const progress = clamp((runtime.elapsed - enemy.jumpAirStartedAt) / config.canopyJump.airMs, 0, 1);
    enemy.x = enemy.jumpStartX + (enemy.jumpLandingX - enemy.jumpStartX) * progress;
    enemy.visualOffsetY = -4 * config.canopyJump.heightTiles * CELL.height * progress * (1 - progress);
    enemy.moving = false; enemy.groundMeleeTargetable = false; enemy.groundRangedTargetable = true;
    if (runtime.elapsed >= enemy.saltadorStateEndsAt) {
      enemy.x = enemy.jumpLandingX; enemy.visualOffsetY = 0; enemy.airborne = false;
      enemy.canopyJumpReadyAt = runtime.elapsed + config.canopyJump.cooldownMinMs
        + runtime.rng() * (config.canopyJump.cooldownMaxMs - config.canopyJump.cooldownMinMs);
      enemy.escortInstinctActive = true; enemy.groundMeleeTargetable = true;
      setState(runtime, enemy, "jumpLand", config.canopyJump.landMs);
      events.push({ type: "saltadorJumpLand", sourceEnemyId: enemy.id, row: enemy.row, x: enemy.x });
      events.push({ type: "saltadorEscortLock", sourceEnemyId: enemy.id, targetTroopId: enemy.jumpTargetId });
    }
    return true;
  }
  if (enemy.saltadorState === "jumpLand") {
    enemy.moving = false;
    if (runtime.elapsed >= enemy.saltadorStateEndsAt) setState(runtime, enemy, "walking");
    return true;
  }
  return false;
}

function updateRasante(runtime, enemy, config, events) {
  if (enemy.saltadorState !== "rasante") return false;
  enemy.moving = false; enemy.groundMeleeTargetable = false;
  if (!enemy.rasanteImpactApplied && runtime.elapsed >= enemy.rasanteImpactAt) {
    enemy.rasanteImpactApplied = true;
    const target = targetById(runtime, enemy.rasanteTargetId);
    if (target && target.row === enemy.row && Math.abs(enemy.x - target.x) <= config.rasante.triggerRangeTiles * CELL.width) {
      const damage = enemy.damage * config.rasante.escortDamageMultiplier;
      runtime.damageTroop(target, damage, { sourceEnemyId: enemy.id });
      events.push({ type: "saltadorRasanteImpact", sourceEnemyId: enemy.id, targetTroopId: target.id, damage, multiplier: config.rasante.escortDamageMultiplier, x: target.x, y: target.y });
    }
  }
  if (runtime.elapsed >= enemy.saltadorStateEndsAt) {
    enemy.rasanteTargetId = null; enemy.rasanteImpactAt = Infinity; enemy.rasanteImpactApplied = false;
    enemy.rasanteReadyAt = runtime.elapsed + config.rasante.cooldownMs; enemy.groundMeleeTargetable = true;
    setState(runtime, enemy, "walking");
  }
  return true;
}

export function updateSaltadorAlado(runtime, enemy, config, dt, events) {
  if (enemy.dead) { enemy.airborne = false; enemy.visualOffsetY = 0; enemy.jumpTargetId = null; enemy.rasanteTargetId = null; enemy.rasanteImpactAt = Infinity; enemy.rasanteImpactApplied = true; return; }
  if (updateJump(runtime, enemy, config, events) || updateRasante(runtime, enemy, config, events)) return;
  if (enemy.saltadorState === "jumpPrep" || enemy.saltadorState === "jumpLand") return;
  if (runtime.elapsed < (enemy.stunnedUntil || 0)) { enemy.moving = false; return; }
  if (enemy.meleeAttackPending) {
    enemy.moving = false;
    if (runtime.elapsed >= enemy.meleeImpactAt) {
      const target = targetById(runtime, enemy.meleeTargetId);
      if (target && target.row === enemy.row && enemy.x - target.x <= runtime.troopBlockDistance(target)) {
        runtime.damageTroop(target, enemy.damage, { sourceEnemyId: enemy.id });
        events.push({ type: "melee", x: target.x, y: target.y, sourceEnemyId: enemy.id });
      }
      enemy.meleeAttackPending = false; enemy.meleeImpactAt = Infinity; enemy.meleeTargetId = null;
    }
    return;
  }
  const target = chooseTarget(runtime, enemy, config);
  if (!enemy.escortInstinctActive && target && runtime.elapsed >= enemy.canopyJumpReadyAt
    && enemy.x - target.x <= config.canopyJump.triggerRangeTiles * CELL.width
    && beginCanopyJump(runtime, enemy, target, config, events)) return;
  if (target && enemy.x - target.x <= runtime.troopBlockDistance(target)) {
    enemy.moving = false; enemy.targetKind = "troop"; enemy.targetId = target.id;
    if (enemy.escortInstinctActive && isActualEscort(runtime, target)
      && runtime.elapsed >= enemy.rasanteReadyAt) {
      enemy.rasanteTargetId = target.id; enemy.rasanteImpactAt = runtime.elapsed + config.rasante.impactMs;
      enemy.rasanteImpactApplied = false; setState(runtime, enemy, "rasante", config.rasante.prepMs + config.rasante.airMs + config.rasante.landMs);
    } else if (runtime.elapsed >= enemy.attackReadyAt) {
      enemy.meleeAttackPending = true; enemy.meleeAttackStartedAt = runtime.elapsed;
      enemy.meleeImpactAt = runtime.elapsed + config.attackVisual.impactMs; enemy.meleeTargetId = target.id;
      enemy.attackReadyAt = runtime.elapsed + config.attackEveryMs; enemy.lastAttackAt = runtime.elapsed;
    }
    return;
  }
  enemy.moving = true; runtime.moveEnemy(enemy, dt, events);
}

export const isActualEscortTarget = isActualEscort;
