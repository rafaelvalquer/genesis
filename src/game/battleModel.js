import { ENEMIES, TROOPS } from "./content.js";
import { buildSpawnQueue, calculateStars, createRng, getDecisionOptions, isGroundTrapEligible } from "./domain.js";
import {
  CELL, FIELD, VIEWPORT, getEnemyHitPoint, getEnemyMuzzleWorldPosition,
  getMuzzleWorldPosition, getRepulsorKnockbackOffset, getTroopAnimation,
} from "./visualGeometry.js";

export { CELL, FIELD, VIEWPORT } from "./visualGeometry.js";

let entityId = 1;
const id = (prefix) => `${prefix}_${entityId++}`;
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const ENERGY_PICKUP_LIFETIME_MS = 10000;
const ENERGY_PICKUP_MAGNET_RADIUS = 140;
const ENERGY_PICKUP_COLLECT_RADIUS = 24;
export const DEMATERIALIZATION_PULSE = {
  chargeDurationMs: 2000,
  beamDurationMs: 360,
  disintegrationDurationMs: 420,
  scorchMarkDurationMs: 6000,
};

const DEFAULT_SANDBOX_SETTINGS = {
  rulesMode: "free",
  invulnerableBase: true,
  enemyHpMultiplier: 1,
  enemySpeedMultiplier: 1,
  enemyDamageMultiplier: 1,
  troopDamageMultiplier: 1,
};

const DEFAULT_MODIFIERS = {
  enemySpeed: 1, troopDamage: 1, slowDuration: 1, attackSpeed: 1,
  deployCooldown: 1, energyCost: 1, refundRate: 0.5,
  targetingRange: 1, aggressiveDamage: 1, aggressiveRange: 1, aggressiveHp: 1,
  ballisticDamage: 1, explosiveDamage: 1, rangerDamage: 1, guardDamage: 1,
  krioSlowDuration: 1, guardRangeBonus: 0, lastLineDamageTaken: 1,
  concussiveImpact: false, firstImpact: false,
};

function isOffensiveConfig(config) {
  return config && config.attack !== "none" && config.attack !== "energy";
}

function isNaniteMedic(config) {
  return config?.id === "medicaNanites";
}

function isLumiUrsa7(config) {
  return config?.id === "lumiUrsa7";
}

function usesTargetingSystems(config) {
  return config && !["none", "energy", "melee", "mine", "tileMelee"].includes(config.attack);
}

export function getEffectiveTroopStats(session, troopId) {
  const config = TROOPS[troopId];
  if (!config) return null;
  return {
    price: Math.ceil(config.price * session.modifiers.energyCost),
    deployCooldownMs: Math.round(config.deployCooldownMs * session.modifiers.deployCooldown),
    refundRate: session.modifiers.refundRate,
  };
}

function effectiveCombatConfig(session, troop, config) {
  if (!config) return config;
  if (isNaniteMedic(config)) return config;
  let range = config.range + (troop.type === "guarda" ? session.modifiers.guardRangeBonus : 0);
  let closeRange = config.closeRange;
  if (usesTargetingSystems(config)) range *= session.modifiers.targetingRange;
  if (config.attack === "mine" && Number.isFinite(closeRange)) closeRange *= session.modifiers.targetingRange;
  if (isOffensiveConfig(config)) {
    range *= session.modifiers.aggressiveRange;
    if (Number.isFinite(closeRange)) closeRange *= session.modifiers.aggressiveRange;
  }
  return { ...config, range, closeRange };
}

export function createBattleSession(phase, loadout, seed = Date.now(), options = {}) {
  const sandbox = Boolean(options.sandbox);
  const supplyLimit = phase.supplyLimit ?? 20;
  return {
    phase,
    loadout: [...loadout],
    seed,
    rng: createRng(seed),
    elapsed: 0,
    energy: phase.energy,
    energyMax: phase.energy,
    lastEnergyGainAt: -Infinity,
    integrity: phase.baseIntegrity,
    integrityMax: phase.baseIntegrity,
    supply: supplyLimit,
    supplyMax: supplyLimit,
    supplyAccumulator: 0,
    waveIndex: 0,
    waveActive: false,
    preparing: !sandbox,
    pendingDecision: null,
    pendingDecisionLevel: null,
    queue: [],
    nextSpawnAt: 0,
    troops: [],
    enemies: [],
    mines: [],
    projectiles: [],
    enemyProjectiles: [],
    energyPickups: [],
    energyPickupPointer: null,
    dematerializationPulses: Array.from({ length: FIELD.rows }, (_, row) => ({
      id: `dematerialization_pulse_${row}`,
      row,
      state: "ready",
      chargeStartedAt: null,
      fireAt: null,
    })),
    effects: [],
    effectSequence: 0,
    prismaticMantle: { nextPulseAt: Infinity, lastPulseAt: -Infinity },
    deployCooldowns: {},
    modifiers: { ...DEFAULT_MODIFIERS },
    shieldCharges: 0,
    nextWaveEnergy: 0,
    nextWaveBaseDamageFactor: 1,
    currentWaveBaseDamageFactor: 1,
    nextWaveEnemyCountFactor: 1,
    decisions: [],
    killed: 0,
    deployed: {},
    outcome: null,
    result: null,
    sandbox,
    sandboxSettings: sandbox ? { ...DEFAULT_SANDBOX_SETTINGS, ...options.sandboxSettings } : null,
  };
}

export function canPlaceTroop(session, troopId, row, col) {
  const troop = TROOPS[troopId];
  const effective = getEffectiveTroopStats(session, troopId);
  const freePlacement = session.sandbox && session.sandboxSettings?.rulesMode === "free";
  if (!troop || !session.loadout.includes(troopId)) return "Tropa fora do loadout.";
  if (col < FIELD.firstTroopCol || col > FIELD.lastTroopCol) return "Posição reservada para a defesa da base.";
  if (row < 0 || row >= FIELD.rows || col < 0 || col >= FIELD.cols - 1) return "Posição fora da zona de combate.";
  if (session.troops.some((entry) => !entry.dead && entry.row === row && entry.col === col)) return "Célula ocupada.";
  if (session.mines.some((entry) => entry.active && entry.row === row && entry.col === col)
    || session.projectiles.some((entry) => entry.active && entry.kind === "mine" && entry.targetRow === row && entry.targetCol === col)) return "Célula reservada por uma mina.";
  if (!freePlacement && troop.maxDeployed && session.troops.filter((entry) => !entry.dead && entry.type === troopId).length >= troop.maxDeployed) return `Limite de ${troop.maxDeployed} ${troop.label} por campo.`;
  if (!freePlacement && session.energy < effective.price) return `Energia insuficiente: requer ${effective.price}.`;
  if (!freePlacement && session.supply < troop.supply) return `Supply insuficiente: requer ${troop.supply}.`;
  if (!freePlacement && (session.waveActive || session.sandbox || troop.cooldownDuringPreparation) && Number(session.deployCooldowns[troopId] || 0) > session.elapsed) return "Implantação recarregando.";
  return null;
}

export function placeTroop(session, troopId, row, col) {
  const reason = canPlaceTroop(session, troopId, row, col);
  if (reason) return { ok: false, reason };
  const config = TROOPS[troopId];
  const effective = getEffectiveTroopStats(session, troopId);
  const maxHp = config.hp * (isOffensiveConfig(config) && !isNaniteMedic(config) ? session.modifiers.aggressiveHp : 1);
  const troop = {
    id: id("troop"), type: troopId, row, col,
    x: col * CELL.width + CELL.width / 2,
    y: row * CELL.height + CELL.height / 2,
    hp: maxHp, maxHp, energyCost: effective.price,
    attackReadyAt: 0, mineReadyAt: 0, gunReadyAt: 0, energyAccumulator: 0,
    lastAttackAt: -Infinity, channelingAttack: false, attackStartedAt: -Infinity,
    lastAttackMode: null, pendingImpact: null, specialRequested: false, attackBusyUntil: 0,
    specialReadyAt: config.specialEveryMs ? session.elapsed + config.specialEveryMs : Infinity,
    state: "idle", stateStartedAt: session.elapsed,
    stateEndsAt: Infinity, defenseActive: false, defenseThreatId: null, defenseExitAt: null,
    pendingRepulsorShot: null, lastRepulsorAt: -Infinity,
    healTargetId: null, healedThisCharge: 0, lastHealPulseAt: -Infinity,
    attackTargetId: null, cooldownStartedAt: null, cooldownEndsAt: null,
    attackSpeedFactor: 1, attachedParasiteId: null,
    channelTickAccumulator: 0, firstImpactAvailable: session.modifiers.firstImpact,
    previousRenderX: col * CELL.width + CELL.width / 2,
    previousRenderY: row * CELL.height + CELL.height / 2, dead: false,
  };
  session.troops.push(troop);
  const freePlacement = session.sandbox && session.sandboxSettings?.rulesMode === "free";
  if (!freePlacement) {
    session.energy -= effective.price;
    session.supply -= config.supply;
  }
  session.deployed[troopId] = (session.deployed[troopId] || 0) + 1;
  if (!freePlacement && (session.waveActive || session.sandbox || config.cooldownDuringPreparation)) session.deployCooldowns[troopId] = session.elapsed + effective.deployCooldownMs;
  return { ok: true, troop, event: { type: "deploy", x: troop.x, y: troop.y } };
}

export function removeTroop(session, row, col) {
  const index = session.troops.findIndex((troop) => !troop.dead && troop.row === row && troop.col === col);
  if (index < 0) return { ok: false, reason: "Nenhuma unidade nessa célula." };
  const [troop] = session.troops.splice(index, 1);
  releaseParasiteFromTroop(session, troop);
  const config = TROOPS[troop.type];
  session.mines = session.mines.filter((mine) => mine.ownerId !== troop.id);
  session.projectiles = session.projectiles.filter((projectile) =>
    projectile.sourceTroopId !== troop.id || !["mine", "repulsorFist"].includes(projectile.kind));
  const refund = Math.floor(Number(troop.energyCost ?? config.price) * session.modifiers.refundRate);
  session.energy = Math.min(session.energyMax, session.energy + refund);
  session.supply = Math.min(session.supplyMax, session.supply + config.supply);
  return { ok: true, refund, troop, event: { type: "remove", x: troop.x, y: troop.y, entity: { ...troop } } };
}

function rescaleReadyTimers(session, factor) {
  session.troops.forEach((troop) => {
    if (!isOffensiveConfig(TROOPS[troop.type])) return;
    for (const field of ["attackReadyAt", "mineReadyAt", "gunReadyAt"]) {
      if (Number.isFinite(troop[field]) && troop[field] > session.elapsed) {
        troop[field] = session.elapsed + (troop[field] - session.elapsed) * factor;
      }
    }
  });
}

function applyDecision(session, decisionId) {
  const multiply = (field, factor) => { session.modifiers[field] *= factor; };
  switch (decisionId) {
    case "emergency_energy":
      session.energy = Math.min(session.energyMax, session.energy + 25);
      break;
    case "supply_expansion":
      session.supplyMax += 6;
      session.supply = Math.min(session.supplyMax, session.supply + 6);
      break;
    case "repair_core":
      session.integrity = Math.min(session.integrityMax, session.integrity + 20);
      break;
    case "emergency_shield":
      session.shieldCharges += 2;
      break;
    case "armor_piercing":
      multiply("troopDamage", 1.12);
      break;
    case "accelerated_training":
      multiply("attackSpeed", 1.15);
      rescaleReadyTimers(session, 1 / 1.15);
      break;
    case "first_impact":
      session.modifiers.firstImpact = true;
      session.troops.filter((troop) => !troop.dead).forEach((troop) => { troop.firstImpactAvailable = true; });
      break;
    case "rush_wave":
      session.energy = Math.min(session.energyMax, session.energy + 25);
      multiply("enemySpeed", 1.08);
      break;
    case "resupply":
      session.supply = Math.min(session.supplyMax, session.supply + 6);
      break;
    case "fast_deployment":
      multiply("deployCooldown", 0.75);
      Object.keys(session.deployCooldowns).forEach((troopId) => {
        const readyAt = session.deployCooldowns[troopId];
        if (readyAt > session.elapsed) session.deployCooldowns[troopId] = session.elapsed + (readyAt - session.elapsed) * 0.75;
      });
      break;
    case "strategic_reserve":
      session.nextWaveEnergy += 20;
      break;
    case "permanent_armor":
      session.integrityMax += 20;
      session.integrity += 20;
      break;
    case "containment_protocol":
      session.nextWaveBaseDamageFactor *= 0.75;
      break;
    case "ballistic_specialization":
      multiply("ballisticDamage", 1.2);
      break;
    case "explosive_specialization":
      multiply("explosiveDamage", 1.25);
      break;
    case "energy_specialization":
      multiply("rangerDamage", 1.2);
      multiply("guardDamage", 1.2);
      multiply("krioSlowDuration", 1.25);
      session.modifiers.guardRangeBonus += 0.5;
      break;
    case "efficient_batteries":
      multiply("energyCost", 0.85);
      break;
    case "recycling":
      session.modifiers.refundRate = 0.75;
      break;
    case "last_line":
      multiply("lastLineDamageTaken", 0.75);
      break;
    case "field_maintenance":
      session.troops.filter((troop) => !troop.dead)
        .forEach((troop) => { troop.hp = Math.min(troop.maxHp, troop.hp + troop.maxHp * 0.3); });
      break;
    case "targeting_systems":
      multiply("targetingRange", 1.15);
      break;
    case "concussive_impact":
      session.modifiers.concussiveImpact = true;
      break;
    case "aggressive_line":
      multiply("aggressiveDamage", 1.2);
      multiply("aggressiveRange", 1.2);
      multiply("aggressiveHp", 0.8);
      session.troops.filter((troop) => !troop.dead && isOffensiveConfig(TROOPS[troop.type])).forEach((troop) => {
        troop.maxHp *= 0.8;
        troop.hp *= 0.8;
      });
      break;
    case "war_economy":
      session.supply = Math.min(session.supplyMax, session.supply + 8);
      session.nextWaveEnemyCountFactor *= 1.2;
      break;
    default:
      return false;
  }
  return true;
}

export function startWave(session) {
  if (session.outcome || session.waveActive || session.pendingDecision) return false;
  if (session.nextWaveEnergy > 0) {
    const previousEnergy = session.energy;
    session.energy = Math.min(session.energyMax, session.energy + session.nextWaveEnergy);
    if (session.energy > previousEnergy) session.lastEnergyGainAt = session.elapsed;
    session.nextWaveEnergy = 0;
  }
  const enemyCountFactor = session.nextWaveEnemyCountFactor;
  session.nextWaveEnemyCountFactor = 1;
  session.currentWaveBaseDamageFactor = session.nextWaveBaseDamageFactor;
  session.nextWaveBaseDamageFactor = 1;
  session.queue = buildSpawnQueue(session.phase, session.waveIndex, session.seed + session.waveIndex * 997, enemyCountFactor);
  session.waveActive = true;
  session.preparing = false;
  session.nextSpawnAt = session.elapsed;
  session.troops.filter((troop) => !troop.dead && troop.type === "demolidora")
    .forEach((troop) => { troop.mineReadyAt = session.elapsed; });
  return true;
}

export function selectDecision(session, option) {
  if (!session.pendingDecision?.some((entry) => entry.id === option.id)) return false;
  if (!applyDecision(session, option.id)) return false;
  session.decisions.push({ wave: session.waveIndex, level: session.pendingDecisionLevel, id: option.id });
  session.pendingDecision = null;
  session.pendingDecisionLevel = null;
  return true;
}

function createEnemy(session, queued) {
  const base = ENEMIES[queued.type];
  if (!base) return null;
  const alpha = queued.variant === "alpha";
  const echo = Boolean(queued.isEcho);
  const mechanic = session.phase.chapterMechanic;
  const echoHpFactor = echo ? mechanic?.hpFactor ?? 0.45 : 1;
  const echoSpeedFactor = echo ? mechanic?.speedFactor ?? 1.2 : 1;
  const echoDamageFactor = echo ? mechanic?.damageFactor ?? 0.6 : 1;
  const maxHp = base.hp * (alpha ? 8 : 1) * echoHpFactor * (session.sandboxSettings?.enemyHpMultiplier ?? 1);
  const firstLivingCrisalio = queued.type === "crisalio"
    && !session.enemies.some((entry) => !entry.dead && entry.type === "crisalio");
  const enemy = {
    id: id("enemy"), type: queued.type, variant: queued.variant, isEcho: echo,
    echoSourceId: queued.echoSourceId || null,
    row: Number.isInteger(queued.row) ? clamp(queued.row, 0, FIELD.rows - 1) : Math.floor(session.rng() * FIELD.rows),
    x: Number.isFinite(queued.x) ? queued.x : FIELD.spawnX, y: 0,
    hp: maxHp, maxHp,
    speed: base.speed * (alpha ? 0.75 : 1) * echoSpeedFactor,
    damage: base.damage * (alpha ? 2 : 1) * echoDamageFactor,
    attackReadyAt: 0, lastAttackAt: -Infinity,
    casting: false, castStartedAt: -Infinity, castReadyAt: Infinity, moving: true,
    jumpConsumed: false, jumping: false, jumpStartedAt: -Infinity, jumpProgress: 0,
    jumpFromX: null, jumpTargetTroopId: null, attachedToTroopId: null,
    slowUntil: 0, slowFactor: 1, stunnedUntil: 0, bossPhase: 0,
    shield: 0, shieldMax: 0, lastShieldPulseAt: -Infinity,
    meleeAttackPending: false, meleeAttackStartedAt: -Infinity,
    meleeImpactAt: Infinity, meleeTargetId: null,
    baseDamage: (alpha ? 40 : base.baseDamage) * echoDamageFactor,
    scale: base.scale * (alpha ? 1.45 : 1) * (echo ? 0.94 : 1),
    previousRenderX: FIELD.spawnX, previousRenderY: 0, dead: false,
  };
  enemy.y = enemy.row * CELL.height + CELL.height / 2;
  enemy.previousRenderY = enemy.y;
  session.enemies.push(enemy);
  if (firstLivingCrisalio) {
    session.prismaticMantle.nextPulseAt = session.elapsed + base.shieldPulseEveryMs;
  }
  return enemy;
}

export function trySpawnGlassEcho(session, source, events = []) {
  const mechanic = session.phase.chapterMechanic;
  if (mechanic?.id !== "glass_echoes" || source?.isEcho || source?.variant === "alpha") return null;
  const activeEchoes = session.enemies.filter((enemy) => enemy.isEcho && !enemy.dead).length;
  if (activeEchoes >= mechanic.maxAlive || session.rng() >= mechanic.chance) return null;
  const echo = createEnemy(session, {
    type: source.type,
    row: source.row,
    x: source.x,
    isEcho: true,
    echoSourceId: source.id,
  });
  if (!echo) return null;
  echo.y = source.y;
  echo.previousRenderX = echo.x;
  echo.previousRenderY = echo.y;
  events.push({ type: "echoSpawn", x: echo.x, y: echo.y, color: "#7fffd4", enemy: { ...echo }, sourceId: source.id });
  return echo;
}

export function trySpawnEnergyPickup(session, source, events = []) {
  const chance = ENEMIES[source?.type]?.energyDropChance;
  if (!chance || source?.variant === "alpha") return null;
  const roll = session.rng();
  if (roll >= chance) return null;
  const pickup = {
    id: id("energy_pickup"),
    x: source.x,
    y: source.y - 28,
    vx: 0,
    vy: 0,
    amount: 1,
    ageMs: 0,
    phase: roll * Math.PI * 2,
  };
  session.energyPickups.push(pickup);
  events.push({ type: "energyDropSpawned", x: pickup.x, y: pickup.y, amount: pickup.amount, color: "#fbbf24" });
  return pickup;
}

export function setEnergyPickupPointer(session, point) {
  if (!session) return false;
  session.energyPickupPointer = point && Number.isFinite(point.x) && Number.isFinite(point.y)
    ? { x: point.x, y: point.y }
    : null;
  return true;
}

export function spawnEnemy(session, { type, row = 0, count = 1, variant } = {}) {
  if (!session.sandbox) return { ok: false, reason: "Spawn manual disponível apenas no Campo de Provas.", enemies: [], events: [] };
  if (!ENEMIES[type]) return { ok: false, reason: "Inimigo desconhecido.", enemies: [], events: [] };
  const amount = clamp(Math.floor(Number(count) || 1), 1, 50);
  const targetRow = clamp(Math.floor(Number(row) || 0), 0, FIELD.rows - 1);
  const enemies = [];
  const events = [];
  for (let index = 0; index < amount; index += 1) {
    const enemy = createEnemy(session, { type, row: targetRow, variant: variant === "alpha" ? "alpha" : undefined });
    enemy.x += index * 34;
    enemy.previousRenderX = enemy.x;
    enemies.push(enemy);
    events.push({ type: "spawn", x: enemy.x, y: enemy.y, enemy });
  }
  return { ok: true, enemies, events };
}

export function setSandboxSettings(session, settings) {
  if (!session.sandbox) return false;
  session.sandboxSettings = { ...session.sandboxSettings, ...settings };
  return true;
}

export function clearSandboxEntities(session, target = "all") {
  if (!session.sandbox) return false;
  if (target === "enemies" || target === "all") {
    session.troops.forEach((troop) => setTroopAttackSpeedFactor(troop, 1, session.elapsed));
    session.troops.forEach((troop) => { troop.attachedParasiteId = null; });
    session.enemies = [];
    session.queue = [];
    session.prismaticMantle = { nextPulseAt: Infinity, lastPulseAt: -Infinity };
  }
  if (target === "troops" || target === "all") {
    session.enemies.forEach((enemy) => {
      enemy.attachedToTroopId = null;
      enemy.jumpTargetTroopId = null;
      enemy.jumping = false;
    });
    session.troops = [];
    session.energy = session.energyMax;
    session.supply = session.supplyMax;
    session.deployCooldowns = {};
    session.deployed = {};
  }
  session.mines = [];
  session.projectiles = [];
  session.enemyProjectiles = [];
  session.energyPickups = [];
  session.energyPickupPointer = null;
  session.effects = [];
  return true;
}

export function injureSandboxTroops(session, amount = 10) {
  if (!session.sandbox) return [];
  const events = [];
  session.troops
    .filter((troop) => !troop.dead && troop.hp > 1)
    .forEach((troop) => {
      const applied = Math.min(Math.max(0, amount), troop.hp - 1);
      troop.hp -= applied;
      events.push({ type: "troopHit", targetId: troop.id, x: troop.x, y: troop.y, amount: applied });
    });
  return events;
}

function attackOriginX(session, troop, config) {
  if (config.attack !== "melee") return troop.x;
  const adjacentWall = session.troops.find((candidate) => !candidate.dead
    && candidate.type === "muralhaReforcada"
    && candidate.row === troop.row
    && candidate.col === troop.col + 1);
  return adjacentWall?.x ?? troop.x;
}

function closestEnemy(session, troop, config) {
  const originX = attackOriginX(session, troop, config);
  return session.enemies
    .filter((enemy) => !enemy.dead
      && enemy.row === troop.row
      && enemy.x >= originX
      && enemy.x - originX <= config.range * CELL.width)
    .sort((left, right) => left.x - right.x)[0] || null;
}

function enemyColumn(enemy) {
  return clamp(Math.floor(enemy.x / CELL.width), 0, FIELD.cols - 1);
}

function mortarTargetGroup(session, troop, config) {
  const groups = new Map();
  for (const enemy of session.enemies) {
    if (enemy.dead || enemy.row !== troop.row) continue;
    const col = enemyColumn(enemy);
    const offset = col - troop.col;
    if (offset < config.minRange || offset > config.range) continue;
    if (!groups.has(col)) groups.set(col, []);
    groups.get(col).push(enemy);
  }
  const selected = [...groups.entries()]
    .sort(([leftCol, leftEnemies], [rightCol, rightEnemies]) =>
      rightEnemies.length - leftEnemies.length || leftCol - rightCol)[0];
  if (!selected) return null;
  const [col, enemies] = selected;
  const target = [...enemies].sort((left, right) => left.x - right.x || left.id.localeCompare(right.id))[0];
  return { target, row: troop.row, col };
}

function nextEffectSeed(session) {
  session.effectSequence += 1;
  return (session.seed + session.effectSequence * 997) >>> 0;
}

function setTroopAttackSpeedFactor(troop, nextFactor, elapsed) {
  const currentFactor = troop.attackSpeedFactor || 1;
  if (Math.abs(currentFactor - nextFactor) < 0.0001) return;
  for (const field of ["attackReadyAt", "mineReadyAt", "gunReadyAt"]) {
    const readyAt = troop[field];
    if (Number.isFinite(readyAt) && readyAt > elapsed) {
      troop[field] = elapsed + (readyAt - elapsed) * currentFactor / nextFactor;
    }
  }
  troop.attackSpeedFactor = nextFactor;
}

function attackIntervalFor(session, troop, config, interval) {
  const trainingSpeed = isOffensiveConfig(config) ? session.modifiers.attackSpeed : 1;
  return interval / ((troop.attackSpeedFactor || 1) * trainingSpeed);
}

function attackDamageMultiplier(session, troop, { explosive = false } = {}) {
  let multiplier = session.modifiers.troopDamage;
  if (isOffensiveConfig(TROOPS[troop.type])) multiplier *= session.modifiers.aggressiveDamage;
  if (["marine", "sniper", "caçador"].includes(troop.type)) multiplier *= session.modifiers.ballisticDamage;
  if (explosive) multiplier *= session.modifiers.explosiveDamage;
  if (troop.type === "ranger") multiplier *= session.modifiers.rangerDamage;
  if (troop.type === "guarda") multiplier *= session.modifiers.guardDamage;
  if (troop.firstImpactAvailable) {
    multiplier *= 1.5;
    troop.firstImpactAvailable = false;
  }
  return multiplier;
}

function applyConcussiveImpact(session, enemy) {
  if (!session.modifiers.concussiveImpact || enemy.dead || !isGroundTrapEligible(enemy)) return;
  enemy.x = Math.min(FIELD.width + 40, enemy.x + 50);
  enemy.previousRenderX = enemy.x;
}

function detachParasite(session, enemy) {
  if (!enemy?.attachedToTroopId) return;
  const troop = session.troops.find((entry) => entry.id === enemy.attachedToTroopId);
  if (troop?.attachedParasiteId === enemy.id) {
    troop.attachedParasiteId = null;
    setTroopAttackSpeedFactor(troop, 1, session.elapsed);
  }
  enemy.attachedToTroopId = null;
  enemy.moving = true;
}

function releaseParasiteFromTroop(session, troop) {
  if (!troop?.attachedParasiteId) return;
  const parasite = session.enemies.find((enemy) => enemy.id === troop.attachedParasiteId);
  if (parasite) {
    parasite.attachedToTroopId = null;
    parasite.moving = true;
  }
  troop.attachedParasiteId = null;
  setTroopAttackSpeedFactor(troop, 1, session.elapsed);
}

function attachParasite(session, enemy, troop, config) {
  if (!troop || troop.dead || troop.attachedParasiteId) return false;
  enemy.jumping = false;
  enemy.jumpProgress = 1;
  enemy.jumpTargetTroopId = null;
  enemy.attachedToTroopId = troop.id;
  enemy.x = troop.x;
  enemy.y = troop.y;
  enemy.moving = false;
  troop.attachedParasiteId = enemy.id;
  setTroopAttackSpeedFactor(troop, config.attackSlowFactor, session.elapsed);
  return true;
}

function damageEnemy(session, enemy, amount, events) {
  if (!enemy || enemy.dead) return;
  let incoming = amount * (session.sandboxSettings?.troopDamageMultiplier ?? 1);
  const hitPoint = getEnemyHitPoint(enemy, ENEMIES[enemy.type]);
  if (enemy.shield > 0 && incoming > 0) {
    const absorbed = Math.min(enemy.shield, incoming);
    enemy.shield = Math.max(0, enemy.shield - absorbed);
    incoming -= absorbed;
    events.push({
      type: "shieldHit", targetId: enemy.id, x: hitPoint.x, y: hitPoint.y,
      color: "#a78bfa", absorbed, remaining: enemy.shield,
    });
    if (enemy.shield <= 0) {
      events.push({ type: "shieldBreak", targetId: enemy.id, x: hitPoint.x, y: hitPoint.y, color: "#7fffd4" });
    }
  }
  if (incoming > 0) {
    enemy.hp -= incoming;
    events.push({ type: "hit", targetId: enemy.id, x: hitPoint.x, y: hitPoint.y, color: ENEMIES[enemy.type].color });
  }
  if (enemy.hp <= 0) {
    enemy.hp = 0;
    enemy.dead = true;
    detachParasite(session, enemy);
    session.killed += 1;
    events.push({ type: enemy.variant === "alpha" ? "bossDeath" : "enemyDeath", x: enemy.x, y: enemy.y, entity: { ...enemy } });
    trySpawnGlassEcho(session, enemy, events);
    trySpawnEnergyPickup(session, enemy, events);
  }
}

function updateEnergyPickups(session, dt, events) {
  if (session.pendingDecision || !session.energyPickups.length) return;
  const pointer = session.energyPickupPointer;
  const dtSeconds = dt / 1000;
  const remaining = [];
  for (const pickup of session.energyPickups) {
    pickup.ageMs += dt;
    if (pickup.ageMs >= ENERGY_PICKUP_LIFETIME_MS) continue;

    if (pointer) {
      const dx = pointer.x - pickup.x;
      const dy = pointer.y - pickup.y;
      const distance = Math.hypot(dx, dy);
      if (distance <= ENERGY_PICKUP_MAGNET_RADIUS && distance > 0.001) {
        const attraction = 520 + (1 - distance / ENERGY_PICKUP_MAGNET_RADIUS) * 780;
        pickup.vx += dx / distance * attraction * dtSeconds;
        pickup.vy += dy / distance * attraction * dtSeconds;
        const speed = Math.hypot(pickup.vx, pickup.vy);
        if (speed > 390) {
          pickup.vx = pickup.vx / speed * 390;
          pickup.vy = pickup.vy / speed * 390;
        }
      } else {
        const damping = Math.exp(-4.5 * dtSeconds);
        pickup.vx *= damping;
        pickup.vy *= damping;
      }
    } else {
      const damping = Math.exp(-4.5 * dtSeconds);
      pickup.vx *= damping;
      pickup.vy *= damping;
    }

    pickup.x += pickup.vx * dtSeconds;
    pickup.y += pickup.vy * dtSeconds;

    const collectionDistance = pointer ? Math.hypot(pointer.x - pickup.x, pointer.y - pickup.y) : Infinity;
    if (collectionDistance <= ENERGY_PICKUP_COLLECT_RADIUS && session.energy < session.energyMax) {
      const amount = Math.min(pickup.amount, session.energyMax - session.energy);
      session.energy += amount;
      session.lastEnergyGainAt = session.elapsed;
      events.push({ type: "energyCollected", x: pickup.x, y: pickup.y, amount, color: "#fbbf24" });
      continue;
    }
    remaining.push(pickup);
  }
  session.energyPickups = remaining;
}

function stunEnemy(session, enemy, durationMs) {
  if (!enemy || enemy.dead || durationMs <= 0) return;
  const previousUntil = Math.max(session.elapsed, Number(enemy.stunnedUntil) || 0);
  const nextUntil = Math.max(previousUntil, session.elapsed + durationMs);
  const pausedFor = nextUntil - previousUntil;
  enemy.stunnedUntil = nextUntil;
  for (const field of ["attackReadyAt", "castReadyAt", "meleeImpactAt"]) {
    if (Number.isFinite(enemy[field]) && enemy[field] >= session.elapsed) enemy[field] += pausedFor;
  }
  if (enemy.jumping && Number.isFinite(enemy.jumpStartedAt)) enemy.jumpStartedAt += pausedFor;
  enemy.moving = false;
}

function updatePrismaticMantle(session, events) {
  const config = ENEMIES.crisalio;
  const sources = session.enemies.filter((enemy) => !enemy.dead && enemy.type === "crisalio");
  if (!sources.length) {
    session.prismaticMantle.nextPulseAt = Infinity;
    return;
  }
  if (!Number.isFinite(session.prismaticMantle.nextPulseAt)) {
    session.prismaticMantle.nextPulseAt = session.elapsed + config.shieldPulseEveryMs;
  }
  while (session.elapsed >= session.prismaticMantle.nextPulseAt) {
    const pulseAt = session.prismaticMantle.nextPulseAt;
    const source = sources[0];
    const targets = session.enemies.filter((enemy) => !enemy.dead && config.shieldTargetTypes.includes(enemy.type));
    for (const target of targets) {
      const value = Math.min(config.shieldCap, config.shieldBase + target.maxHp * config.shieldMaxHpFactor);
      target.shield = value;
      target.shieldMax = value;
      target.lastShieldPulseAt = pulseAt;
    }
    source.lastShieldPulseAt = session.elapsed;
    session.prismaticMantle.lastPulseAt = pulseAt;
    session.prismaticMantle.nextPulseAt += config.shieldPulseEveryMs;
    events.push({
      type: "prismaticPulse", sourceId: source.id, x: source.x, y: source.y - 34 * source.scale,
      targetIds: targets.map((target) => target.id), color: config.color, seed: nextEffectSeed(session),
    });
  }
}

function damageTroop(session, troop, amount, events) {
  if (!troop || troop.dead) return;
  const config = TROOPS[troop.type];
  const defenseFactor = isLumiUrsa7(config) && troop.defenseActive ? config.defenseDamageFactor : 1;
  const lastLineFactor = troop.col <= 1 ? session.modifiers.lastLineDamageTaken : 1;
  troop.hp -= amount * defenseFactor * lastLineFactor * (session.sandboxSettings?.enemyDamageMultiplier ?? 1);
  if (defenseFactor < 1) {
    events.push({
      type: "shieldHit",
      targetId: troop.id,
      x: troop.x,
      y: troop.y - 46,
      color: config.color,
      seed: nextEffectSeed(session),
    });
  }
  events.push({ type: "troopHit", targetId: troop.id, x: troop.x, y: troop.y });
  if (troop.hp <= 0) {
    troop.hp = 0;
    troop.dead = true;
    troop.defenseActive = false;
    troop.pendingRepulsorShot = null;
    releaseParasiteFromTroop(session, troop);
    events.push({ type: "troopDeath", x: troop.x, y: troop.y, entity: { ...troop } });
  }
}

function updateFlameChannel(session, troop, config, events, dt) {
  const targets = session.enemies
    .filter((enemy) => !enemy.dead
      && enemy.row === troop.row
      && enemy.x >= troop.x
      && enemy.x - troop.x <= config.range * CELL.width)
    .sort((left, right) => left.x - right.x);

  if (!targets.length) {
    if (troop.channelingAttack) {
      troop.channelingAttack = false;
      troop.channelTickAccumulator = 0;
      troop.lastAttackAt = session.elapsed - (config.attackVisual?.durationMs || 420);
    }
    return;
  }

  if (!troop.channelingAttack) {
    troop.channelingAttack = true;
    troop.attackStartedAt = session.elapsed;
    troop.lastAttackAt = session.elapsed;
    troop.channelTickAccumulator = config.attackEveryMs;
  } else {
    troop.channelTickAccumulator += dt * (troop.attackSpeedFactor || 1) * session.modifiers.attackSpeed;
  }

  while (troop.channelTickAccumulator >= config.attackEveryMs) {
    troop.channelTickAccumulator -= config.attackEveryMs;
    const activeTargets = targets.filter((enemy) => !enemy.dead);
    if (!activeTargets.length) break;
    const frameCount = config.attackVisual?.frameMuzzles?.length || 1;
    const animation = getTroopAnimation(troop, config, session.elapsed, { attack: frameCount });
    const origin = getMuzzleWorldPosition(troop, config, 0, animation.frame);
    const damage = config.damage * attackDamageMultiplier(session, troop);
    activeTargets.forEach((enemy) => damageEnemy(session, enemy, damage, events));
    events.push({
      type: "flame", weapon: config.attackVisual?.effect || "flame", troopType: troop.type,
      sourceTroopId: troop.id, row: troop.row,
      x0: origin.x, y0: origin.y,
      x1: Math.max(origin.x + 24, troop.x + config.range * CELL.width), y1: origin.y,
      color: config.color, seed: nextEffectSeed(session),
    });
  }
}

function fireTroop(session, troop, config, target, events) {
  const damage = config.damage * attackDamageMultiplier(session, troop, {
    explosive: config.attack === "missile" || config.attack === "mortar",
  });
  const origin = getMuzzleWorldPosition(troop, config, 0);
  const targetPoint = getEnemyHitPoint(target, ENEMIES[target.type]);
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
      const speed = config.projectileSpeed || (config.attack === "missile" ? 210 : 390);
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
        launchAt: session.elapsed + (config.attackVisual?.shots?.[shot]?.atMs ?? shot * (config.burstIntervalMs || 0)),
      });
    }
  }
}

function fireMortar(session, troop, config, group) {
  const origin = getMuzzleWorldPosition(troop, config, 0);
  const targetX = group.col * CELL.width + CELL.width / 2;
  const targetY = group.row * CELL.height + CELL.height * 0.85;
  session.projectiles.push({
    id: id("projectile"), kind: "mortar", visualKind: config.attackVisual.effect,
    troopType: troop.type, sourceTroopId: troop.id, shotIndex: 0,
    row: troop.row, targetRow: group.row, targetCol: group.col, targetId: group.target.id,
    x: origin.x, y: origin.y, previousX: origin.x, previousY: origin.y,
    origin: { ...origin }, targetX, targetY, ageMs: 0,
    flightMs: config.projectileFlightMs, arcHeight: config.projectileArcHeight,
    rotation: -0.8, trail: [{ x: origin.x, y: origin.y }],
    damage: config.damage * attackDamageMultiplier(session, troop, { explosive: true }),
    collateralMultiplier: config.collateralMultiplier,
    color: config.color, active: true, launched: false, seed: nextEffectSeed(session),
    launchAt: session.elapsed + (config.attackVisual.shots?.[0]?.atMs || 0),
  });
}

function mineCellIsFree(session, row, col) {
  const troopOccupied = session.troops.some((troop) => !troop.dead && troop.row === row && troop.col === col);
  const enemyOccupied = session.enemies.some((enemy) => !enemy.dead
    && enemy.row === row
    && enemy.x >= col * CELL.width
    && enemy.x < (col + 1) * CELL.width);
  const mineOccupied = session.mines.some((mine) => mine.active && mine.row === row && mine.col === col);
  const reserved = session.projectiles.some((projectile) => projectile.active
    && projectile.kind === "mine"
    && projectile.targetRow === row
    && projectile.targetCol === col);
  return !troopOccupied && !enemyOccupied && !mineOccupied && !reserved;
}

function availableMineCells(session, troop, config) {
  const cells = [];
  const lastColumn = Math.min(FIELD.cols - 1, troop.col + config.mineRangeCols);
  for (let row = 0; row < FIELD.rows; row += 1) {
    for (let col = troop.col + 1; col <= lastColumn; col += 1) {
      if (mineCellIsFree(session, row, col)) cells.push({ row, col });
    }
  }
  return cells;
}

function ownedMineCount(session, troopId) {
  return session.mines.filter((mine) => mine.active && mine.ownerId === troopId).length
    + session.projectiles.filter((projectile) => projectile.active && projectile.kind === "mine" && projectile.sourceTroopId === troopId).length;
}

function launchMine(session, troop, config, events) {
  if (ownedMineCount(session, troop.id) >= config.maxActiveMines) return false;
  const cells = availableMineCells(session, troop, config);
  if (!cells.length) return false;
  const target = cells[Math.floor(session.rng() * cells.length)];
  troop.lastAttackMode = "mine";
  troop.lastAttackAt = session.elapsed;
  const origin = getMuzzleWorldPosition(troop, config, 0);
  const targetX = target.col * CELL.width + CELL.width / 2;
  const mineY = target.row * CELL.height + CELL.height / 2;
  const targetY = mineY + CELL.height * 0.35;
  session.projectiles.push({
    id: id("projectile"), kind: "mine", visualKind: "magneticMine", troopType: troop.type,
    sourceTroopId: troop.id, row: troop.row, targetRow: target.row, targetCol: target.col,
    x: origin.x, y: origin.y, previousX: origin.x, previousY: origin.y,
    origin: { ...origin }, targetX, targetY, mineY, ageMs: 0, flightMs: config.mineFlightMs,
    arcHeight: config.mineArcHeight, rotation: 0,
    damage: config.damage * attackDamageMultiplier(session, troop, { explosive: true }), radius: config.radius,
    color: config.color, active: true, launched: false, seed: nextEffectSeed(session),
    launchAt: session.elapsed + (config.attackVisuals.mine.shots?.[0]?.atMs || 0),
  });
  troop.mineReadyAt = session.elapsed + attackIntervalFor(session, troop, config, config.attackEveryMs);
  events.push({ type: "mineReserved", row: target.row, col: target.col, sourceTroopId: troop.id });
  return true;
}

function fireCloseGun(session, troop, config, target) {
  troop.lastAttackMode = "gun";
  troop.lastAttackAt = session.elapsed;
  const origin = getMuzzleWorldPosition(troop, config, 0);
  session.projectiles.push({
    id: id("projectile"), kind: "bullet", troopType: troop.type, visualKind: config.attackVisuals.gun.effect,
    sourceTroopId: troop.id, shotIndex: 0, row: troop.row, straightLane: true,
    x: origin.x, y: origin.y, previousX: origin.x, previousY: origin.y,
    origin: { ...origin }, ageMs: 0, trail: [{ x: origin.x, y: origin.y }],
    vx: 390, vy: 0, damage: config.closeDamage * attackDamageMultiplier(session, troop), targetId: target.id, radius: 0,
    color: config.color, active: true, launched: false, seed: nextEffectSeed(session), maxDistance: config.closeRange * CELL.width,
    launchAt: session.elapsed + (config.attackVisuals.gun.shots?.[0]?.atMs || 0),
  });
  troop.gunReadyAt = session.elapsed + attackIntervalFor(session, troop, config, config.closeAttackEveryMs);
}

function updateDemolidora(session, troop, config, events) {
  const closeTarget = session.enemies
    .filter((enemy) => !enemy.dead && enemy.row === troop.row && enemy.x >= troop.x && enemy.x - troop.x <= config.closeRange * CELL.width)
    .sort((left, right) => left.x - right.x)[0] || null;
  if (closeTarget) {
    if (session.elapsed >= troop.gunReadyAt) fireCloseGun(session, troop, config, closeTarget);
    return;
  }
  if (session.elapsed >= troop.mineReadyAt) launchMine(session, troop, config, events);
}

function enemiesInTroopTile(session, troop) {
  return session.enemies.filter((enemy) => !enemy.dead
    && enemy.row === troop.row
    && enemyColumn(enemy) === troop.col);
}

export function selectNaniteHealTarget(session, medic, config = TROOPS.medicaNanites) {
  const healStartThreshold = config.healStartThreshold ?? 1;
  return session.troops
    .filter((troop) => troop.id !== medic.id
      && !troop.dead
      && troop.hp > 0
      && troop.hp < troop.maxHp
      && troop.hp / troop.maxHp < healStartThreshold
      && troop.row === medic.row
      && troop.col > medic.col
      && troop.col - medic.col <= config.healRangeTiles)
    .sort((left, right) => left.hp - right.hp
      || left.hp / left.maxHp - right.hp / right.maxHp
      || left.col - right.col)[0] || null;
}

export function selectNaniteAttackTarget(session, medic, config = TROOPS.medicaNanites) {
  const occupants = enemiesInTroopTile(session, medic)
    .sort((left, right) => {
      const leftReady = Number.isFinite(left.attackReadyAt) ? left.attackReadyAt - session.elapsed : Infinity;
      const rightReady = Number.isFinite(right.attackReadyAt) ? right.attackReadyAt - session.elapsed : Infinity;
      return leftReady - rightReady || left.hp - right.hp;
    });
  if (occupants.length) return occupants[0];
  return session.enemies
    .filter((enemy) => !enemy.dead
      && enemy.hp > 0
      && enemy.row === medic.row
      && enemyColumn(enemy) > medic.col
      && enemyColumn(enemy) - medic.col <= config.range)
    .sort((left, right) => enemyColumn(left) - enemyColumn(right) || left.x - right.x)[0] || null;
}

function setNaniteMedicState(medic, state, elapsed) {
  if (medic.state === state) return;
  medic.state = state;
  medic.stateStartedAt = elapsed;
}

function startNaniteCooldown(session, medic, config) {
  medic.healTargetId = null;
  medic.attackTargetId = null;
  medic.cooldownStartedAt = session.elapsed;
  medic.cooldownEndsAt = session.elapsed + config.healCooldownMs;
  setNaniteMedicState(medic, "cooldown", session.elapsed);
}

function finishNaniteCooldown(session, medic) {
  medic.healedThisCharge = 0;
  medic.healTargetId = null;
  medic.attackTargetId = null;
  medic.cooldownStartedAt = null;
  medic.cooldownEndsAt = null;
  medic.lastHealPulseAt = -Infinity;
  setNaniteMedicState(medic, "idle", session.elapsed);
}

function fireNaniteBullet(session, medic, config, target, events) {
  setNaniteMedicState(medic, "attacking", session.elapsed);
  fireTroop(session, medic, config, target, events);
  medic.attackReadyAt = session.elapsed + config.attackEveryMs;
  medic.lastAttackAt = session.elapsed;
  medic.attackTargetId = target.id;
}

function updateNaniteMedic(session, medic, config, events) {
  if (medic.state === "cooldown") {
    if (session.elapsed >= medic.cooldownEndsAt) finishNaniteCooldown(session, medic);
    else return;
  }

  const sameTileEnemy = selectNaniteAttackTarget(session, medic, { ...config, range: 0 });
  if (sameTileEnemy) {
    if (medic.healTargetId) medic.lastHealPulseAt = session.elapsed;
    if (session.elapsed >= medic.attackReadyAt) fireNaniteBullet(session, medic, config, sameTileEnemy, events);
    else setNaniteMedicState(medic, "attacking", session.elapsed);
    return;
  }

  if (medic.healTargetId) {
    const lockedTarget = session.troops.find((troop) => troop.id === medic.healTargetId && !troop.dead && troop.hp > 0);
    if (!lockedTarget || lockedTarget.hp >= lockedTarget.maxHp) {
      startNaniteCooldown(session, medic, config);
      return;
    }
  } else {
    const target = selectNaniteHealTarget(session, medic, config);
    if (target) {
      medic.healTargetId = target.id;
      medic.lastHealPulseAt = session.elapsed - config.healPulseEveryMs;
      setNaniteMedicState(medic, "healing", session.elapsed);
    }
  }

  if (medic.healTargetId) {
    const target = session.troops.find((troop) => troop.id === medic.healTargetId && !troop.dead && troop.hp > 0);
    if (!target) {
      startNaniteCooldown(session, medic, config);
      return;
    }
    setNaniteMedicState(medic, "healing", session.elapsed);
    while (session.elapsed - medic.lastHealPulseAt >= config.healPulseEveryMs) {
      const missingHp = target.maxHp - target.hp;
      const remainingEnergy = config.maxHealingPerCharge - medic.healedThisCharge;
      const amount = Math.min(config.healPulseAmount, missingHp, remainingEnergy);
      medic.lastHealPulseAt += config.healPulseEveryMs;
      if (amount <= 0) break;
      target.hp = Math.min(target.maxHp, target.hp + amount);
      target.lastNaniteHealAt = session.elapsed;
      target.lastNaniteHealAmount = amount;
      medic.healedThisCharge += amount;
      events.push({
        type: "naniteHealPulse", medicId: medic.id, targetId: target.id, amount,
        x: target.x, y: target.y, bornAt: session.elapsed, color: config.color,
      });
      if (target.hp >= target.maxHp || medic.healedThisCharge >= config.maxHealingPerCharge) break;
    }
    if (target.hp >= target.maxHp || medic.healedThisCharge >= config.maxHealingPerCharge) {
      startNaniteCooldown(session, medic, config);
    }
    return;
  }

  const rangedEnemy = selectNaniteAttackTarget(session, medic, config);
  if (rangedEnemy) {
    medic.attackTargetId = rangedEnemy.id;
    if (session.elapsed >= medic.attackReadyAt) fireNaniteBullet(session, medic, config, rangedEnemy, events);
    else setNaniteMedicState(medic, "attacking", session.elapsed);
    return;
  }

  medic.attackTargetId = null;
  setNaniteMedicState(medic, "idle", session.elapsed);
}

export function findAdjacentLumiThreat(session, troop) {
  const frontCol = troop.col + 1;
  const protectedTile = session.troops.some((ally) =>
    !ally.dead && ally.id !== troop.id && ally.row === troop.row && ally.col === frontCol);
  if (protectedTile) return null;
  return session.enemies
    .filter((enemy) => !enemy.dead
      && enemy.row === troop.row
      && !ENEMIES[enemy.type]?.airborne
      && enemyColumn(enemy) === frontCol)
    .sort((left, right) => left.x - right.x)[0] || null;
}

export function findRepulsorTarget(session, troop, config = TROOPS.lumiUrsa7) {
  return session.enemies
    .filter((enemy) => !enemy.dead
      && enemy.row === troop.row
      && !ENEMIES[enemy.type]?.airborne
      && enemy.x > troop.x
      && enemy.x - troop.x <= config.repulsorRangeTiles * CELL.width)
    .sort((left, right) => left.x - right.x)[0] || null;
}

export function getLumiKnockbackFactor(enemy) {
  if (!enemy || enemy.variant === "alpha") return 0;
  const role = ENEMIES[enemy.type]?.role || "";
  if (role.includes("Elite")) return 0.25;
  if (role.includes("Colosso") || role.includes("Santuário")) return 0.35;
  if (role.includes("Resistente") || role.includes("Duelista")) return 0.75;
  return 1;
}

function setLumiState(troop, state, elapsed, durationMs = Infinity) {
  if (troop.state !== state) troop.stateStartedAt = elapsed;
  troop.state = state;
  troop.stateEndsAt = Number.isFinite(durationMs) ? elapsed + durationMs : Infinity;
}

function cancelPendingRepulsor(session, troop) {
  if (!troop.pendingRepulsorShot) return;
  const projectile = session.projectiles.find((entry) => entry.id === troop.pendingRepulsorShot);
  if (projectile && !projectile.launched) projectile.active = false;
  troop.pendingRepulsorShot = null;
}

function startLumiDefense(session, troop, config, threat) {
  cancelPendingRepulsor(session, troop);
  troop.attackTargetId = null;
  troop.defenseThreatId = threat.id;
  troop.defenseExitAt = null;
  troop.defenseActive = false;
  setLumiState(troop, "transitionIn", session.elapsed, config.transitionInMs);
}

function startRepulsorAttack(session, troop, config, target) {
  const origin = getMuzzleWorldPosition(troop, config, 0);
  const projectileId = id("projectile");
  session.projectiles.push({
    id: projectileId, kind: "repulsorFist", visualKind: "repulsorFist",
    troopType: troop.type, sourceTroopId: troop.id, targetId: target.id, row: troop.row,
    x: origin.x, y: origin.y, previousX: origin.x, previousY: origin.y,
    origin: { ...origin }, ageMs: 0, trail: [{ x: origin.x, y: origin.y }],
    vx: config.projectileSpeed, vy: 0, damage: config.damage * attackDamageMultiplier(session, troop),
    pushDistanceTiles: config.pushDistanceTiles, stunChance: config.stunChance, stunMs: config.stunMs,
    pushVisualDurationMs: config.pushVisualDurationMs,
    color: config.color, active: true, launched: false, seed: nextEffectSeed(session),
    launchAt: session.elapsed + config.attackVisual.releaseMs,
  });
  troop.pendingRepulsorShot = projectileId;
  troop.attackTargetId = target.id;
  troop.lastAttackAt = session.elapsed;
  troop.lastRepulsorAt = session.elapsed;
  troop.attackReadyAt = session.elapsed + attackIntervalFor(session, troop, config, config.attackEveryMs);
  troop.attackBusyUntil = session.elapsed + config.attackVisual.durationMs;
  setLumiState(troop, "attack", session.elapsed, config.attackVisual.durationMs);
}

function updateLumiUrsa7(session, troop, config) {
  const threat = findAdjacentLumiThreat(session, troop);
  if (troop.state === "transitionIn") {
    troop.defenseActive = session.elapsed - troop.stateStartedAt >= config.shieldActivationMs;
    if (session.elapsed >= troop.stateEndsAt) {
      troop.defenseActive = true;
      setLumiState(troop, "defense", session.elapsed);
    }
    return;
  }
  if (troop.state === "defense") {
    troop.defenseActive = true;
    if (threat) {
      troop.defenseThreatId = threat.id;
      troop.defenseExitAt = null;
      return;
    }
    if (troop.defenseExitAt == null) troop.defenseExitAt = session.elapsed + config.defenseExitDelayMs;
    if (session.elapsed >= troop.defenseExitAt) {
      troop.defenseThreatId = null;
      setLumiState(troop, "transitionOut", session.elapsed, config.transitionOutMs);
    }
    return;
  }
  if (troop.state === "transitionOut") {
    troop.defenseActive = true;
    if (threat) {
      troop.defenseThreatId = threat.id;
      troop.defenseExitAt = null;
      setLumiState(troop, "defense", session.elapsed);
      return;
    }
    if (session.elapsed >= troop.stateEndsAt) {
      troop.defenseActive = false;
      troop.defenseThreatId = null;
      troop.defenseExitAt = null;
      setLumiState(troop, "idle", session.elapsed);
    }
    return;
  }
  if (threat) {
    startLumiDefense(session, troop, config, threat);
    return;
  }
  if (troop.state === "attack" && session.elapsed < troop.attackBusyUntil) return;
  const target = findRepulsorTarget(session, troop, config);
  if (target && session.elapsed >= troop.attackReadyAt) {
    startRepulsorAttack(session, troop, config, target);
    return;
  }
  troop.attackTargetId = null;
  setLumiState(troop, "idle", session.elapsed);
}

export function isTroopSpecialReady(session, troop) {
  const config = TROOPS[troop?.type];
  return Boolean(config?.specialEveryMs && !troop.dead && !troop.specialRequested
    && session.elapsed >= troop.specialReadyAt);
}

export function activateTroopSpecial(session, troopId) {
  const troop = session.troops.find((entry) => entry.id === troopId && !entry.dead);
  const config = TROOPS[troop?.type];
  if (!troop || config?.attack !== "tileMelee") return { ok: false, reason: "Esta unidade não possui um especial manual." };
  if (!session.waveActive) return { ok: false, reason: "O Esmagamento Total só pode ser ativado durante uma onda." };
  if (!isTroopSpecialReady(session, troop)) return { ok: false, reason: "Esmagamento Total ainda está recarregando." };
  troop.specialRequested = true;
  troop.specialReadyAt = Infinity;
  return {
    ok: true, troop, queued: Boolean(troop.pendingImpact || session.elapsed < troop.attackBusyUntil),
    event: { type: "specialPrimed", x: troop.x, y: troop.y - 34, color: config.color, sourceTroopId: troop.id },
  };
}

function startTileMeleeAttack(session, troop, config, mode) {
  const visual = config.attackVisuals?.[mode] || config.attackVisual;
  troop.lastAttackMode = mode;
  troop.lastAttackAt = session.elapsed;
  troop.attackBusyUntil = session.elapsed + (visual?.durationMs || 0);
  troop.pendingImpact = {
    mode,
    impactAt: session.elapsed + (visual?.impactMs || 0),
    damage: (mode === "special" ? config.specialDamage : config.damage) * attackDamageMultiplier(session, troop),
    stunMs: mode === "special" ? config.specialStunMs : 0,
  };
  troop.attackReadyAt = session.elapsed + attackIntervalFor(session, troop, config, config.attackEveryMs);
  if (mode === "special") {
    troop.specialRequested = false;
    troop.specialReadyAt = session.elapsed + config.specialEveryMs;
    troop.attackReadyAt = Math.max(troop.attackReadyAt, troop.attackBusyUntil);
  }
}

function updateTileMelee(session, troop, config, events) {
  if (troop.pendingImpact && session.elapsed >= troop.pendingImpact.impactAt) {
    const impact = troop.pendingImpact;
    const occupants = enemiesInTroopTile(session, troop);
    occupants.forEach((enemy) => {
      damageEnemy(session, enemy, impact.damage, events);
      if (impact.stunMs) stunEnemy(session, enemy, impact.stunMs);
    });
    events.push({
      type: "tileImpact", mode: impact.mode, sourceTroopId: troop.id,
      x: troop.x, y: troop.y + CELL.height * 0.34, color: config.color,
      seed: nextEffectSeed(session), shake: impact.mode === "special" ? 8 : 4,
      lightRadius: impact.mode === "special" ? 170 : 100,
      targetIds: occupants.map((enemy) => enemy.id),
    });
    troop.pendingImpact = null;
  }
  if (troop.pendingImpact || session.elapsed < troop.attackBusyUntil) return;
  if (troop.specialRequested) {
    startTileMeleeAttack(session, troop, config, "special");
    return;
  }
  if (session.elapsed < troop.attackReadyAt || !enemiesInTroopTile(session, troop).length) return;
  startTileMeleeAttack(session, troop, config, "normal");
}

function updateTroops(session, events, dt) {
  for (const troop of session.troops) {
    if (troop.dead) continue;
    const baseConfig = TROOPS[troop.type];
    const config = effectiveCombatConfig(session, troop, baseConfig);
    if (config.attack === "energy") {
      troop.energyAccumulator = Math.min(config.attackEveryMs, troop.energyAccumulator + dt * (troop.attackSpeedFactor || 1));
      if (troop.energyAccumulator < config.attackEveryMs || session.energy >= session.energyMax) continue;
      const amount = Math.min(config.energyPerPulse, session.energyMax - session.energy);
      session.energy += amount;
      session.lastEnergyGainAt = session.elapsed;
      troop.energyAccumulator -= config.attackEveryMs;
      troop.lastAttackAt = session.elapsed;
      events.push({ type: "energyGenerated", sourceTroopId: troop.id, x: troop.x, y: troop.y, amount, color: config.color });
      continue;
    }
    if (isNaniteMedic(config)) {
      updateNaniteMedic(session, troop, config, events);
      continue;
    }
    if (isLumiUrsa7(config)) {
      updateLumiUrsa7(session, troop, config, events);
      continue;
    }
    if (config.attack === "flame") {
      updateFlameChannel(session, troop, config, events, dt);
      continue;
    }
    if (config.attack === "mine") {
      updateDemolidora(session, troop, config, events);
      continue;
    }
    if (config.attack === "tileMelee") {
      updateTileMelee(session, troop, config, events);
      continue;
    }
    if (config.attack === "none" || session.elapsed < troop.attackReadyAt) continue;
    if (config.attack === "mortar") {
      const group = mortarTargetGroup(session, troop, config);
      if (!group) continue;
      fireMortar(session, troop, config, group);
    } else {
      const target = closestEnemy(session, troop, config);
      if (!target) continue;
      fireTroop(session, troop, config, target, events);
    }
    troop.attackReadyAt = session.elapsed + attackIntervalFor(session, troop, config, config.attackEveryMs);
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
        type: projectile.kind === "mine" ? "mineLaunch" : "shoot", weapon: projectile.visualKind, troopType: projectile.troopType,
        sourceTroopId: projectile.sourceTroopId, shotIndex: projectile.shotIndex,
        x: projectile.x, y: projectile.y, color: projectile.color, seed: projectile.seed,
      });
    }
    projectile.ageMs += dt;
    if (projectile.kind === "repulsorFist") {
      const target = session.enemies.find((enemy) => enemy.id === projectile.targetId && !enemy.dead);
      const source = session.troops.find((troop) => troop.id === projectile.sourceTroopId && !troop.dead);
      if (!target) {
        projectile.active = false;
        if (source?.pendingRepulsorShot === projectile.id) source.pendingRepulsorShot = null;
        continue;
      }
      const targetPoint = getEnemyHitPoint(target, ENEMIES[target.type]);
      projectile.previousX = projectile.x;
      projectile.previousY = projectile.y;
      projectile.previousRenderX = projectile.x;
      projectile.previousRenderY = projectile.y;
      projectile.x += projectile.vx * dt / 1000;
      projectile.y += projectile.vy * dt / 1000;
      projectile.trail.push({ x: projectile.x, y: projectile.y });
      if (projectile.trail.length > 8) projectile.trail.shift();
      const crossedTarget = projectile.previousX <= targetPoint.x + 24 && projectile.x >= targetPoint.x - 24;
      const closeToTarget = Math.hypot(targetPoint.x - projectile.x, targetPoint.y - projectile.y) <= 32;
      if (!crossedTarget && !closeToTarget) {
        if (projectile.x <= FIELD.width + 80) continue;
        projectile.active = false;
        if (source?.pendingRepulsorShot === projectile.id) source.pendingRepulsorShot = null;
        continue;
      }

      damageEnemy(session, target, projectile.damage, events);
      const pushedFromX = target.x;
      let stunned = false;
      if (!target.dead) {
        const existingVisualOffset = getRepulsorKnockbackOffset(target, session.elapsed);
        const knockbackFactor = getLumiKnockbackFactor(target);
        target.x = Math.min(
          FIELD.spawnX,
          target.x + CELL.width * projectile.pushDistanceTiles * knockbackFactor,
        );
        const pushedDistance = target.x - pushedFromX;
        target.previousX = target.x;
        target.previousRenderX = target.x;
        if (pushedDistance > 0) {
          target.knockbackVisualOffset = existingVisualOffset - pushedDistance;
          target.knockbackVisualStartedAt = session.elapsed;
          target.knockbackVisualEndsAt = session.elapsed + (projectile.pushVisualDurationMs ?? 300);
        }
        if (knockbackFactor > 0 && session.rng() < projectile.stunChance) {
          stunEnemy(session, target, projectile.stunMs);
          stunned = true;
        }
      }
      events.push({
        type: "repulsorImpact",
        sourceTroopId: projectile.sourceTroopId,
        targetId: target.id,
        x: target.x,
        y: targetPoint.y,
        pushedFromX,
        pushedToX: target.x,
        stunned,
        color: projectile.color,
        seed: projectile.seed,
      });
      projectile.active = false;
      if (source?.pendingRepulsorShot === projectile.id) source.pendingRepulsorShot = null;
      continue;
    }
    if (projectile.kind === "mortar") {
      projectile.ageMs = Math.max(0, session.elapsed - projectile.launchAt);
      const progress = Math.min(1, projectile.ageMs / projectile.flightMs);
      projectile.previousX = projectile.x;
      projectile.previousY = projectile.y;
      projectile.previousRenderX = projectile.x;
      projectile.previousRenderY = projectile.y;
      projectile.x = projectile.origin.x + (projectile.targetX - projectile.origin.x) * progress;
      projectile.y = projectile.origin.y + (projectile.targetY - projectile.origin.y) * progress
        - projectile.arcHeight * 4 * progress * (1 - progress);
      projectile.rotation = Math.atan2(projectile.y - projectile.previousY, projectile.x - projectile.previousX);
      projectile.trail.push({ x: projectile.x, y: projectile.y });
      if (projectile.trail.length > 12) projectile.trail.shift();
      if (progress >= 1) {
        const occupants = session.enemies.filter((enemy) => !enemy.dead
          && enemy.row === projectile.targetRow
          && enemyColumn(enemy) === projectile.targetCol);
        for (const enemy of occupants) {
          const multiplier = enemy.id === projectile.targetId ? 1 : projectile.collateralMultiplier;
          damageEnemy(session, enemy, projectile.damage * multiplier, events);
        }
        occupants.forEach((enemy) => applyConcussiveImpact(session, enemy));
        events.push({
          type: "explosion", weapon: projectile.visualKind,
          x: projectile.targetX, y: projectile.targetY,
          color: projectile.color, seed: projectile.seed,
        });
        projectile.active = false;
      }
      continue;
    }
    if (projectile.kind === "mine") {
      const progress = Math.min(1, projectile.ageMs / projectile.flightMs);
      projectile.previousX = projectile.x;
      projectile.previousY = projectile.y;
      projectile.previousRenderX = projectile.x;
      projectile.previousRenderY = projectile.y;
      projectile.x = projectile.origin.x + (projectile.targetX - projectile.origin.x) * progress;
      projectile.y = projectile.origin.y + (projectile.targetY - projectile.origin.y) * progress
        - projectile.arcHeight * 4 * progress * (1 - progress);
      projectile.rotation = progress * Math.PI * 3;
      if (progress >= 1) {
        session.mines.push({
          id: id("mine"), ownerId: projectile.sourceTroopId, row: projectile.targetRow, col: projectile.targetCol,
          x: projectile.targetX, y: projectile.mineY, damage: projectile.damage, radius: projectile.radius,
          color: projectile.color, active: true, armedAt: session.elapsed, seed: projectile.seed,
        });
        projectile.active = false;
        events.push({ type: "mineArmed", x: projectile.targetX, y: projectile.targetY, color: projectile.color, seed: projectile.seed });
      }
      continue;
    }
    let target;
    if (projectile.straightLane) {
      target = session.enemies
        .filter((enemy) => !enemy.dead && enemy.row === projectile.row && enemy.x >= projectile.previousX - 24)
        .sort((left, right) => left.x - right.x)[0] || null;
    } else {
      target = session.enemies.find((enemy) => enemy.id === projectile.targetId && !enemy.dead);
      if (!target) target = session.enemies.filter((enemy) => !enemy.dead).sort((a, b) => Math.hypot(a.x - projectile.x, a.y - projectile.y) - Math.hypot(b.x - projectile.x, b.y - projectile.y))[0];
    }
    const targetPoint = target ? getEnemyHitPoint(target, ENEMIES[target.type]) : null;
    if (projectile.kind === "missile" && target) {
      const angle = Math.atan2(targetPoint.y - projectile.y, targetPoint.x - projectile.x);
      projectile.vx += (Math.cos(angle) * 250 - projectile.vx) * 0.08;
      projectile.vy += (Math.sin(angle) * 250 - projectile.vy) * 0.08;
    }
    projectile.previousX = projectile.x;
    projectile.previousY = projectile.y;
    projectile.previousRenderX = projectile.x;
    projectile.previousRenderY = projectile.y;
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
        const affected = session.enemies.filter((enemy) => !enemy.dead && Math.hypot(enemy.x - target.x, enemy.y - target.y) <= projectile.radius);
        affected.forEach((enemy) => damageEnemy(session, enemy, projectile.damage, events));
        affected.forEach((enemy) => applyConcussiveImpact(session, enemy));
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
        target.slowUntil = session.elapsed + projectile.slowMs * session.modifiers.slowDuration * session.modifiers.krioSlowDuration;
      }
      projectile.active = false;
    }
  }
  session.projectiles = session.projectiles.filter((projectile) => projectile.active);
}

function pulseForRow(session, row) {
  return session.dematerializationPulses?.find((pulse) => pulse.row === row) || null;
}

function canActivateDematerializationPulse(session, pulse, enemy) {
  return Boolean(
    enemy
    && !enemy.dead
    && pulse
    && pulse.row === enemy.row
    && pulse.state === "ready"
    && !session.outcome
    && (session.waveActive || session.sandbox),
  );
}

function activateDematerializationPulse(session, pulse, events) {
  pulse.state = "charging";
  pulse.chargeStartedAt = session.elapsed;
  pulse.fireAt = session.elapsed + DEMATERIALIZATION_PULSE.chargeDurationMs;
  events.push({
    type: "pulseCharging",
    row: pulse.row,
    cannonId: pulse.id,
    startedAt: pulse.chargeStartedAt,
    fireAt: pulse.fireAt,
    x: FIELD.combatOffsetX - 4,
    y: pulse.row * CELL.height + CELL.height / 2,
    color: "#22d3ee",
  });
}

function disintegrateEnemy(session, enemy, events) {
  if (!enemy || enemy.dead) return;
  enemy.hp = 0;
  enemy.dead = true;
  detachParasite(session, enemy);
  session.killed += 1;
  events.push({
    type: "enemyDisintegrated",
    enemyId: enemy.id,
    row: enemy.row,
    x: enemy.x,
    y: enemy.y,
    bornAt: session.elapsed,
    entity: { ...enemy },
    color: "#22d3ee",
  });
}

function updateDematerializationPulses(session, events) {
  for (const pulse of session.dematerializationPulses || []) {
    if (pulse.state !== "charging" || session.elapsed < pulse.fireAt) continue;
    pulse.state = "spent";
    const y = pulse.row * CELL.height + CELL.height / 2;
    events.push({
      type: "pulseFired",
      row: pulse.row,
      cannonId: pulse.id,
      x0: FIELD.combatOffsetX - 4,
      y0: y,
      x1: FIELD.width + 24,
      y1: y,
      bornAt: session.elapsed,
      color: "#22d3ee",
      seed: nextEffectSeed(session),
    });
    session.enemies
      .filter((enemy) => !enemy.dead && enemy.row === pulse.row)
      .forEach((enemy) => disintegrateEnemy(session, enemy, events));
  }
  session.enemies = session.enemies.filter((enemy) => !enemy.dead);
}

function moveEnemy(session, enemy, dt, events) {
  enemy.moving = true;
  const slow = session.elapsed < enemy.slowUntil ? enemy.slowFactor : 1;
  enemy.x -= enemy.speed * session.modifiers.enemySpeed * (session.sandboxSettings?.enemySpeedMultiplier ?? 1) * slow * dt / 1000;
  if (enemy.x > FIELD.baseX) return;

  const pulse = pulseForRow(session, enemy.row);
  if (canActivateDematerializationPulse(session, pulse, enemy)) {
    enemy.x = FIELD.baseX;
    enemy.moving = false;
    activateDematerializationPulse(session, pulse, events);
    return;
  }
  if (pulse?.state === "charging") {
    enemy.x = FIELD.baseX;
    enemy.moving = false;
    return;
  }

  enemy.dead = true;
  const shielded = !session.sandbox && session.shieldCharges > 0;
  if (shielded) session.shieldCharges -= 1;
  const breachDamage = shielded ? 0 : enemy.baseDamage * session.currentWaveBaseDamageFactor * (session.sandboxSettings?.enemyDamageMultiplier ?? 1);
  if (!session.sandboxSettings?.invulnerableBase) session.integrity = Math.max(0, session.integrity - breachDamage);
  if (shielded) events.push({ type: "shieldBlock", x: FIELD.baseX, y: enemy.y, remaining: session.shieldCharges });
  events.push({ type: "breach", damage: breachDamage, x: FIELD.baseX, y: enemy.y });
}

function closestTroopForEnemy(session, enemy, range = Infinity) {
  return session.troops
    .filter((troop) => !troop.dead
      && troop.row === enemy.row
      && troop.x <= enemy.x
      && enemy.x - troop.x <= range * CELL.width)
    .sort((left, right) => right.x - left.x)[0] || null;
}

function troopBlockDistance(troop) {
  return troop?.type === "colossoImpacto" ? 48 : 54;
}

function updateJumpingParasite(session, enemy, config) {
  const target = session.troops.find((troop) => troop.id === enemy.jumpTargetTroopId && !troop.dead);
  if (!target || (target.attachedParasiteId && target.attachedParasiteId !== enemy.id)) {
    enemy.jumping = false;
    enemy.jumpTargetTroopId = null;
    enemy.jumpProgress = 0;
    enemy.moving = true;
    return false;
  }

  const progress = clamp((session.elapsed - enemy.jumpStartedAt) / config.jumpDurationMs, 0, 1);
  enemy.jumpProgress = progress;
  enemy.x = enemy.jumpFromX + (target.x - enemy.jumpFromX) * progress;
  enemy.moving = true;
  if (progress < 1) return true;
  return attachParasite(session, enemy, target, config);
}

function updateParasiteSaltador(session, enemy, config, dt, events) {
  if (enemy.attachedToTroopId) {
    const host = session.troops.find((troop) => troop.id === enemy.attachedToTroopId && !troop.dead);
    if (!host || host.attachedParasiteId !== enemy.id) {
      detachParasite(session, enemy);
    } else {
      enemy.x = host.x;
      enemy.y = host.y;
      enemy.moving = false;
      if (session.elapsed >= enemy.attackReadyAt) {
        damageTroop(session, host, enemy.damage, events);
        enemy.attackReadyAt = session.elapsed + config.attackEveryMs;
        enemy.lastAttackAt = session.elapsed;
      }
      return;
    }
  }

  if (enemy.jumping && updateJumpingParasite(session, enemy, config)) return;

  const candidates = session.troops
    .filter((troop) => !troop.dead && troop.row === enemy.row && troop.x <= enemy.x)
    .sort((left, right) => right.x - left.x);
  const front = candidates[0] || null;
  if (!front) {
    moveEnemy(session, enemy, dt, events);
    return;
  }

  const atFront = enemy.x - front.x <= troopBlockDistance(front);
  if (atFront && !enemy.jumpConsumed) {
    enemy.jumpConsumed = true;
    const rear = candidates[1] || null;
    const reserved = rear && session.enemies.some((candidate) => candidate !== enemy
      && !candidate.dead
      && candidate.jumpTargetTroopId === rear.id);
    if (rear && !rear.attachedParasiteId && !reserved) {
      enemy.jumping = true;
      enemy.jumpStartedAt = session.elapsed;
      enemy.jumpProgress = 0;
      enemy.jumpFromX = enemy.x;
      enemy.jumpTargetTroopId = rear.id;
      enemy.moving = true;
      return;
    }
  }

  if (atFront) {
    enemy.moving = false;
    if (session.elapsed >= enemy.attackReadyAt) {
      damageTroop(session, front, enemy.damage, events);
      enemy.attackReadyAt = session.elapsed + config.attackEveryMs;
      enemy.lastAttackAt = session.elapsed;
    }
  } else {
    moveEnemy(session, enemy, dt, events);
  }
}

function launchArcaneProjectile(session, enemy, config, target, events) {
  const origin = getEnemyMuzzleWorldPosition(enemy, config);
  const flightSeconds = Math.max(0.1, (origin.x - target.x) / config.projectileSpeed);
  const seed = nextEffectSeed(session);
  const visualKind = config.attackVisual?.effect || "abyssOrb";
  session.enemyProjectiles.push({
    id: id("enemy_projectile"), kind: "arcane", visualKind,
    sourceEnemyId: enemy.id, row: enemy.row, x: origin.x, y: origin.y,
    previousX: origin.x, previousY: origin.y, previousRenderX: origin.x, previousRenderY: origin.y,
    vx: -config.projectileSpeed, vy: (target.y - 18 - origin.y) / flightSeconds,
    damage: enemy.damage, color: config.color, active: true, launched: true,
    trail: [{ x: origin.x, y: origin.y }], ageMs: 0, seed,
  });
  events.push({
    type: "shoot", weapon: visualKind, faction: "enemy", sourceEnemyId: enemy.id,
    x: origin.x, y: origin.y, color: config.color, seed,
  });
}

function updateEnemyProjectiles(session, dt, events) {
  for (const projectile of session.enemyProjectiles) {
    if (!projectile.active) continue;
    projectile.ageMs += dt;
    projectile.previousX = projectile.x;
    projectile.previousY = projectile.y;
    projectile.previousRenderX = projectile.x;
    projectile.previousRenderY = projectile.y;
    projectile.x += projectile.vx * dt / 1000;
    projectile.y += projectile.vy * dt / 1000;
    projectile.trail.push({ x: projectile.x, y: projectile.y });
    if (projectile.trail.length > 14) projectile.trail.shift();

    const target = session.troops
      .filter((troop) => !troop.dead
        && troop.row === projectile.row
        && troop.x <= projectile.previousX + 24
        && troop.x >= projectile.x - 24)
      .sort((left, right) => right.x - left.x)[0] || null;
    if (target) {
      damageTroop(session, target, projectile.damage, events);
      events.push({
        type: "abyssImpact", weapon: projectile.visualKind, x: target.x, y: target.y - 18,
        color: projectile.color, seed: projectile.seed,
      });
      projectile.active = false;
    } else if (projectile.x <= FIELD.baseX || projectile.y < -80 || projectile.y > FIELD.height + 80) {
      projectile.active = false;
    }
  }
  session.enemyProjectiles = session.enemyProjectiles.filter((projectile) => projectile.active);
}

function updateEnemies(session, dt, events) {
  for (const enemy of session.enemies) {
    if (enemy.dead) continue;
    enemy.previousRenderX = enemy.x;
    enemy.previousRenderY = enemy.y;
    const config = ENEMIES[enemy.type];
    if (session.elapsed < (enemy.stunnedUntil || 0)) {
      enemy.moving = false;
      continue;
    }
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

    if (enemy.type === "parasitaSaltador") {
      updateParasiteSaltador(session, enemy, config, dt, events);
      continue;
    }

    if (enemy.type === "crisalio" && enemy.meleeAttackPending) {
      enemy.moving = false;
      if (session.elapsed >= enemy.meleeImpactAt) {
        const target = session.troops.find((troop) => troop.id === enemy.meleeTargetId && !troop.dead);
        if (target && target.row === enemy.row && enemy.x - target.x <= troopBlockDistance(target)) {
          damageTroop(session, target, enemy.damage, events);
          events.push({ type: "melee", x: target.x, y: target.y, sourceEnemyId: enemy.id });
        }
        enemy.meleeAttackPending = false;
        enemy.meleeImpactAt = Infinity;
        enemy.meleeTargetId = null;
      }
      continue;
    }

    if (config.attack === "arcane") {
      const rangedTarget = closestTroopForEnemy(session, enemy, config.range);
      if (!rangedTarget) {
        enemy.casting = false;
        enemy.castReadyAt = Infinity;
        moveEnemy(session, enemy, dt, events);
        continue;
      }
      enemy.moving = false;
      if (enemy.casting && session.elapsed >= enemy.castReadyAt) {
        launchArcaneProjectile(session, enemy, config, rangedTarget, events);
        enemy.casting = false;
        enemy.castReadyAt = Infinity;
        enemy.lastAttackAt = session.elapsed;
        enemy.attackReadyAt = session.elapsed + config.attackEveryMs;
      } else if (!enemy.casting && session.elapsed >= enemy.attackReadyAt) {
        enemy.casting = true;
        enemy.castStartedAt = session.elapsed;
        enemy.castReadyAt = session.elapsed + config.chargeMs;
        const origin = getEnemyMuzzleWorldPosition(enemy, config);
        events.push({ type: "abyssCharge", x: origin.x, y: origin.y, color: config.color, seed: nextEffectSeed(session) });
      }
      continue;
    }

    const target = closestTroopForEnemy(session, enemy);
    if (target && enemy.x - target.x <= troopBlockDistance(target)) {
      enemy.moving = false;
      if (session.elapsed >= enemy.attackReadyAt) {
        if (enemy.type === "crisalio") {
          enemy.meleeAttackPending = true;
          enemy.meleeAttackStartedAt = session.elapsed;
          enemy.meleeImpactAt = session.elapsed + config.attackVisual.impactMs;
          enemy.meleeTargetId = target.id;
          enemy.attackReadyAt = session.elapsed + config.attackEveryMs;
          enemy.lastAttackAt = session.elapsed;
        } else {
          damageTroop(session, target, enemy.damage, events);
          enemy.attackReadyAt = session.elapsed + config.attackEveryMs;
          enemy.lastAttackAt = session.elapsed;
        }
      }
    } else {
      moveEnemy(session, enemy, dt, events);
    }
  }
  session.troops = session.troops.filter((troop) => !troop.dead);
  session.enemies = session.enemies.filter((enemy) => !enemy.dead);
}

function updateMines(session, events) {
  for (const mine of session.mines) {
    if (!mine.active) continue;
    const cellLeft = mine.col * CELL.width;
    const cellRight = cellLeft + CELL.width;
    const trigger = session.enemies.find((enemy) => {
      if (enemy.dead || enemy.row !== mine.row || !isGroundTrapEligible(enemy)) return false;
      const previousX = Number.isFinite(enemy.previousRenderX) ? enemy.previousRenderX : enemy.x;
      return Math.min(previousX, enemy.x) <= cellRight && Math.max(previousX, enemy.x) >= cellLeft;
    });
    if (!trigger) continue;
    mine.active = false;
    const affected = session.enemies
      .filter((enemy) => !enemy.dead && isGroundTrapEligible(enemy)
        && (enemy === trigger || Math.hypot(enemy.x - mine.x, enemy.y - mine.y) <= mine.radius));
    affected.forEach((enemy) => damageEnemy(session, enemy, mine.damage, events));
    affected.forEach((enemy) => applyConcussiveImpact(session, enemy));
    events.push({ type: "explosion", weapon: "magneticMine", x: mine.x, y: mine.y, color: mine.color, seed: mine.seed });
  }
  session.mines = session.mines.filter((mine) => mine.active);
  session.enemies = session.enemies.filter((enemy) => !enemy.dead);
}

function finish(session, outcome) {
  if (session.outcome) return;
  const integrityPercent = session.integrityMax > 0 ? session.integrity / session.integrityMax * 100 : 0;
  session.outcome = outcome;
  session.waveActive = false;
  session.preparing = false;
  session.result = {
    phaseId: session.phase.id,
    outcome,
    stars: calculateStars({ outcome, integrity: session.integrity, integrityMax: session.integrityMax, durationMs: session.elapsed, targetDurationMs: session.phase.targetDurationMs }),
    durationMs: Math.round(session.elapsed),
    integrity: Math.round(integrityPercent),
    integrityCurrent: Math.round(session.integrity),
    integrityMax: Math.round(session.integrityMax),
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
  updateEnergyPickups(session, dt, events);
  if (session.waveActive || session.sandbox) {
    session.supplyAccumulator += dt;
    while (session.supplyAccumulator >= 1000) {
      session.supplyAccumulator -= 1000;
      session.supply = Math.min(session.supplyMax, session.supply + 1);
    }
    while (session.waveActive && session.queue.length && session.elapsed >= session.nextSpawnAt) {
      const enemy = createEnemy(session, session.queue.shift());
      if (!enemy) continue;
      session.nextSpawnAt += session.phase.cadenceMs;
      events.push({ type: "spawn", x: enemy.x, y: enemy.y, enemy });
    }
    updateDematerializationPulses(session, events);
    updatePrismaticMantle(session, events);
    updateTroops(session, events, dt);
    updateProjectiles(session, dt, events);
    updateEnemyProjectiles(session, dt, events);
    updateEnemies(session, dt, events);
    updateMines(session, events);
    if (!session.sandbox && session.integrity <= 0) finish(session, "defeat");
    if (!session.sandbox && !session.outcome && session.queue.length === 0 && session.enemies.length === 0 && session.enemyProjectiles.length === 0) {
      session.waveActive = false;
      const completedWave = session.waveIndex;
      const waveCompletionEnergy = Math.max(0, Number(session.phase.waveCompletionEnergy) || 0);
      const waveCompletionAmount = Math.min(waveCompletionEnergy, Math.max(0, session.energyMax - session.energy));
      if (waveCompletionAmount > 0) {
        session.energy += waveCompletionAmount;
        session.lastEnergyGainAt = session.elapsed;
        events.push({
          type: "energyGenerated",
          x: FIELD.baseX,
          y: FIELD.height / 2,
          amount: waveCompletionAmount,
          reason: "waveCompletion",
          color: "#22d3ee",
        });
      }
      const reactor = session.troops.find((troop) => !troop.dead && TROOPS[troop.type].attack === "energy");
      if (reactor) {
        const config = TROOPS[reactor.type];
        const amount = Math.min(config.waveEnergyBonus, Math.max(0, session.energyMax - session.energy));
        if (amount > 0) {
          session.energy += amount;
          session.lastEnergyGainAt = session.elapsed;
          reactor.lastAttackAt = session.elapsed;
          events.push({ type: "energyGenerated", sourceTroopId: reactor.id, x: reactor.x, y: reactor.y, amount, reason: "wave", color: config.color });
        }
      }
      if (completedWave >= session.phase.waves.length - 1) {
        finish(session, "victory");
      } else {
        session.waveIndex += 1;
        session.preparing = true;
        const level = completedWave + 1;
        session.pendingDecisionLevel = level;
        session.pendingDecision = getDecisionOptions({
          level,
          integrity: session.integrity,
          integrityMax: session.integrityMax,
          loadout: session.loadout,
          decisions: session.decisions,
          seed: session.seed,
        });
        events.push({ type: "waveComplete", wave: completedWave + 1 });
      }
    }
  }
  return events;
}

export function getSnapshot(session) {
  const deploymentStats = Object.fromEntries(session.loadout.map((troopId) => [troopId, getEffectiveTroopStats(session, troopId)]));
  return {
    energy: Math.round(session.energy), energyMax: Math.round(session.energyMax),
    energyPulse: session.elapsed - session.lastEnergyGainAt < 700,
    supply: Math.round(session.supply * 10) / 10, supplyMax: session.supplyMax,
    integrity: Math.round(session.integrity), integrityMax: Math.round(session.integrityMax),
    wave: session.waveIndex + 1, totalWaves: session.phase.waves.length,
    enemies: session.enemies.length, queued: session.queue.length,
    mines: session.mines.length,
    energyPickups: session.energyPickups.length,
    preparing: session.preparing, pendingDecision: session.pendingDecision, pendingDecisionLevel: session.pendingDecisionLevel,
    outcome: session.outcome, elapsed: session.elapsed,
    sandbox: session.sandbox,
    sandboxSettings: session.sandboxSettings ? { ...session.sandboxSettings } : null,
    cooldowns: Object.fromEntries(Object.entries(session.deployCooldowns).map(([key, value]) => [key, Math.max(0, value - session.elapsed)])),
    deploymentStats,
    refundRate: session.modifiers.refundRate,
    shieldCharges: session.shieldCharges,
    prismaticMantle: { ...session.prismaticMantle },
    dematerializationPulses: session.dematerializationPulses.map((pulse) => ({ ...pulse })),
    nextWaveEnemyCountFactor: session.nextWaveEnemyCountFactor,
  };
}

export function cellFromPoint(x, y) {
  return { row: clamp(Math.floor(y / CELL.height), 0, FIELD.rows - 1), col: clamp(Math.floor(x / CELL.width), 0, FIELD.cols - 1) };
}
