import { ENEMY_FRAME_ANCHORS } from "./enemyAnchors.generated.js";

export const FIELD = {
  width: 1100,
  height: 600,
  rows: 5,
  cols: 11,
  baseX: 118,
  spawnX: 1140,
  combatOffsetX: 100,
  defenseCol: 0,
  firstTroopCol: 1,
  lastTroopCol: 9,
  enemyEntryCol: 10,
};
export const CELL = { width: FIELD.width / FIELD.cols, height: FIELD.height / FIELD.rows };
export const VIEWPORT = {
  width: FIELD.width,
  height: FIELD.height + 80,
  fieldOffsetY: 80,
};

export function viewportPointToFieldPoint(x, y) {
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  if (x < 0 || x >= VIEWPORT.width || y < VIEWPORT.fieldOffsetY || y >= VIEWPORT.height) return null;
  return { x, y: y - VIEWPORT.fieldOffsetY };
}

const DEFAULT_TROOP_HEIGHT = 126;
const DEFAULT_ENEMY_HEIGHT = 128;

export function getSpriteRect(entity, targetHeight, aspectRatio = 1) {
  const height = targetHeight;
  const width = targetHeight * aspectRatio;
  return {
    x: entity.x - width / 2,
    y: entity.y + CELL.height * 0.43 - height,
    width,
    height,
  };
}

export function getAnchoredSpriteRect(entity, targetHeight, aspectRatio = 1, anchor = null) {
  const rect = getSpriteRect(entity, targetHeight * (anchor?.scale || 1), aspectRatio);
  if (!anchor) return rect;
  return {
    ...rect,
    x: rect.x + rect.width * (0.5 - anchor.x),
    y: rect.y + rect.height * (1 - anchor.y),
  };
}

export function getTroopFrameAnchor(troopConfig = {}, state = "idle", frame = 0) {
  const anchors = troopConfig.attackVisual?.frameAnchors?.[state];
  if (!anchors?.length) return null;
  return anchors[Math.min(Math.max(0, frame), anchors.length - 1)] || null;
}

export function getTroopAttackVisual(troop, troopConfig = {}) {
  if (troop?.type === "medicaNanites") {
    if (troop.state === "healing") return troopConfig.healVisual || troopConfig.attackVisual;
    if (troop.state === "cooldown") return troopConfig.cooldownVisual || troopConfig.attackVisual;
  }
  if (troop?.type === "lumiUrsa7") {
    if (troop.state === "idle") return troopConfig.idleVisual || troopConfig.attackVisual;
    if (troop.state === "attack") return troopConfig.attackVisual;
    if (troop.state === "transitionIn") return troopConfig.transitionInVisual || troopConfig.attackVisual;
    if (troop.state === "defense") return troopConfig.defenseVisual || troopConfig.attackVisual;
    if (troop.state === "transitionOut") return troopConfig.transitionOutVisual || troopConfig.attackVisual;
  }
  if (troop?.type === "executorArco") {
    if (troop.state === "idle") return troopConfig.idleVisual;
    if (troop.state === "attackRanged") return troopConfig.rangedAttackVisual || troopConfig.idleVisual;
    return troopConfig.attackVisuals?.[troop.lastAttackMode] || troopConfig.idleVisual;
  }
  return troopConfig.attackVisuals?.[troop?.lastAttackMode] || troopConfig.attackVisual;
}

export function getTroopSpriteRect(troop, troopConfig = {}) {
  const visual = getTroopAttackVisual(troop, troopConfig);
  const height = visual?.height || troopConfig.attackVisual?.height
    || (troop.type === "muralhaReforcada" ? 112 : DEFAULT_TROOP_HEIGHT);
  return getSpriteRect(troop, height, visual?.aspectRatio || troopConfig.attackVisual?.aspectRatio || 1);
}

export function getMuzzleWorldPosition(troop, troopConfig = {}, shotIndex = 0, animationFrame = null) {
  const visual = getTroopAttackVisual(troop, troopConfig) || {};
  const shots = visual.shots || [];
  const shot = shots[Math.min(Math.max(0, shotIndex), Math.max(0, shots.length - 1))];
  const frameMuzzles = visual.frameMuzzles || [];
  const frame = animationFrame == null ? (shot?.frame || 0) : animationFrame;
  const muzzle = frameMuzzles[Math.min(Math.max(0, frame), Math.max(0, frameMuzzles.length - 1))]
    || shot?.muzzle
    || visual.muzzle
    || { x: 0.72, y: 0.52 };
  const state = visual.state || "attack";
  const anchor = getTroopFrameAnchor(troopConfig, state, frame);
  const rect = anchor
    ? getAnchoredSpriteRect(
      troop,
      visual.height || troopConfig.attackVisual?.height || DEFAULT_TROOP_HEIGHT,
      visual.aspectRatio || troopConfig.attackVisual?.aspectRatio || 1,
      anchor,
    )
    : getTroopSpriteRect(troop, troopConfig);
  return {
    x: rect.x + rect.width * muzzle.x,
    y: rect.y + rect.height * muzzle.y,
  };
}

export function getEnemyFrameAnchor(enemyConfig = {}, state = "idle", frame = 0) {
  const states = ENEMY_FRAME_ANCHORS[enemyConfig.id];
  const anchors = states?.[state] || states?.idle || states?.walking;
  if (!anchors?.length) return enemyConfig.airborne ? { x: 0.5, y: 0.5 } : { x: 0.5, y: 1 };
  return anchors[Math.min(Math.max(0, frame), anchors.length - 1)];
}

export function getEnemySpriteRect(enemy, enemyConfig = {}, state = "idle", frame = 0, aspectRatio = 1) {
  const scale = enemy.scale || enemyConfig.scale || 1;
  const visualStateScale = enemyConfig.visualStateScale?.[state] || 1;
  const height = DEFAULT_ENEMY_HEIGHT * scale * visualStateScale;
  const width = height * aspectRatio;
  const anchor = getEnemyFrameAnchor(enemyConfig, state, frame);
  const offsetY = (enemyConfig.spriteOffsetY || 0) * scale;
  const stateOffsetY = (enemyConfig.visualStateOffsetY?.[state] || 0) * scale;
  const anchorY = enemy.y + offsetY + stateOffsetY
    + (enemyConfig.airborne ? 0 : CELL.height * 0.43);
  return {
    x: enemy.x - width * anchor.x,
    y: anchorY - height * anchor.y,
    width,
    height,
  };
}

export function getEnemyHitPoint(enemy, enemyConfig = {}) {
  const rect = getEnemySpriteRect(enemy, enemyConfig);
  return {
    x: enemy.x,
    y: rect.y + rect.height * 0.55,
  };
}

export function getEnemyMuzzleWorldPosition(enemy, enemyConfig = {}) {
  const rect = getEnemySpriteRect(enemy, enemyConfig, "attack", 0);
  const muzzle = enemyConfig.attackVisual?.muzzle || { x: 0.25, y: 0.25 };
  return { x: rect.x + rect.width * muzzle.x, y: rect.y + rect.height * muzzle.y };
}

export function getEnemyAnimation(enemy, enemyConfig, elapsed, frameCounts = {}) {
  if (enemyConfig.id === "silicaDigger" && enemy.emergeState === "emerging") {
    const state = "emerging";
    const count = Math.max(1, frameCounts[state] || frameCounts.idle || 1);
    const age = Math.max(0, elapsed - enemy.emergeStartedAt);
    const progress = Math.min(0.999, age / Math.max(1, enemyConfig.emergeDurationMs));
    return { state, frame: Math.min(count - 1, Math.floor(progress * count)) };
  }

  if (enemyConfig.id === "scarabEmperor") {
    const state = enemy.scarabState || `phase${enemy.bossPhase || 1}${enemy.moving ? "Walking" : "Idle"}`;
    const count = Math.max(1, frameCounts[state] || frameCounts.phase1Idle || 1);
    const age = Math.max(0, elapsed - (enemy.scarabStateStartedAt || 0));
    if (state === "transitionPhase1To2" || state === "transitionPhase2To3") {
      const duration = state === "transitionPhase1To2"
        ? enemyConfig.transitionPhase1To2.durationMs
        : enemyConfig.transitionPhase2To3.durationMs;
      return { state, frame: Math.min(count - 1, Math.floor(Math.min(0.999, age / duration) * count)) };
    }
    if (state.endsWith("Attack")) {
      const phase = enemyConfig[`phase${enemy.bossPhase || 1}`] || enemyConfig.phase1;
      return {
        state,
        frame: Math.min(count - 1, Math.floor(Math.min(0.999, age / phase.attackDurationMs) * count)),
      };
    }
    const frameMs = enemyConfig.animationFrameMs?.[state] || 110;
    return { state, frame: Math.floor(age / frameMs) % count };
  }

  if (enemyConfig.id === "workerQueenEgg") {
    const hatching = elapsed >= enemy.eggHatchAt - enemyConfig.hatchVisualMs;
    const state = hatching ? "hatch" : "idle";
    const count = Math.max(1, frameCounts[state] || frameCounts.idle || 1);
    if (hatching) {
      const progress = Math.min(0.999, Math.max(0, (elapsed - (enemy.eggHatchAt - enemyConfig.hatchVisualMs))
        / Math.max(1, enemyConfig.hatchVisualMs)));
      return { state, frame: Math.min(count - 1, Math.floor(progress * count)) };
    }
    return { state, frame: Math.floor(Math.max(0, elapsed - (enemy.eggCreatedAt || 0))
      / (enemyConfig.animationFrameMs?.idle || 165)) % count };
  }

  if (enemyConfig.id === "workerQueen") {
    const stunned = elapsed < (enemy.stunnedUntil || 0);
    const state = stunned ? "stunned" : enemy.queenState || (enemy.moving ? "walking" : "idle");
    const count = Math.max(1, frameCounts[state] || frameCounts.idle || frameCounts.walking || 1);
    const age = Math.max(0, elapsed - (enemy.queenStateStartedAt || 0));
    const duration = ({
      spawn: enemyConfig.spawnDurationMs,
      webAttack: enemyConfig.webAttackVisual.durationMs,
      eggLay: enemyConfig.eggLayVisual.durationMs,
      meleeAttack: enemyConfig.meleeAttackVisual.durationMs,
    })[state];
    if (Number.isFinite(duration)) {
      const progress = Math.min(0.999, age / Math.max(1, duration));
      return { state, frame: Math.min(count - 1, Math.floor(progress * count)) };
    }
    return { state, frame: Math.floor(age / (enemyConfig.animationFrameMs?.[state] || 150)) % count };
  }

  if (enemyConfig.id === "duneRipper") {
    const state = enemy.duneState || (enemy.moving ? "walking" : "idle");
    const count = Math.max(1, frameCounts[state] || frameCounts.idle || frameCounts.walking || 1);
    const age = Math.max(0, elapsed - (enemy.duneStateStartedAt || 0));
    if (state === "attack" || state === "roar") {
      const duration = state === "attack"
        ? enemyConfig.attackVisual.durationMs
        : enemyConfig.roarDurationMs;
      const progress = Math.min(0.999, age / Math.max(1, duration));
      return { state, frame: Math.min(count - 1, Math.floor(progress * count)) };
    }
    const frameMs = enemyConfig.animationFrameMs?.[state] || 110;
    return { state, frame: Math.floor(age / frameMs) % count };
  }

  if (enemyConfig.id === "ramBeetle") {
    const state = enemy.ramState || (enemy.moving ? "walking" : "idle");
    const count = Math.max(1, frameCounts[state] || frameCounts.idle || frameCounts.walking || 1);
    const age = Math.max(0, elapsed - (enemy.ramStateStartedAt || 0));
    if (state === "chargePrep") {
      const progress = Math.min(0.999, age / Math.max(1, enemyConfig.chargePrepMs));
      return { state, frame: Math.min(count - 1, Math.floor(progress * count)) };
    }
    if (state === "attack") {
      const progress = Math.min(0.999, age / Math.max(1, enemyConfig.attackVisual.durationMs));
      return { state, frame: Math.min(count - 1, Math.floor(progress * count)) };
    }
    if (state === "idle" && enemy.ramIdleMode === "recover") {
      const progress = Math.min(0.999, age / Math.max(1, enemyConfig.recoverMs));
      return { state, frame: Math.min(count - 1, Math.floor(progress * count)) };
    }
    if (state === "idle" && count > 1) {
      const cooldownFrames = Math.min(2, count);
      return { state, frame: count - cooldownFrames + Math.floor(age / 220) % cooldownFrames };
    }
    const frameMs = enemyConfig.animationFrameMs?.[state] || 90;
    return { state, frame: Math.floor(age / frameMs) % count };
  }

  if (enemy.jumping) {
    const count = Math.max(1, frameCounts.jump || frameCounts.walking || 1);
    const progress = Math.max(0, Math.min(0.999, Number(enemy.jumpProgress) || 0));
    return { state: "jump", frame: Math.min(count - 1, Math.floor(progress * count)) };
  }

  if (enemy.attachedToTroopId) {
    const attacking = elapsed - enemy.lastAttackAt < 300;
    const state = attacking ? "attack" : "idle";
    const count = Math.max(1, frameCounts[state] || frameCounts.idle || frameCounts.attack || 1);
    return { state, frame: Math.floor(elapsed / 75) % count };
  }

  const pulseAge = elapsed - enemy.lastShieldPulseAt;
  if (enemyConfig.id === "crisalio" && Number.isFinite(pulseAge)
    && pulseAge >= 0 && pulseAge < enemyConfig.shieldPulseVisualMs) {
    const count = Math.max(1, frameCounts.pulse || 1);
    return {
      state: "pulse",
      frame: Math.min(count - 1, Math.floor(pulseAge / enemyConfig.shieldPulseVisualMs * count)),
    };
  }

  if (enemyConfig.attack !== "arcane") {
    const attackAge = elapsed - enemy.lastAttackAt;
    const attackDurationMs = enemyConfig.attackVisual?.durationMs || 520;
    if (Number.isFinite(attackAge) && attackAge >= 0 && attackAge < attackDurationMs) {
      const count = Math.max(1, frameCounts.attack || 1);
      return {
        state: "attack",
        frame: Math.min(count - 1, Math.floor(attackAge / attackDurationMs * count)),
      };
    }

    const state = enemy.moving === false ? "idle" : "walking";
    const count = Math.max(1, frameCounts[state] || frameCounts.walking || frameCounts.idle || 1);
    const frameMs = enemyConfig.animationFrameMs?.[state] || 90;
    return { state, frame: Math.floor(elapsed / frameMs) % count };
  }

  const attackCount = Math.max(1, frameCounts.attack || 1);
  const chargeFrames = Math.max(1, attackCount - Math.min(4, attackCount - 1));
  if (enemy.casting) {
    const progress = Math.max(0, Math.min(0.999, (elapsed - enemy.castStartedAt) / Math.max(1, enemyConfig.chargeMs)));
    return { state: "attack", frame: Math.min(chargeFrames - 1, Math.floor(progress * chargeFrames)) };
  }

  const releaseMs = enemyConfig.attackVisual?.releaseMs || 400;
  const attackAge = elapsed - enemy.lastAttackAt;
  if (Number.isFinite(attackAge) && attackAge >= 0 && attackAge < releaseMs) {
    const releaseFrames = Math.max(1, attackCount - chargeFrames);
    return {
      state: "attack",
      frame: Math.min(attackCount - 1, chargeFrames + Math.floor(attackAge / releaseMs * releaseFrames)),
    };
  }

  const state = enemy.moving ? "walking" : "idle";
  const count = Math.max(1, frameCounts[state] || frameCounts.idle || frameCounts.walking || 1);
  const frameMs = enemyConfig.animationFrameMs?.[state] || 110;
  return { state, frame: Math.floor(elapsed / frameMs) % count };
}

export function isEnemyFrozen(enemy, elapsed) {
  return !enemy?.dead && Number.isFinite(enemy?.slowUntil) && elapsed < enemy.slowUntil;
}

export function getWallDamageFrame(troop, frameCount = 3) {
  const maxHp = Math.max(1, troop.maxHp || 1);
  const hpPercent = Math.max(0, Math.min(100, troop.hp / maxHp * 100));
  const damageFrame = hpPercent >= 80 ? 0 : hpPercent >= 30 ? 1 : 2;
  return Math.min(Math.max(0, frameCount - 1), damageFrame);
}

function interpolateFrame(left, right, ageMs) {
  if (!right || right.atMs <= left.atMs) return left.frame;
  const holdUntil = Math.min(right.atMs, left.atMs + 32);
  const progress = Math.max(0, Math.min(1, (ageMs - holdUntil) / Math.max(1, right.atMs - holdUntil)));
  return Math.round(left.frame + (right.frame - left.frame) * progress);
}

export function getTroopAnimation(troop, troopConfig, elapsed, frameCounts = {}) {
  if (troop.type === "muralhaReforcada") {
    const count = Math.max(1, frameCounts.defense || frameCounts.idle || 1);
    return { state: "defense", frame: getWallDamageFrame(troop, count) };
  }

  const visual = getTroopAttackVisual(troop, troopConfig);
  if (troop.type === "medicaNanites" && ["healing", "cooldown"].includes(troop.state)) {
    const state = troop.state === "healing" ? "heal" : "cooldown";
    const count = Math.max(1, frameCounts[state] || 1);
    const duration = Math.max(1, visual?.durationMs || 800);
    const age = Math.max(0, elapsed - troop.stateStartedAt);
    return { state, frame: Math.floor(age / (duration / count)) % count };
  }
  if (troop.type === "medicaNanites" && troop.state === "attacking") {
    const count = Math.max(1, frameCounts.attack || 1);
    const duration = Math.max(1, troopConfig.attackVisual?.durationMs || 480);
    const attackAge = elapsed - troop.lastAttackAt;
    if (Number.isFinite(attackAge) && attackAge >= 0 && attackAge < duration) {
      return {
        state: "attack",
        frame: Math.min(count - 1, Math.floor(attackAge / (duration / count))),
      };
    }
  }
  if (troop.type === "lumiUrsa7" && ["transitionIn", "defense", "transitionOut"].includes(troop.state)) {
    const state = troop.state;
    const count = Math.max(1, frameCounts[state] || 1);
    const duration = Math.max(1, visual?.durationMs || 720);
    const age = Math.max(0, elapsed - troop.stateStartedAt);
    const frame = visual?.loop
      ? Math.floor(age / (duration / count)) % count
      : Math.min(count - 1, Math.floor(age / (duration / count)));
    return { state, frame };
  }
  if (troop.type === "lumiUrsa7" && troop.state === "idle") {
    const count = Math.max(1, frameCounts.idle || 1);
    const idleVisual = troopConfig.idleVisual || {};
    const duration = Math.max(1, idleVisual.durationMs || 1600);
    const age = Math.max(0, elapsed - troop.stateStartedAt);
    const cycleAge = age % duration;
    const timeline = idleVisual.timeline || [];
    if (!timeline.length) return { state: "idle", frame: Math.floor(cycleAge / (duration / count)) % count };
    let frame = timeline[0].frame;
    for (let index = 1; index < timeline.length; index += 1) {
      if (cycleAge < timeline[index].atMs) break;
      frame = timeline[index].frame;
    }
    return { state: "idle", frame: Math.min(count - 1, Math.max(0, frame)) };
  }
  const attackState = visual?.state || "attack";
  if (troopConfig.attack === "flame" && troop.channelingAttack) {
    const count = Math.max(1, frameCounts[attackState] || frameCounts.attack || 1);
    const duration = Math.max(1, visual?.durationMs || 640);
    const cycleAge = ((elapsed - troop.attackStartedAt) % duration + duration) % duration;
    const timeline = visual?.timeline || [];
    if (!timeline.length) return { state: attackState, frame: Math.floor(cycleAge / (duration / count)) % count };
    let frame = timeline[0].frame;
    for (let index = 1; index < timeline.length; index += 1) {
      if (cycleAge < timeline[index].atMs) break;
      frame = timeline[index].frame;
    }
    return { state: attackState, frame: Math.min(count - 1, Math.max(0, frame)) };
  }
  const attackAge = elapsed - troop.lastAttackAt;
  if (Number.isFinite(attackAge) && attackAge >= 0 && attackAge < (visual?.durationMs || 420)) {
    const count = Math.max(1, frameCounts[attackState] || frameCounts.attack || 1);
    const timeline = visual?.timeline || visual?.shots || [];
    if (!timeline.length) return { state: attackState, frame: Math.floor(attackAge / 85) % count };

    let left = timeline[0];
    let right = null;
    for (let index = 1; index < timeline.length; index += 1) {
      if (attackAge < timeline[index].atMs) {
        right = timeline[index];
        break;
      }
      left = timeline[index];
    }
    const frame = right
      ? interpolateFrame(left, right, attackAge)
      : left.frame + Math.floor(Math.max(0, attackAge - left.atMs - 32) / 85);
    return { state: attackState, frame: Math.min(count - 1, Math.max(0, frame)) };
  }

  const count = Math.max(1, frameCounts.idle || 1);
  const idleVisual = troopConfig.idleVisual;
  if (idleVisual?.timeline?.length && idleVisual.durationMs > 0) {
    const attackDuration = visual?.durationMs || 420;
    const idleAge = Number.isFinite(troop.lastAttackAt)
      ? Math.max(0, elapsed - troop.lastAttackAt - attackDuration)
      : elapsed;
    const cycleAge = ((idleAge % idleVisual.durationMs) + idleVisual.durationMs) % idleVisual.durationMs;
    let frame = idleVisual.timeline[0].frame;
    for (let index = 1; index < idleVisual.timeline.length; index += 1) {
      if (cycleAge < idleVisual.timeline[index].atMs) break;
      frame = idleVisual.timeline[index].frame;
    }
    return { state: "idle", frame: Math.min(count - 1, Math.max(0, frame)) };
  }
  return { state: "idle", frame: Math.floor(elapsed / 85) % count };
}

export function getRepulsorKnockbackOffset(entity, elapsed, reduceMotion = false) {
  if (reduceMotion || !Number.isFinite(entity?.knockbackVisualOffset)
    || !Number.isFinite(entity?.knockbackVisualStartedAt)
    || !Number.isFinite(entity?.knockbackVisualEndsAt)) return 0;
  const duration = entity.knockbackVisualEndsAt - entity.knockbackVisualStartedAt;
  if (duration <= 0 || elapsed >= entity.knockbackVisualEndsAt) return 0;
  const progress = Math.max(0, Math.min(1, (elapsed - entity.knockbackVisualStartedAt) / duration));
  const eased = 1 - (1 - progress) ** 3;
  return entity.knockbackVisualOffset * (1 - eased);
}

export function writeInterpolatedPosition(entity, alpha, out = {}) {
  const previousX = Number.isFinite(entity.previousRenderX) ? entity.previousRenderX : entity.x;
  const previousY = Number.isFinite(entity.previousRenderY) ? entity.previousRenderY : entity.y;
  out.x = previousX + (entity.x - previousX) * alpha;
  out.y = previousY + (entity.y - previousY) * alpha;
  return out;
}

export function writeWindMotionPosition(entity, elapsed, reduceMotion, out = {}) {
  const motion = entity?.windMotion;
  if (reduceMotion || !motion || elapsed >= motion.endsAt) {
    out.x = entity.x;
    out.y = entity.y;
    return out;
  }
  const duration = Math.max(1, motion.endsAt - motion.startedAt);
  const progress = Math.max(0, Math.min(1, (elapsed - motion.startedAt) / duration));
  const eased = 1 - (1 - progress) ** 3;
  out.x = motion.fromX + (motion.toX - motion.fromX) * eased;
  out.y = motion.fromY + (motion.toY - motion.fromY) * eased
    - Math.sin(progress * Math.PI) * 20;
  return out;
}

export function writeEnemyVisualPosition(entity, config, elapsed, alpha, reduceMotion, out = {}) {
  if (entity.windMotion && elapsed < entity.windMotion.endsAt) {
    writeWindMotionPosition(entity, elapsed, reduceMotion, out);
  } else {
    writeInterpolatedPosition(entity, alpha, out);
  }
  out.x += getRepulsorKnockbackOffset(entity, elapsed, reduceMotion);
  if (entity.attachedToTroopId) {
    out.y += config.attachmentOffsetY || 0;
  } else if (entity.jumping) {
    const progress = Math.max(0, Math.min(1, Number(entity.jumpProgress) || 0));
    out.y -= (config.jumpArcHeight || 0) * 4 * progress * (1 - progress);
  }
  return out;
}

export function createBattleRowBuffers(rowCount = FIELD.rows) {
  return {
    rows: Array.from({ length: rowCount }, () => []),
    pool: [],
    poolCursor: 0,
    position: { x: 0, y: 0 },
    troopScratch: {},
    enemyScratch: {},
  };
}

function insertRenderEntry(state, kind, entity, x, y) {
  let entry = state.pool[state.poolCursor];
  if (!entry) {
    entry = { kind, entity, x, y };
    state.pool.push(entry);
  }
  state.poolCursor += 1;
  entry.kind = kind;
  entry.entity = entity;
  entry.x = x;
  entry.y = y;

  const row = state.rows[entity.row];
  if (!row) return;
  let index = row.length;
  row.push(entry);
  while (index > 0 && row[index - 1].x > x) {
    row[index] = row[index - 1];
    index -= 1;
  }
  row[index] = entry;
}

export function buildBattleRenderRows(troops, enemies, interpolation, elapsed, reduceMotion = false, buffers = createBattleRowBuffers()) {
  buffers.poolCursor = 0;
  for (const row of buffers.rows) row.length = 0;
  for (const troop of troops) {
    writeWindMotionPosition(troop, elapsed, reduceMotion, buffers.position);
    insertRenderEntry(buffers, "troop", troop, buffers.position.x, buffers.position.y);
  }
  for (const enemy of enemies) {
    if (enemy.windMotion && elapsed < enemy.windMotion.endsAt) {
      writeWindMotionPosition(enemy, elapsed, reduceMotion, buffers.position);
    } else {
      writeInterpolatedPosition(enemy, interpolation, buffers.position);
    }
    insertRenderEntry(
      buffers,
      "enemy",
      enemy,
      buffers.position.x + getRepulsorKnockbackOffset(enemy, elapsed, reduceMotion),
      buffers.position.y,
    );
  }
  return buffers;
}
