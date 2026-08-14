/** MANTIS: artilharia de saturação com seis micro-mísseis guiados. */

export function selectMantisTargets(session, troop, config, { enemyOccupiesTargetRow, isEnemyTargetable, cellWidth = 64 }) {
  const maxDistance = config.range * cellWidth;
  return session.enemies
    .filter((enemy) => isEnemyTargetable(enemy)
      && enemyOccupiesTargetRow(enemy, troop.row)
      && enemy.x >= troop.x
      && enemy.x - troop.x <= maxDistance)
    .sort((left, right) => right.x - left.x
      || (Number(right.speed) || 0) - (Number(left.speed) || 0)
      || left.id.localeCompare(right.id))
    .slice(0, Math.max(1, config.maxTargets || config.salvoSize || 6));
}

export function distributeMantisSalvo(targets, salvoSize = 6) {
  if (!targets.length) return [];
  return Array.from({ length: salvoSize }, (_, index) => targets[index % targets.length]);
}

export function updateMantis(session, troop, config, events, deps) {
  if (troop.state === "targetLock" && session.elapsed >= troop.mantisFireAt) {
    const targets = selectMantisTargets(session, troop, config, deps);
    const assignments = distributeMantisSalvo(targets, config.salvoSize);
    if (assignments.length) {
      assignments.forEach((target, shotIndex) => {
        const origin = deps.getMuzzleWorldPosition(troop, config, shotIndex % 3);
        session.projectiles.push({
          id: deps.id("mantis_spike"), kind: "mantisSpike", visualKind: "mantisSpike",
          troopType: troop.type, sourceTroopId: troop.id, targetId: target.id, shotIndex,
          x: origin.x, y: origin.y, previousX: origin.x, previousY: origin.y,
          previousRenderX: origin.x, previousRenderY: origin.y, origin: { ...origin },
          ageMs: 0, trail: deps.createProjectileTrail(10, origin.x, origin.y),
          vx: config.projectileSpeed, vy: 0, speed: config.projectileSpeed,
          damage: config.damage * deps.damageMultiplier(target), color: config.color,
          active: true, launched: false, seed: deps.nextEffectSeed(),
          launchAt: session.elapsed + (config.burstIntervalMs || 0) * shotIndex,
        });
      });
      troop.mantisTargets = assignments.map((target) => target.id);
      troop.state = "attackBurst";
      troop.stateStartedAt = session.elapsed;
      troop.stateEndsAt = session.elapsed + config.attackVisual.durationMs;
      troop.lastAttackAt = session.elapsed;
      events.push({ type: "mantisSalvo", sourceTroopId: troop.id, x: troop.x, y: troop.y - 32, color: config.color, seed: deps.nextEffectSeed(), count: assignments.length });
    } else {
      troop.state = "idle";
    }
    return;
  }
  if (troop.state === "attackBurst" && session.elapsed >= troop.stateEndsAt) {
    troop.state = "reload";
    troop.stateStartedAt = session.elapsed;
    troop.stateEndsAt = session.elapsed + config.reloadVisual.durationMs;
    return;
  }
  if (troop.state === "reload" && session.elapsed >= troop.stateEndsAt) {
    troop.state = "idle";
    troop.stateStartedAt = session.elapsed;
    troop.mantisTargets = [];
  }
  if (session.elapsed < troop.attackReadyAt || troop.state !== "idle") return;
  const targets = selectMantisTargets(session, troop, config, deps);
  if (!targets.length) return;
  troop.state = "targetLock";
  troop.stateStartedAt = session.elapsed;
  troop.stateEndsAt = session.elapsed + config.targetLockVisual.durationMs;
  troop.mantisFireAt = troop.stateEndsAt;
  troop.attackReadyAt = session.elapsed + deps.recoveryFor(config.attackEveryMs);
}
