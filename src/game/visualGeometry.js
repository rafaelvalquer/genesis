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

export function getTroopSpriteRect(troop, troopConfig = {}) {
  const height = troopConfig.attackVisual?.height
    || (troop.type === "muralhaReforcada" ? 112 : DEFAULT_TROOP_HEIGHT);
  return getSpriteRect(troop, height, troopConfig.attackVisual?.aspectRatio || 1);
}

export function getMuzzleWorldPosition(troop, troopConfig = {}, shotIndex = 0) {
  const shots = troopConfig.attackVisual?.shots || [];
  const shot = shots[Math.min(Math.max(0, shotIndex), Math.max(0, shots.length - 1))];
  const muzzle = shot?.muzzle || { x: 0.72, y: 0.52 };
  const rect = getTroopSpriteRect(troop, troopConfig);
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

  const visual = troopConfig.attackVisual;
  const attackAge = elapsed - troop.lastAttackAt;
  if (Number.isFinite(attackAge) && attackAge >= 0 && attackAge < (visual?.durationMs || 420)) {
    const count = Math.max(1, frameCounts.attack || 1);
    const timeline = visual?.shots || [];
    if (!timeline.length) return { state: "attack", frame: Math.floor(attackAge / 85) % count };

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
    return { state: "attack", frame: Math.min(count - 1, Math.max(0, frame)) };
  }

  const count = Math.max(1, frameCounts.idle || 1);
  return { state: "idle", frame: Math.floor(elapsed / 85) % count };
}
