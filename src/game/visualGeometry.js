export const FIELD = { width: 1000, height: 600, rows: 5, cols: 10, baseX: 18 };
export const CELL = { width: FIELD.width / FIELD.cols, height: FIELD.height / FIELD.rows };

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

export function getEnemySpriteRect(enemy) {
  return getSpriteRect(enemy, DEFAULT_ENEMY_HEIGHT * (enemy.scale || 1));
}

export function getEnemyHitPoint(enemy) {
  const rect = getEnemySpriteRect(enemy);
  return {
    x: rect.x + rect.width * 0.5,
    y: rect.y + rect.height * 0.55,
  };
}

export function getEnemyMuzzleWorldPosition(enemy, enemyConfig = {}) {
  const scale = enemy.scale || enemyConfig.scale || 1;
  const visualEnemy = enemyConfig.spriteOffsetY
    ? { ...enemy, y: enemy.y + enemyConfig.spriteOffsetY * scale }
    : enemy;
  const rect = getSpriteRect(visualEnemy, DEFAULT_ENEMY_HEIGHT * scale);
  const muzzle = enemyConfig.attackVisual?.muzzle || { x: 0.25, y: 0.25 };
  return { x: rect.x + rect.width * muzzle.x, y: rect.y + rect.height * muzzle.y };
}

export function getEnemyAnimation(enemy, enemyConfig, elapsed, frameCounts = {}) {
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

  if (enemyConfig.attack !== "arcane") {
    const state = elapsed - enemy.lastAttackAt < 520 ? "attack" : "walking";
    const count = Math.max(1, frameCounts[state] || frameCounts.walking || 1);
    return { state, frame: Math.floor(elapsed / 75) % count };
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
  return { state, frame: Math.floor(elapsed / 110) % count };
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
