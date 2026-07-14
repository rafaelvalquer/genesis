import { ENEMIES, TROOPS } from "./content.js";
import { applyDecisionState, buildSpawnQueue, calculateStars, createRng } from "./domain.js";
import { CELL, FIELD, getEnemyHitPoint, getMuzzleWorldPosition } from "./visualGeometry.js";

export { CELL, FIELD } from "./visualGeometry.js";

let entityId = 1;
const id = (prefix) => `${prefix}_${entityId++}`;
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

export function createBattleSession(phase, loadout, seed = Date.now()) {
  return {
    phase,
    loadout: [...loadout],
    seed,
    rng: createRng(seed),
    elapsed: 0,
    energy: phase.energy,
    integrity: phase.baseIntegrity,
    supply: 20,
    supplyMax: 20,
    supplyAccumulator: 0,
    waveIndex: 0,
    waveActive: false,
    preparing: true,
    pendingDecision: null,
    queue: [],
    nextSpawnAt: 0,
    troops: [],
    enemies: [],
    projectiles: [],
    effects: [],
    effectSequence: 0,
    deployCooldowns: {},
    modifiers: { enemySpeed: 1, troopDamage: 1, slowDuration: 1 },
    decisions: [],
    killed: 0,
    deployed: {},
    outcome: null,
    result: null,
  };
}

export function canPlaceTroop(session, troopId, row, col) {
  const troop = TROOPS[troopId];
  if (!troop || !session.loadout.includes(troopId)) return "Tropa fora do loadout.";
  if (row < 0 || row >= FIELD.rows || col < 0 || col >= FIELD.cols - 1) return "Posição fora da zona de combate.";
  if (session.troops.some((entry) => !entry.dead && entry.row === row && entry.col === col)) return "Célula ocupada.";
  if (session.energy < troop.price) return `Energia insuficiente: requer ${troop.price}.`;
  if (session.supply < troop.supply) return `Supply insuficiente: requer ${troop.supply}.`;
  if (session.waveActive && Number(session.deployCooldowns[troopId] || 0) > session.elapsed) return "Implantação recarregando.";
  return null;
}

export function placeTroop(session, troopId, row, col) {
  const reason = canPlaceTroop(session, troopId, row, col);
  if (reason) return { ok: false, reason };
  const config = TROOPS[troopId];
  const troop = {
    id: id("troop"), type: troopId, row, col,
    x: col * CELL.width + CELL.width / 2,
    y: row * CELL.height + CELL.height / 2,
    hp: config.hp, maxHp: config.hp, attackReadyAt: 0,
    lastAttackAt: -Infinity, dead: false,
  };
  session.troops.push(troop);
  session.energy -= config.price;
  session.supply -= config.supply;
  session.deployed[troopId] = (session.deployed[troopId] || 0) + 1;
  if (session.waveActive) session.deployCooldowns[troopId] = session.elapsed + config.deployCooldownMs;
  return { ok: true, troop, event: { type: "deploy", x: troop.x, y: troop.y } };
}

export function removeTroop(session, row, col) {
  const index = session.troops.findIndex((troop) => !troop.dead && troop.row === row && troop.col === col);
  if (index < 0) return { ok: false, reason: "Nenhuma unidade nessa célula." };
  const [troop] = session.troops.splice(index, 1);
  const config = TROOPS[troop.type];
  const refund = Math.floor(config.price / 2);
  session.energy += refund;
  session.supply = Math.min(session.supplyMax, session.supply + config.supply);
  return { ok: true, refund, troop };
}

export function startWave(session) {
  if (session.outcome || session.waveActive || session.pendingDecision) return false;
  session.queue = buildSpawnQueue(session.phase, session.waveIndex, session.seed + session.waveIndex * 997);
  session.waveActive = true;
  session.preparing = false;
  session.nextSpawnAt = session.elapsed;
  return true;
}

export function selectDecision(session, option) {
  if (!session.pendingDecision?.some((entry) => entry.id === option.id)) return false;
  const next = applyDecisionState(session, option);
  if (next === session) return false;
  session.energy = next.energy;
  session.supply = next.supply;
  session.integrity = next.integrity;
  session.modifiers = next.modifiers;
  session.decisions.push({ wave: session.waveIndex, id: option.id });
  session.pendingDecision = null;
  return true;
}

function createEnemy(session, queued) {
  const base = ENEMIES[queued.type];
  const alpha = queued.variant === "alpha";
  const maxHp = base.hp * (alpha ? 8 : 1);
  const enemy = {
    id: id("enemy"), type: queued.type, variant: queued.variant,
    row: Math.floor(session.rng() * FIELD.rows),
    x: FIELD.width + 40, y: 0,
    hp: maxHp, maxHp,
    speed: base.speed * (alpha ? 0.75 : 1),
    damage: base.damage * (alpha ? 2 : 1),
    attackReadyAt: 0, lastAttackAt: -Infinity,
    slowUntil: 0, slowFactor: 1, bossPhase: 0,
    baseDamage: alpha ? 40 : base.baseDamage,
    scale: base.scale * (alpha ? 1.45 : 1),
    dead: false,
  };
  enemy.y = enemy.row * CELL.height + CELL.height / 2;
  session.enemies.push(enemy);
  return enemy;
}

function closestEnemy(session, troop, range) {
  return session.enemies
    .filter((enemy) => !enemy.dead && enemy.row === troop.row && enemy.x >= troop.x && enemy.x - troop.x <= range * CELL.width)
    .sort((left, right) => left.x - right.x)[0] || null;
}

function nextEffectSeed(session) {
  session.effectSequence += 1;
  return (session.seed + session.effectSequence * 997) >>> 0;
}

function damageEnemy(session, enemy, amount, events) {
  if (!enemy || enemy.dead) return;
  enemy.hp -= amount * session.modifiers.troopDamage;
  const hitPoint = getEnemyHitPoint(enemy);
  events.push({ type: "hit", x: hitPoint.x, y: hitPoint.y, color: ENEMIES[enemy.type].color });
  if (enemy.hp <= 0) {
    enemy.hp = 0;
    enemy.dead = true;
    session.killed += 1;
    events.push({ type: enemy.variant === "alpha" ? "bossDeath" : "enemyDeath", x: enemy.x, y: enemy.y });
  }
}

function fireTroop(session, troop, config, target, events) {
  const damage = config.damage;
  const origin = getMuzzleWorldPosition(troop, config, 0);
  const targetPoint = getEnemyHitPoint(target);
  const effectSeed = nextEffectSeed(session);
  if (config.attack === "melee") {
    damageEnemy(session, target, damage, events);
    events.push({ type: "melee", x: target.x, y: target.y });
  } else if (config.attack === "laser") {
    damageEnemy(session, target, damage, events);
    events.push({
      type: "beam", weapon: config.attackVisual?.effect || "laser", troopType: troop.type,
      sourceTroopId: troop.id, row: troop.row,
      x0: origin.x, y0: origin.y, x1: targetPoint.x, y1: origin.y,
      color: config.color, seed: effectSeed,
    });
  } else if (config.attack === "shotgun") {
    const targets = session.enemies
      .filter((enemy) => !enemy.dead && enemy.row === troop.row && enemy.x >= troop.x && enemy.x - troop.x <= config.range * CELL.width)
      .sort((left, right) => left.x - right.x)
      .slice(0, 3);
    targets.forEach((enemy, index) => damageEnemy(session, enemy, damage * config.pellets * (0.48 - index * 0.08), events));
    events.push({
      type: "shotgun", weapon: config.attackVisual?.effect || "shotgun", troopType: troop.type,
      sourceTroopId: troop.id, x0: origin.x, y0: origin.y,
      x1: origin.x + config.range * CELL.width, y1: origin.y,
      pellets: config.pellets, color: config.color, seed: effectSeed,
    });
  } else {
    const count = config.burst || 1;
    for (let shot = 0; shot < count; shot += 1) {
      const shotOrigin = getMuzzleWorldPosition(troop, config, shot);
      const dx = targetPoint.x - shotOrigin.x;
      const dy = targetPoint.y - shotOrigin.y;
      const distance = Math.max(1, Math.hypot(dx, dy));
      const speed = config.attack === "missile" ? 210 : 390;
      const straightLane = troop.type === "marine" || troop.type === "sniper" || troop.type === "krio" || troop.type === "guarda";
      session.projectiles.push({
        id: id("projectile"), kind: config.attack, troopType: troop.type,
        sourceTroopId: troop.id, shotIndex: shot, row: troop.row, straightLane,
        x: shotOrigin.x, y: shotOrigin.y, previousX: shotOrigin.x, previousY: shotOrigin.y,
        origin: { ...shotOrigin }, ageMs: 0, trail: [{ x: shotOrigin.x, y: shotOrigin.y }],
        vx: straightLane ? speed : dx / distance * speed,
        vy: straightLane ? 0 : dy / distance * speed,
        damage, targetId: target.id, radius: config.radius || 0,
        slowFactor: config.slowFactor, slowMs: config.slowMs,
        color: config.color, visualKind: config.attackVisual?.effect || config.attack,
        visualCount: config.attackVisual?.visualCount || 1,
        maxDistance: config.attack === "fireball" ? config.range * CELL.width : Infinity,
        active: true, launched: false, seed: effectSeed + shot,
        nextSnowBurstAt: config.attack === "ice" ? 64 : Infinity,
        nextSnowFlakeAt: config.attack === "ice" ? 96 : Infinity,
        nextFireEmberAt: config.attack === "fireball" ? 64 : Infinity,
        nextFireSmokeAt: config.attack === "fireball" ? 160 : Infinity,
        launchAt: session.elapsed + shot * (config.burstIntervalMs || 0),
      });
    }
  }
}

function updateTroops(session, events) {
  for (const troop of session.troops) {
    if (troop.dead) continue;
    const config = TROOPS[troop.type];
    if (config.attack === "none" || session.elapsed < troop.attackReadyAt) continue;
    const target = closestEnemy(session, troop, config.range);
    if (!target) continue;
    fireTroop(session, troop, config, target, events);
    troop.attackReadyAt = session.elapsed + config.attackEveryMs;
    troop.lastAttackAt = session.elapsed;
  }
}

function updateProjectiles(session, dt, events) {
  for (const projectile of session.projectiles) {
    if (!projectile.active) continue;
    if (session.elapsed < projectile.launchAt) continue;
    if (!projectile.launched) {
      projectile.launched = true;
      events.push({
        type: "shoot", weapon: projectile.visualKind, troopType: projectile.troopType,
        sourceTroopId: projectile.sourceTroopId, shotIndex: projectile.shotIndex,
        x: projectile.x, y: projectile.y, color: projectile.color, seed: projectile.seed,
      });
    }
    projectile.ageMs += dt;
    let target;
    if (projectile.straightLane) {
      target = session.enemies
        .filter((enemy) => !enemy.dead && enemy.row === projectile.row && enemy.x >= projectile.previousX - 24)
        .sort((left, right) => left.x - right.x)[0] || null;
    } else {
      target = session.enemies.find((enemy) => enemy.id === projectile.targetId && !enemy.dead);
      if (!target) target = session.enemies.filter((enemy) => !enemy.dead).sort((a, b) => Math.hypot(a.x - projectile.x, a.y - projectile.y) - Math.hypot(b.x - projectile.x, b.y - projectile.y))[0];
    }
    const targetPoint = target ? getEnemyHitPoint(target) : null;
    if (projectile.kind === "missile" && target) {
      const angle = Math.atan2(targetPoint.y - projectile.y, targetPoint.x - projectile.x);
      projectile.vx += (Math.cos(angle) * 250 - projectile.vx) * 0.08;
      projectile.vy += (Math.sin(angle) * 250 - projectile.vy) * 0.08;
    }
    projectile.previousX = projectile.x;
    projectile.previousY = projectile.y;
    projectile.x += projectile.vx * dt / 1000;
    projectile.y += projectile.vy * dt / 1000;
    projectile.trail.push({ x: projectile.x, y: projectile.y });
    if (projectile.trail.length > (projectile.kind === "missile" ? 16 : projectile.kind === "ice" ? 10 : 4)) projectile.trail.shift();
    if (projectile.kind === "ice") {
      while (projectile.ageMs >= projectile.nextSnowBurstAt) {
        events.push({
          type: "iceTrail", variant: "short", x: projectile.x, y: projectile.y,
          seed: projectile.seed + projectile.nextSnowBurstAt * 17,
        });
        projectile.nextSnowBurstAt += 64;
      }
      while (projectile.ageMs >= projectile.nextSnowFlakeAt) {
        events.push({
          type: "iceTrail", variant: "long", x: projectile.x, y: projectile.y,
          seed: projectile.seed + projectile.nextSnowFlakeAt * 29,
        });
        projectile.nextSnowFlakeAt += 96;
      }
    }
    if (projectile.kind === "fireball") {
      while (projectile.ageMs >= projectile.nextFireEmberAt) {
        events.push({
          type: "fireTrail", variant: "ember", x: projectile.x, y: projectile.y,
          seed: projectile.seed + projectile.nextFireEmberAt * 13,
        });
        projectile.nextFireEmberAt += 64;
      }
      while (projectile.ageMs >= projectile.nextFireSmokeAt) {
        events.push({
          type: "fireTrail", variant: "smoke", x: projectile.x, y: projectile.y,
          seed: projectile.seed + projectile.nextFireSmokeAt * 19,
        });
        projectile.nextFireSmokeAt += 160;
      }
    }
    const distanceTravelled = Math.abs(projectile.x - projectile.origin.x);
    const hitTarget = target && (projectile.straightLane
      ? projectile.previousX <= targetPoint.x + 24 && projectile.x >= targetPoint.x - 24
      : Math.hypot(targetPoint.x - projectile.x, targetPoint.y - projectile.y) <= 32);
    if ((!target && !projectile.straightLane) || (distanceTravelled >= projectile.maxDistance && !hitTarget) || projectile.x > FIELD.width + 80 || projectile.y < -30 || projectile.y > FIELD.height + 30) {
      projectile.active = false;
      continue;
    }
    if (hitTarget) {
      if (projectile.kind === "missile") {
        session.enemies.filter((enemy) => !enemy.dead && Math.hypot(enemy.x - target.x, enemy.y - target.y) <= projectile.radius)
          .forEach((enemy) => damageEnemy(session, enemy, projectile.damage, events));
        events.push({ type: "explosion", weapon: projectile.visualKind, x: targetPoint.x, y: targetPoint.y, color: projectile.color, seed: projectile.seed });
      } else {
        damageEnemy(session, target, projectile.damage, events);
        events.push({
          type: projectile.kind === "ice" ? "iceImpact" : projectile.kind === "fireball" ? "fireImpact" : "projectileImpact",
          weapon: projectile.visualKind, x: targetPoint.x, y: targetPoint.y,
          color: projectile.color, seed: projectile.seed,
        });
      }
      if (projectile.kind === "ice" && !target.dead) {
        target.slowFactor = projectile.slowFactor;
        target.slowUntil = session.elapsed + projectile.slowMs * session.modifiers.slowDuration;
      }
      projectile.active = false;
    }
  }
  session.projectiles = session.projectiles.filter((projectile) => projectile.active);
}

function updateEnemies(session, dt, events) {
  for (const enemy of session.enemies) {
    if (enemy.dead) continue;
    if (enemy.variant === "alpha") {
      const ratio = enemy.hp / enemy.maxHp;
      const targetPhase = ratio <= 0.33 ? 2 : ratio <= 0.66 ? 1 : 0;
      while (enemy.bossPhase < targetPhase) {
        enemy.bossPhase += 1;
        enemy.speed *= 1.15;
        enemy.damage *= 1.15;
        events.push({ type: "bossPhase", phase: enemy.bossPhase, x: enemy.x, y: enemy.y });
      }
    }
    const candidates = session.troops.filter((troop) => !troop.dead && troop.row === enemy.row && troop.x <= enemy.x);
    const target = candidates.sort((left, right) => right.x - left.x)[0] || null;
    if (target && enemy.x - target.x <= 54) {
      if (session.elapsed >= enemy.attackReadyAt) {
        target.hp -= enemy.damage;
        enemy.attackReadyAt = session.elapsed + ENEMIES[enemy.type].attackEveryMs;
        enemy.lastAttackAt = session.elapsed;
        events.push({ type: "troopHit", x: target.x, y: target.y });
        if (target.hp <= 0) {
          target.dead = true;
          events.push({ type: "troopDeath", x: target.x, y: target.y });
        }
      }
    } else {
      const slow = session.elapsed < enemy.slowUntil ? enemy.slowFactor : 1;
      enemy.x -= enemy.speed * session.modifiers.enemySpeed * slow * dt / 1000;
      if (enemy.x <= FIELD.baseX) {
        enemy.dead = true;
        session.integrity = Math.max(0, session.integrity - enemy.baseDamage);
        events.push({ type: "breach", damage: enemy.baseDamage, x: FIELD.baseX, y: enemy.y });
      }
    }
  }
  session.troops = session.troops.filter((troop) => !troop.dead);
  session.enemies = session.enemies.filter((enemy) => !enemy.dead);
}

function finish(session, outcome) {
  if (session.outcome) return;
  session.outcome = outcome;
  session.waveActive = false;
  session.preparing = false;
  session.result = {
    phaseId: session.phase.id,
    outcome,
    stars: calculateStars({ outcome, integrity: session.integrity, durationMs: session.elapsed, targetDurationMs: session.phase.targetDurationMs }),
    durationMs: Math.round(session.elapsed),
    integrity: Math.round(session.integrity),
    energy: Math.round(session.energy),
    enemiesDefeated: session.killed,
    composition: { ...session.deployed },
    decisions: [...session.decisions],
  };
}

export function stepBattle(session, dt = 32) {
  if (session.outcome) return [];
  const events = [];
  session.elapsed += dt;
  if (session.waveActive) {
    session.supplyAccumulator += dt;
    while (session.supplyAccumulator >= 1000) {
      session.supplyAccumulator -= 1000;
      session.supply = Math.min(session.supplyMax, session.supply + 1);
    }
    while (session.queue.length && session.elapsed >= session.nextSpawnAt) {
      const enemy = createEnemy(session, session.queue.shift());
      session.nextSpawnAt += session.phase.cadenceMs;
      events.push({ type: "spawn", x: enemy.x, y: enemy.y, enemy });
    }
    updateTroops(session, events);
    updateProjectiles(session, dt, events);
    updateEnemies(session, dt, events);
    if (session.integrity <= 0) finish(session, "defeat");
    if (!session.outcome && session.queue.length === 0 && session.enemies.length === 0) {
      session.waveActive = false;
      const completedWave = session.waveIndex;
      if (completedWave >= session.phase.waves.length - 1) {
        finish(session, "victory");
      } else {
        session.waveIndex += 1;
        session.preparing = true;
        session.pendingDecision = session.phase.waves[completedWave].decision || null;
        events.push({ type: "waveComplete", wave: completedWave + 1 });
      }
    }
  }
  return events;
}

export function getSnapshot(session) {
  return {
    energy: Math.round(session.energy), integrity: Math.round(session.integrity),
    supply: Math.round(session.supply * 10) / 10, supplyMax: session.supplyMax,
    wave: session.waveIndex + 1, totalWaves: session.phase.waves.length,
    enemies: session.enemies.length, queued: session.queue.length,
    preparing: session.preparing, pendingDecision: session.pendingDecision,
    outcome: session.outcome, elapsed: session.elapsed,
    cooldowns: Object.fromEntries(Object.entries(session.deployCooldowns).map(([key, value]) => [key, Math.max(0, value - session.elapsed)])),
  };
}

export function cellFromPoint(x, y) {
  return { row: clamp(Math.floor(y / CELL.height), 0, FIELD.rows - 1), col: clamp(Math.floor(x / CELL.width), 0, FIELD.cols - 1) };
}
