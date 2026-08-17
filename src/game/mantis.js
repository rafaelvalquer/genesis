/** MANTIS V2: spikes-mísseis aderentes com trajetória em arco. */

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

export function createMantisSpike({ id, sourceTroopId, troopType, target, shotIndex, origin, now, config, trail, seed, damageMultiplier }) {
  return {
    id, kind: "mantisSpike", visualKind: "mantisSpike", troopType, sourceTroopId,
    targetId: target.id, targetRow: target.row, shotIndex,
    x: origin.x, y: origin.y, previousX: origin.x, previousY: origin.y,
    previousRenderX: origin.x, previousRenderY: origin.y, origin: { ...origin },
    ageMs: 0, trail, phase: "pending", launched: false,
    flightStartedAt: null, flightMs: config.spikeFlightMs, arcHeight: config.spikeArcHeight,
    impactDamage: config.impactDamage * damageMultiplier(target),
    detonationDamage: config.detonationDamage * damageMultiplier(target),
    detonationRadius: config.detonationRadius, detonationDelayMs: config.detonationDelayMs,
    launchAt: now + config.launchIntervalMs * shotIndex,
    color: config.color, active: true, seed,
  };
}

export function sampleMantisArc(spike, targetPoint, progress) {
  const t = Math.max(0, Math.min(1, progress));
  const p0 = spike.origin;
  const p1 = { x: p0.x + Math.max(54, (targetPoint.x - p0.x) * 0.42), y: p0.y - spike.arcHeight };
  const oneMinus = 1 - t;
  return {
    x: oneMinus * oneMinus * p0.x + 2 * oneMinus * t * p1.x + t * t * targetPoint.x,
    y: oneMinus * oneMinus * p0.y + 2 * oneMinus * t * p1.y + t * t * targetPoint.y,
  };
}

export function updateMantis(session, troop, config, events, deps) {
  if (troop.state === "targetLock" && session.elapsed >= troop.mantisFireAt) {
    const targets = selectMantisTargets(session, troop, config, deps);
    const assignments = distributeMantisSalvo(targets, config.salvoSize);
    if (!assignments.length) {
      troop.state = "idle";
      return;
    }
    // Switch to the attack pose before sampling the muzzle. This makes the
    // projectile originate from the raised crossbow, not the troop's torso.
    troop.state = "arcSpikeAttack";
    troop.stateStartedAt = session.elapsed;
    assignments.forEach((target, shotIndex) => {
      const origin = deps.getMuzzleWorldPosition(troop, config, shotIndex % 3, shotIndex % 3);
      session.projectiles.push(createMantisSpike({
        id: deps.id("mantis_spike"), sourceTroopId: troop.id, troopType: troop.type,
        target, shotIndex, origin, now: session.elapsed, config,
        trail: deps.createProjectileTrail(12, origin.x, origin.y),
        seed: deps.nextEffectSeed(), damageMultiplier: deps.damageMultiplier,
      }));
    });
    troop.mantisTargets = assignments.map((target) => target.id);
    troop.stateEndsAt = session.elapsed + config.attackVisual.durationMs;
    troop.lastAttackAt = session.elapsed;
    session.metrics.mantisSalvos = (session.metrics.mantisSalvos || 0) + 1;
    events.push({ type: "mantisSpikeSalvo", sourceTroopId: troop.id, x: troop.x, y: troop.y - 32, color: config.color, seed: deps.nextEffectSeed(), count: assignments.length });
    return;
  }
  if (troop.state === "arcSpikeAttack" && session.elapsed >= troop.stateEndsAt) {
    troop.state = "rearm";
    troop.stateStartedAt = session.elapsed;
    troop.stateEndsAt = session.elapsed + config.rearmVisual.durationMs;
    return;
  }
  if (troop.state === "rearm" && session.elapsed >= troop.stateEndsAt) {
    troop.state = "idle";
    troop.stateStartedAt = session.elapsed;
    troop.mantisTargets = [];
  }
  if (session.elapsed < troop.attackReadyAt || troop.state !== "idle") return;
  if (!selectMantisTargets(session, troop, config, deps).length) return;
  troop.state = "targetLock";
  troop.stateStartedAt = session.elapsed;
  troop.stateEndsAt = session.elapsed + config.targetLockVisual.durationMs;
  troop.mantisFireAt = troop.stateEndsAt;
  troop.attackReadyAt = session.elapsed + deps.recoveryFor(config.attackEveryMs);
}
