import { DEFAULT_MAX_DEPLOYED_PER_TROOP, ENEMIES, TROOPS } from "./content.js";
import { buildSpawnQueue, calculateStars, createRng, getDecisionOptions, getDecisionStage, isGroundTrapEligible } from "./domain.js";
import {
  adaptiveAidBlocksIntermission,
  adaptiveAidCinematicFactor,
  adaptiveAidPausesSimulation,
  calculateHardshipScore,
  capsuleReservesCell,
  clearExpiredTroopLosses,
  createAdaptiveAidState,
  evaluateAdaptiveAid,
  getEligibleAdaptiveAidOptions,
  isCapsuleClickable,
  openAdaptiveAidCapsule as openAdaptiveAidCapsuleDomain,
  pointHitsCapsule,
  recordTroopLoss,
  selectAdaptiveAidOption as selectAdaptiveAidOptionDomain,
  simulateAdaptiveAid as simulateAdaptiveAidDomain,
  updateAdaptiveAid,
  updateAdaptiveAidLifecycle,
} from "./adaptiveAid.js";
import {
  CELL, FIELD, VIEWPORT, getEnemyHitPoint, getEnemyMuzzleWorldPosition,
  getMuzzleWorldPosition, getRepulsorKnockbackOffset, getTroopAnimation,
} from "./visualGeometry.js";
import {
  forceExecutorComboStep, isExecutorArco, updateExecutorArco,
} from "./executorArco.js";
import {
  createWindCurrentState,
  endWindCurrent,
  resetWindCurrentForWave,
  updateWindCurrent,
} from "./windCurrent.js";

export {
  createWindCurrentState,
  endWindCurrent,
  resetWindCurrentForWave,
  updateWindCurrent,
} from "./windCurrent.js";

export { CELL, FIELD, VIEWPORT } from "./visualGeometry.js";
export {
  adaptiveAidBlocksIntermission,
  adaptiveAidCinematicFactor,
  adaptiveAidPausesSimulation,
  calculateHardshipScore,
  clearExpiredTroopLosses,
  evaluateAdaptiveAid,
  getEligibleAdaptiveAidOptions,
  isCapsuleClickable,
  pointHitsCapsule,
  recordTroopLoss,
  updateAdaptiveAid,
  updateAdaptiveAidLifecycle,
};

export function getTroopDeploymentLimit(troopId) {
  return Number.isFinite(TROOPS[troopId]?.maxDeployed) ? TROOPS[troopId].maxDeployed : DEFAULT_MAX_DEPLOYED_PER_TROOP;
}

export function getActiveTroopCount(session, troopId) {
  return session.troops.filter((troop) => !troop.dead && troop.type === troopId).length;
}

export function validateLoadoutForPhase(phase, loadout) {
  const uniqueLoadout = [...new Set(loadout || [])];
  if (!uniqueLoadout.length) return { ok: false, reason: "Selecione pelo menos uma tropa." };
  if (uniqueLoadout.length > (phase.loadoutLimit ?? 6)) return { ok: false, reason: `Este capÃ­tulo permite no mÃ¡ximo ${phase.loadoutLimit} tropas.` };
  if (uniqueLoadout.some((troopId) => !TROOPS[troopId])) return { ok: false, reason: "Loadout contÃ©m uma tropa invÃ¡lida." };
  return { ok: true, loadout: uniqueLoadout };
}

let entityId = 1;
const id = (prefix) => `${prefix}_${entityId++}`;
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
export const CONCUSSIVE_IMPACT = Object.freeze({ baseDistance: 20, cooldownMs: 3000, heavyFactor: 0.5, alphaFactor: 0.25 });
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
  ballisticProjectileSpeed: 1, explosiveRadius: 1,
  concussiveImpact: false, firstImpact: false, focusedFire: false,
  continuousSuppression: false, advancedFormation: false, reactiveBarrier: false,
  organizedRetreat: false, frontlineDoctrine: false, supportDoctrine: false,
  precisionDoctrine: false, humanSwarmDoctrine: false, territorialControl: false,
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

function isScarabEmperor(config) {
  return config?.id === "scarabEmperor";
}

function usesTargetingSystems(config) {
  return config && !["none", "energy", "melee", "mine", "tileMelee", "arcCombo"].includes(config.attack);
}

function isSandstormActive(session) {
  return session.sandstorm?.state === "active";
}

function isSandBuried(session, troop) {
  return session.elapsed < (troop.sandBuriedUntil || 0);
}

export function getTroopRangePenaltyTiles(session, troop, config = TROOPS[troop?.type]) {
  if (!config || !usesTargetingSystems(config)) return 0;
  let penalty = session.elapsed < (troop.webRangePenaltyUntil || 0)
    ? troop.webRangePenaltyTiles || 0
    : 0;
  const hazard = session.phase.environmentHazard;
  if (isSandstormActive(session) && hazard?.id === "sandstorm") {
    penalty += hazard.rangePenaltyTiles;
  }
  return penalty;
}

export function getEffectiveTroopStats(session, troopId) {
  const config = TROOPS[troopId];
  if (!config) return null;
  const batteryFactor = session.efficientBatteryCharges > 0 ? 0.8 : 1;
  const contractFactor = session.emergencyContractCharges > 0 ? 0.5 : 1;
  const temporaryCooldown = session.activeTemporaryDecisions.includes("emergency_deployment") ? 0.6 : 1;
  const fortuneFree = session.fortuneFreeDeploymentCharges > 0;
  return {
    price: fortuneFree ? 0 : Math.ceil(config.price * session.modifiers.energyCost * batteryFactor * contractFactor),
    supply: config.supply + (!fortuneFree && session.emergencyContractCharges > 0 ? 1 : 0),
    deployCooldownMs: Math.round(config.deployCooldownMs * session.modifiers.deployCooldown * temporaryCooldown),
    refundRate: session.modifiers.refundRate,
  };
}

function effectiveCombatConfig(session, troop, config) {
  if (!config) return config;
  const rangePenaltyTiles = getTroopRangePenaltyTiles(session, troop, config);
  if (isNaniteMedic(config)) {
    return rangePenaltyTiles
      ? { ...config, range: Math.max(1, config.range - rangePenaltyTiles) }
      : config;
  }
  let range = config.range + (troop.type === "guarda" ? session.modifiers.guardRangeBonus : 0);
  let closeRange = config.closeRange;
  if (usesTargetingSystems(config)) range *= session.modifiers.targetingRange;
  if (config.attack === "mine" && Number.isFinite(closeRange)) closeRange *= session.modifiers.targetingRange;
  if (isOffensiveConfig(config)) {
    range *= session.modifiers.aggressiveRange;
    if (Number.isFinite(closeRange)) closeRange *= session.modifiers.aggressiveRange;
  }
  if (session.modifiers.precisionDoctrine && ["sniper", "ranger", "artilheiraMorteiro"].includes(troop.type)) {
    range *= 1.1;
  }
  if (rangePenaltyTiles) range = Math.max(1, range - rangePenaltyTiles);
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
    waveStartedAt: 0,
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
    prismaticMantle: { rows: Object.fromEntries(Array.from({ length: FIELD.rows }, (_, row) => [row, { nextPulseAt: Infinity, lastPulseAt: -Infinity }])) },
    sandstorm: {
      state: "idle",
      warningStartedAt: -Infinity,
      startsAt: Infinity,
      endsAt: Infinity,
      recoveryStartedAt: Infinity,
      recoveryEndsAt: Infinity,
      nextCheckAt: Infinity,
      stormsThisWave: 0,
      troopCountAtStart: 0,
      troopCountAtEnd: 0,
      troopLossCount: 0,
      troopLossRatio: 0,
      repeatLossToleranceRatio: 0,
      repeatEligible: true,
      buriedTroopIds: [],
      slowedTroopIds: [],
    },
    windCurrent: createWindCurrentState(),
    deployCooldowns: {},
    modifiers: { ...DEFAULT_MODIFIERS },
    shieldCharges: 0,
    reactiveBarrierRows: [],
    fortifiedRow: null,
    advancedFormationColumns: [],
    pendingPositionalDecision: null,
    pendingRouteFortificationEvent: null,
    efficientBatteryCharges: 0,
    earlyPreparationCharges: 0,
    emergencyContractCharges: 0,
    nextWaveSupply: 0,
    queuedTemporaryDecisions: [],
    activeTemporaryDecisions: [],
    overchargedReactorBoostWave: null,
    overchargedReactorInactiveWave: null,
    nextWaveEnergy: 0,
    nextWaveBaseDamageFactor: 1,
    currentWaveBaseDamageFactor: 1,
    nextWaveEnemyCountFactor: 1,
    adaptiveAid: createAdaptiveAidState(!sandbox),
    recentTroopLosses: [],
    assistanceTriggered: false,
    assistanceUsed: false,
    fortuneFreeDeploymentCharges: 0,
    decisions: [],
    killed: 0,
    deployed: {},
    outcome: null,
    pendingOutcome: null,
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
  if (capsuleReservesCell(session, row, col)) return "Célula ocupada pela Cápsula da Colônia.";
  const deploymentLimit = getTroopDeploymentLimit(troopId);
  if (!freePlacement && getActiveTroopCount(session, troopId) >= deploymentLimit) return `Limite de ${deploymentLimit} ${troop.label} no campo.`;
  if (!freePlacement && session.energy < effective.price) return `Energia insuficiente: requer ${effective.price}.`;
  if (!freePlacement && session.supply < effective.supply) return `Supply insuficiente: requer ${effective.supply}.`;
  if (!freePlacement && (session.waveActive || session.sandbox || troop.cooldownDuringPreparation) && Number(session.deployCooldowns[troopId] || 0) > session.elapsed) return "Implantação recarregando.";
  return null;
}

function calculateTroopBaseMaxHp(session, troopId) {
  const config = TROOPS[troopId];
  const frontline = session.modifiers.frontlineDoctrine
    && ["colono", "lumiUrsa7", "muralhaReforcada", "colossoImpacto"].includes(troopId) ? 1.2 : 1;
  return config.hp * (isOffensiveConfig(config) && !isNaniteMedic(config) ? session.modifiers.aggressiveHp : 1)
    * frontline;
}

export function createTroopEntity(session, troopId, row, col, options = {}) {
  const config = TROOPS[troopId];
  if (!config) return null;
  const x = col * CELL.width + CELL.width / 2;
  const y = row * CELL.height + CELL.height / 2;
  const baseMaxHp = Number(options.baseMaxHp) > 0 ? Number(options.baseMaxHp) : calculateTroopBaseMaxHp(session, troopId);
  const fortificationBonusMaxHp = session.fortifiedRow === row ? baseMaxHp * 0.2 : 0;
  const maxHp = baseMaxHp + fortificationBonusMaxHp;
  const hpRatio = Number.isFinite(options.hpRatio) ? clamp(options.hpRatio, 0, 1) : 1;
  return {
    id: options.id ?? id("troop"), type: troopId, row, col, x, y,
    hp: Number.isFinite(options.hp) ? clamp(options.hp, 0, maxHp) : maxHp * hpRatio,
    maxHp, baseMaxHp, fortificationBonusMaxHp,
    energyCost: Number(options.energyCost) || 0,
    supplyCost: Number.isFinite(options.supplyCost) ? Number(options.supplyCost) : config.supply,
    reactiveShield: 0, reactiveShieldUntil: 0, swarmHpApplied: false,
    attackReadyAt: session.elapsed, mineReadyAt: session.elapsed, gunReadyAt: session.elapsed,
    energyAccumulator: 0, lastAttackAt: -Infinity, attackStartedAt: -Infinity,
    channelingAttack: false, channelTickAccumulator: 0, lastAttackMode: null,
    pendingImpact: null, pendingComboImpact: null, pendingRepulsorShot: null,
    attackTargetId: null, specialRequested: false, attackBusyUntil: 0,
    comboStep: 0, comboTargetId: null, comboExpiresAt: null,
    specialReadyAt: config.specialEveryMs ? session.elapsed + config.specialEveryMs : Infinity,
    state: "idle", stateStartedAt: session.elapsed, stateEndsAt: Infinity,
    defenseActive: false, defenseThreatId: null, defenseExitAt: null,
    lastRepulsorAt: -Infinity, healTargetId: null, healedThisCharge: 0,
    lastHealPulseAt: -Infinity, cooldownStartedAt: null, cooldownEndsAt: null,
    attackSpeedFactor: 1, attachedParasiteId: null,
    webSlowUntil: 0, webSlowFactor: 1, webRangePenaltyUntil: 0, webRangePenaltyTiles: 0,
    sandBuriedStartedAt: 0, sandBuriedUntil: 0, sandAttackSpeedFactor: 1,
    windRecovery: false,
    firstImpactAvailable: session.modifiers.firstImpact,
    previousRenderX: x, previousRenderY: y, dead: false,
  };
}

export function placeTroop(session, troopId, row, col) {
  const reason = canPlaceTroop(session, troopId, row, col);
  if (reason) return { ok: false, reason };
  const config = TROOPS[troopId];
  const effective = getEffectiveTroopStats(session, troopId);
  const troop = createTroopEntity(session, troopId, row, col, {
    energyCost: effective.price,
    supplyCost: effective.supply,
  });
  session.troops.push(troop);
  const freePlacement = session.sandbox && session.sandboxSettings?.rulesMode === "free";
  const fortuneFree = !freePlacement && session.fortuneFreeDeploymentCharges > 0;
  if (!freePlacement) {
    session.energy -= effective.price;
    session.supply -= effective.supply;
    if (fortuneFree) session.fortuneFreeDeploymentCharges -= 1;
    else {
      if (session.efficientBatteryCharges > 0) session.efficientBatteryCharges -= 1;
      if (session.emergencyContractCharges > 0) session.emergencyContractCharges -= 1;
    }
  }
  session.deployed[troopId] = (session.deployed[troopId] || 0) + 1;
  const skipCooldown = !freePlacement && session.earlyPreparationCharges > 0;
  if (skipCooldown) session.earlyPreparationCharges -= 1;
  if (!freePlacement && !skipCooldown && (session.waveActive || session.sandbox || config.cooldownDuringPreparation)) session.deployCooldowns[troopId] = session.elapsed + effective.deployCooldownMs;
  refreshSwarmDoctrine(session);
  return { ok: true, troop, activeCount: getActiveTroopCount(session, troopId), maxDeployed: getTroopDeploymentLimit(troopId), event: { type: "deploy", x: troop.x, y: troop.y } };
}

export function removeTroop(session, row, col) {
  const index = session.troops.findIndex((troop) => !troop.dead && troop.row === row && troop.col === col);
  if (index < 0) return { ok: false, reason: "Nenhuma unidade nessa célula." };
  const [troop] = session.troops.splice(index, 1);
  recordTroopLoss(session, troop, "manualRemoval");
  releaseParasiteFromTroop(session, troop);
  const config = TROOPS[troop.type];
  session.mines = session.mines.filter((mine) => mine.ownerId !== troop.id);
  session.projectiles = session.projectiles.filter((projectile) =>
    projectile.sourceTroopId !== troop.id || !["mine", "repulsorFist"].includes(projectile.kind));
  const criticalRefund = session.modifiers.organizedRetreat && troop.hp / troop.maxHp < 0.3;
  const refund = Math.floor(Number(troop.energyCost ?? config.price) * (criticalRefund ? 1 : session.modifiers.refundRate));
  session.energy = Math.min(session.energyMax, session.energy + refund);
  session.supply = Math.min(session.supplyMax, session.supply + Number(troop.supplyCost ?? config.supply));
  refreshSwarmDoctrine(session);
  return { ok: true, refund, troop, event: { type: "remove", x: troop.x, y: troop.y, entity: { ...troop } } };
}

const SWARM_TROOPS = new Set(["colono", "marine", "caçador", "krio", "muralhaReforcada"]);

function rescaleTroopHp(troop, factor) {
  troop.maxHp *= factor;
  troop.hp *= factor;
  if (Number.isFinite(troop.baseMaxHp)) troop.baseMaxHp *= factor;
  if (Number.isFinite(troop.fortificationBonusMaxHp)) troop.fortificationBonusMaxHp *= factor;
}

export function applyRouteFortification(troop) {
  if (!troop || troop.dead || (troop.fortificationBonusMaxHp || 0) > 0) return false;
  const baseMaxHp = troop.maxHp;
  const ratio = baseMaxHp > 0 ? troop.hp / baseMaxHp : 1;
  const bonus = baseMaxHp * 0.2;
  troop.baseMaxHp = baseMaxHp;
  troop.fortificationBonusMaxHp = bonus;
  troop.maxHp = baseMaxHp + bonus;
  troop.hp = troop.maxHp * ratio;
  return true;
}

function refreshSwarmDoctrine(session) {
  if (!session.modifiers.humanSwarmDoctrine) return;
  for (let row = 0; row < FIELD.rows; row += 1) {
    const eligible = session.troops.filter((troop) => !troop.dead && troop.row === row && SWARM_TROOPS.has(troop.type));
    const active = eligible.length >= 3;
    eligible.forEach((troop) => {
      if (active && !troop.swarmHpApplied) {
        rescaleTroopHp(troop, 1.1);
        troop.swarmHpApplied = true;
      } else if (!active && troop.swarmHpApplied) {
        rescaleTroopHp(troop, 1 / 1.1);
        troop.swarmHpApplied = false;
      }
    });
  }
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

function normalizeAdvancedFormationColumns(target) {
  const columns = [...new Set((Array.isArray(target?.columns) ? target.columns : []).map(Number))].sort((a, b) => a - b);
  if (columns.length !== 3 || columns.some((col) => !Number.isInteger(col) || col < FIELD.firstTroopCol || col > FIELD.lastTroopCol)) return null;
  return columns[1] === columns[0] + 1 && columns[2] === columns[1] + 1 ? columns : null;
}

function applyDecision(session, decisionId, target = null) {
  const multiply = (field, factor) => { session.modifiers[field] *= factor; };
  switch (decisionId) {
    case "emergency_energy":
      session.energy = Math.min(session.energyMax, session.energy + 20);
      break;
    case "supply_expansion":
      session.supplyMax += 4;
      session.supply += 4;
      break;
    case "repair_core":
      session.integrity = Math.min(session.integrityMax, session.integrity + 25);
      break;
    case "emergency_shield":
      session.shieldCharges += 2;
      break;
    case "armor_piercing":
      multiply("troopDamage", 1.1);
      break;
    case "accelerated_training":
      multiply("attackSpeed", 1.1);
      rescaleReadyTimers(session, 1 / 1.1);
      break;
    case "first_impact":
      session.modifiers.firstImpact = true;
      session.troops.filter((troop) => !troop.dead).forEach((troop) => { troop.firstImpactAvailable = true; });
      break;
    case "targeting_systems":
      multiply("targetingRange", 1.1);
      break;
    case "aggressive_line":
      multiply("aggressiveDamage", 1.15);
      multiply("aggressiveRange", 1.15);
      multiply("aggressiveHp", 0.8);
      session.troops.filter((troop) => !troop.dead && isOffensiveConfig(TROOPS[troop.type]) && !isNaniteMedic(TROOPS[troop.type]))
        .forEach((troop) => rescaleTroopHp(troop, 0.8));
      break;
    case "focused_fire":
      session.modifiers.focusedFire = true;
      break;
    case "continuous_suppression":
      session.modifiers.continuousSuppression = true;
      break;
    case "advanced_formation": {
      const columns = normalizeAdvancedFormationColumns(target);
      if (!columns) return false;
      session.modifiers.advancedFormation = true;
      session.advancedFormationColumns = columns;
      session.pendingAdvancedFormationEvent = { columns: [...columns], troopIds: session.troops.filter((troop) => !troop.dead && columns.includes(troop.col)).map((troop) => troop.id) };
      break;
    }
    case "structural_armor":
      session.integrityMax += 15;
      session.integrity += 15;
      break;
    case "fast_deployment":
      multiply("deployCooldown", 0.85);
      Object.keys(session.deployCooldowns).forEach((troopId) => {
        const readyAt = session.deployCooldowns[troopId];
        if (readyAt > session.elapsed) session.deployCooldowns[troopId] = session.elapsed + (readyAt - session.elapsed) * 0.85;
      });
      break;
    case "strategic_reserve":
      session.nextWaveEnergy += 25;
      break;
    case "containment_protocol":
      session.nextWaveBaseDamageFactor *= 0.65;
      break;
    case "ballistic_specialization":
      multiply("ballisticDamage", 1.15);
      multiply("ballisticProjectileSpeed", 1.1);
      break;
    case "explosive_specialization":
      multiply("explosiveDamage", 1.15);
      multiply("explosiveRadius", 1.1);
      break;
    case "energy_specialization":
      multiply("rangerDamage", 1.15);
      multiply("guardDamage", 1.1);
      multiply("krioSlowDuration", 1.2);
      session.modifiers.guardRangeBonus += 0.5;
      break;
    case "efficient_batteries":
      session.efficientBatteryCharges += 3;
      break;
    case "recycling":
      session.modifiers.refundRate = 0.65;
      break;
    case "last_line":
      multiply("lastLineDamageTaken", 0.8);
      break;
    case "field_maintenance":
      session.troops.filter((troop) => !troop.dead)
        .forEach((troop) => { troop.hp += (troop.maxHp - troop.hp) * 0.35; });
      break;
    case "concussive_impact":
      session.modifiers.concussiveImpact = true;
      break;
    case "reactive_barrier":
      session.modifiers.reactiveBarrier = true;
      break;
    case "route_fortification": {
      const selectedRow = Number(target?.row);
      if (!Number.isInteger(selectedRow)
        || !session.troops.some((troop) => !troop.dead && troop.row === selectedRow)) return false;
      session.fortifiedRow = selectedRow;
      const affected = session.troops.filter((troop) => !troop.dead && troop.row === selectedRow);
      affected.forEach((troop) => applyRouteFortification(troop));
      session.pendingRouteFortificationEvent = {
        row: selectedRow,
        troopIds: affected.map((troop) => troop.id),
      };
      break;
    }
    case "organized_retreat":
      session.modifiers.organizedRetreat = true;
      break;
    case "early_preparation":
      session.earlyPreparationCharges += 1;
      break;
    case "emergency_contract":
      session.emergencyContractCharges += 1;
      break;
    case "overcharged_reactor":
      session.overchargedReactorBoostWave = session.waveIndex;
      session.overchargedReactorInactiveWave = session.waveIndex + 1;
      break;
    case "supply_reserve":
      session.supply = Math.min(session.supplyMax, session.supply + 4);
      session.nextWaveSupply += 4;
      break;
    case "early_assault":
      session.energy = Math.min(session.energyMax, session.energy + 30);
      break;
    case "total_mobilization":
      session.supplyMax += 5;
      session.supply += 5;
      session.nextWaveEnemyCountFactor *= 1.12;
      break;
    case "frontline_doctrine":
      session.modifiers.frontlineDoctrine = true;
      session.troops.filter((troop) => !troop.dead && ["colono", "lumiUrsa7", "muralhaReforcada", "colossoImpacto"].includes(troop.type))
        .forEach((troop) => rescaleTroopHp(troop, 1.2));
      break;
    case "support_doctrine":
      session.modifiers.supportDoctrine = true;
      break;
    case "precision_doctrine":
      session.modifiers.precisionDoctrine = true;
      break;
    case "human_swarm_doctrine":
      session.modifiers.humanSwarmDoctrine = true;
      refreshSwarmDoctrine(session);
      break;
    case "territorial_control":
      session.modifiers.territorialControl = true;
      break;
    case "final_overload":
    case "final_fortress":
    case "final_reserve":
    case "core_barrier":
    case "emergency_deployment":
      session.queuedTemporaryDecisions.push(decisionId);
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
  if (session.nextWaveSupply > 0) {
    session.supply = Math.min(session.supplyMax, session.supply + session.nextWaveSupply);
    session.nextWaveSupply = 0;
  }
  session.activeTemporaryDecisions = [...session.queuedTemporaryDecisions];
  session.queuedTemporaryDecisions = [];
  if (session.activeTemporaryDecisions.includes("final_reserve")) {
    session.energy = Math.min(session.energyMax, session.energy + 30);
  }
  const enemyCountFactor = session.nextWaveEnemyCountFactor;
  session.nextWaveEnemyCountFactor = 1;
  session.currentWaveBaseDamageFactor = session.nextWaveBaseDamageFactor;
  if (session.activeTemporaryDecisions.includes("core_barrier")) session.currentWaveBaseDamageFactor *= 0.6;
  session.nextWaveBaseDamageFactor = 1;
  session.queue = buildSpawnQueue(session.phase, session.waveIndex, session.seed + session.waveIndex * 997, enemyCountFactor);
  session.waveActive = true;
  session.preparing = false;
  session.waveStartedAt = session.elapsed;
  session.nextSpawnAt = session.elapsed + (session.queue[0]?.spawnAtMs || 0);
  const hazard = session.phase.environmentHazard;
  session.sandstorm.state = "idle";
  session.sandstorm.stormsThisWave = 0;
  session.sandstorm.troopCountAtStart = 0;
  session.sandstorm.troopCountAtEnd = 0;
  session.sandstorm.troopLossCount = 0;
  session.sandstorm.troopLossRatio = 0;
  session.sandstorm.repeatLossToleranceRatio = hazard?.repeatLossToleranceRatio || 0;
  session.sandstorm.repeatEligible = true;
  session.sandstorm.buriedTroopIds = [];
  session.sandstorm.slowedTroopIds = [];
  session.sandstorm.nextCheckAt = hazard?.id === "sandstorm"
    ? session.elapsed + hazard.firstCheckDelayMs
    : Infinity;
  resetWindCurrentForWave(session, hazard);
  session.troops.filter((troop) => !troop.dead && troop.type === "demolidora")
    .forEach((troop) => { troop.mineReadyAt = session.elapsed; });
  return true;
}

export function selectDecision(session, option, target = null) {
  if (!session.pendingDecision?.some((entry) => entry.id === option.id)) return false;
  if (option.id === "route_fortification") {
    const row = Number(target?.row);
    if (!Number.isInteger(row) || row < 0 || row >= FIELD.rows) return false;
    if (!session.troops.some((troop) => !troop.dead && troop.row === row)) return false;
    target = { row };
  }
  if (option.id === "advanced_formation") {
    const columns = normalizeAdvancedFormationColumns(target);
    if (!columns) return false;
    target = { centerCol: columns[1], columns };
  }
  if (!applyDecision(session, option.id, target)) return false;
  session.decisions.push({ wave: session.waveIndex, level: session.pendingDecisionLevel, id: option.id, ...(target ? { target: { ...target, columns: target.columns ? [...target.columns] : undefined } } : {}) });
  session.pendingDecision = null;
  session.pendingDecisionLevel = null;
  if (option.id === "early_assault") startWave(session);
  return true;
}

function createEnemy(session, queued) {
  const base = ENEMIES[queued.type];
  if (!base) return null;
  const alpha = queued.variant === "alpha" && base.allowAlphaVariant !== false;
  const echo = Boolean(queued.isEcho);
  const mechanic = session.phase.chapterMechanic;
  const echoHpFactor = echo ? mechanic?.hpFactor ?? 0.45 : 1;
  const echoSpeedFactor = echo ? mechanic?.speedFactor ?? 1.2 : 1;
  const echoDamageFactor = echo ? mechanic?.damageFactor ?? 0.6 : 1;
  const maxHp = base.hp * (alpha ? 8 : 1) * echoHpFactor * (session.sandboxSettings?.enemyHpMultiplier ?? 1);
  const firstLivingCrisalio = queued.type === "crisalio"
    && !session.enemies.some((entry) => !entry.dead && entry.type === "crisalio");
  const enemy = {
    id: id("enemy"), type: queued.type, variant: alpha ? "alpha" : undefined, isEcho: echo,
    echoSourceId: queued.echoSourceId || null,
    row: Number.isInteger(queued.row) ? clamp(queued.row, 0, FIELD.rows - 1) : Math.floor(session.rng() * FIELD.rows),
    x: Number.isFinite(queued.x)
      ? queued.x
      : FIELD.spawnX + (queued.xOffsetTiles || 0) * CELL.width + (queued.formationOffsetPx || 0),
    y: 0,
    spawnedAt: session.elapsed,
    packetId: queued.packetId || null,
    spawnBlock: queued.block || null,
    hp: maxHp, maxHp,
    speed: base.speed * (alpha ? 0.75 : 1) * echoSpeedFactor,
    damage: base.damage * (alpha ? 2 : 1) * echoDamageFactor,
    attackReadyAt: 0, lastAttackAt: -Infinity,
    casting: false, castStartedAt: -Infinity, castReadyAt: Infinity, moving: true,
    jumpConsumed: false, jumping: false, jumpStartedAt: -Infinity, jumpProgress: 0,
    jumpFromX: null, jumpTargetTroopId: null, attachedToTroopId: null,
    slowUntil: 0, slowFactor: 1, stunnedUntil: 0,
    emergeState: null, emergeStartedAt: -Infinity, emergeEndsAt: -Infinity,
    bossPhase: isScarabEmperor(base) ? 1 : 0,
    shield: 0, shieldMax: 0, lastShieldPulseAt: -Infinity,
    meleeAttackPending: false, meleeAttackStartedAt: -Infinity,
    meleeImpactAt: Infinity, meleeTargetId: null,
    ramState: queued.type === "ramBeetle" ? "walking" : null,
    ramStateStartedAt: queued.type === "ramBeetle" ? session.elapsed : -Infinity,
    ramStateEndsAt: Infinity, ramIdleMode: null, ramChargeConsumed: false,
    ramChargeTargetId: null, ramChargeEndX: null,
    ramAttackPending: false, ramAttackImpactAt: Infinity, ramAttackTargetId: null,
    duneState: queued.type === "duneRipper" ? "walking" : null,
    duneStateStartedAt: queued.type === "duneRipper" ? session.elapsed : -Infinity,
    duneStateEndsAt: Infinity,
    duneAttackApplied: false, duneAttackImpactAt: Infinity, duneAttackTargetId: null,
    duneRoarSummoned: false,
    duneNextSummonAt: queued.type === "duneRipper"
      ? session.elapsed + base.firstSummonDelayMs
      : Infinity,
    scarabState: queued.type === "scarabEmperor" ? "phase1Walking" : null,
    scarabStateStartedAt: queued.type === "scarabEmperor" ? session.elapsed : -Infinity,
    scarabStateEndsAt: Infinity,
    scarabPhase2Triggered: false, scarabPhase3Triggered: false,
    scarabTransitionToPhase: null,
    scarabAttackApplied: false, scarabAttackTargetId: null,
    queenState: queued.type === "workerQueen" ? "spawn" : null,
    queenStateStartedAt: queued.type === "workerQueen" ? session.elapsed : -Infinity,
    queenStateEndsAt: queued.type === "workerQueen" ? session.elapsed + base.spawnDurationMs : Infinity,
    queenActionApplied: false,
    queenTargetId: null,
    queenEggsDeposited: false,
    queenNextEggLayAt: queued.type === "workerQueen"
      ? session.elapsed + base.firstEggLayDelayMs
      : Infinity,
    queenWebReadyAt: queued.type === "workerQueen" ? session.elapsed : Infinity,
    queenGuardReadyAt: queued.type === "workerQueen"
      ? session.elapsed + base.spawnDurationMs
      : Infinity,
    queenGuardOwnerId: queued.queenGuardOwnerId || null,
    eggOwnerId: queued.eggOwnerId || null,
    eggCreatedAt: queued.type === "workerQueenEgg" ? session.elapsed : null,
    eggHatchAt: queued.type === "workerQueenEgg" ? session.elapsed + base.hatchAfterMs : Infinity,
    summoned: Boolean(queued.summoned),
    summonerId: queued.summonerId || null,
    baseDamage: (alpha ? 40 : base.baseDamage) * echoDamageFactor,
    scale: base.scale * (alpha ? 1.45 : 1) * (echo ? 0.94 : 1),
    previousRenderX: FIELD.spawnX, previousRenderY: 0, dead: false,
  };
  if (base.stationary) enemy.moving = false;
  enemy.y = enemy.row * CELL.height + CELL.height / 2;
  enemy.previousRenderY = enemy.y;
  session.enemies.push(enemy);
  if (firstLivingCrisalio) session.prismaticMantle.rows[enemy.row].nextPulseAt = session.elapsed + base.shieldPulseEveryMs;
  return enemy;
}

export function trySpawnGlassEcho(session, source, events = []) {
  const mechanic = session.phase.chapterMechanic;
  if (mechanic?.id !== "glass_echoes" || source?.isEcho || source?.variant === "alpha"
    || ENEMIES[source?.type]?.canEcho === false) return null;
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

export function spawnEnemy(session, {
  type, row = 0, count = 1, variant, groupInTile = false,
} = {}) {
  if (!session.sandbox) return { ok: false, reason: "Spawn manual disponível apenas no Campo de Provas.", enemies: [], events: [] };
  if (!ENEMIES[type] || ENEMIES[type].hiddenFromCatalog) return { ok: false, reason: "Inimigo desconhecido.", enemies: [], events: [] };
  const amount = clamp(Math.floor(Number(count) || 1), 1, 50);
  const targetRow = clamp(Math.floor(Number(row) || 0), 0, FIELD.rows - 1);
  const enemies = [];
  const events = [];
  let groupOriginX = null;
  for (let index = 0; index < amount; index += 1) {
    const enemy = createEnemy(session, { type, row: targetRow, variant: variant === "alpha" ? "alpha" : undefined });
    if (groupOriginX == null) groupOriginX = enemy.x;
    enemy.x = groupInTile
      ? groupOriginX + (index - (amount - 1) / 2) * 4
      : enemy.x + index * 34;
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
    session.prismaticMantle = { rows: Object.fromEntries(Array.from({ length: FIELD.rows }, (_, row) => [row, { nextPulseAt: Infinity, lastPulseAt: -Infinity }])) };
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

export function forceExecutorCombo(session, step) {
  if (!session.sandbox) return { ok: false, reason: "Controle disponível apenas no Campo de Provas." };
  return forceExecutorComboStep(session, step, TROOPS.executorArco, enemyColumn);
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

function refreshTroopAttackSpeedFactor(session, troop) {
  const parasiteFactor = troop.attachedParasiteId
    ? ENEMIES.parasitaSaltador.attackSlowFactor
    : 1;
  const webFactor = session.elapsed < (troop.webSlowUntil || 0)
    ? troop.webSlowFactor || 1
    : 1;
  if (session.elapsed >= (troop.webSlowUntil || 0)) {
    troop.webSlowUntil = 0;
    troop.webSlowFactor = 1;
  }
  if (session.elapsed >= (troop.webRangePenaltyUntil || 0)) {
    troop.webRangePenaltyUntil = 0;
    troop.webRangePenaltyTiles = 0;
  }
  let sandFactor = 1;
  if (session.sandstorm?.slowedTroopIds.includes(troop.id)) {
    const hazard = session.phase.environmentHazard;
    if (session.sandstorm.state === "active") {
      sandFactor = troop.sandAttackSpeedFactor || hazard?.cadenceFactor || 1;
    } else if (session.sandstorm.state === "recovering") {
      const duration = Math.max(1, session.sandstorm.recoveryEndsAt - session.sandstorm.recoveryStartedAt);
      const progress = clamp((session.elapsed - session.sandstorm.recoveryStartedAt) / duration, 0, 1);
      sandFactor = (troop.sandAttackSpeedFactor || hazard?.cadenceFactor || 1)
        + (1 - (troop.sandAttackSpeedFactor || hazard?.cadenceFactor || 1)) * progress;
    }
  }
  setTroopAttackSpeedFactor(troop, Math.min(parasiteFactor, webFactor, sandFactor), session.elapsed);
}

function randomSelection(session, entries, count) {
  const available = [...entries];
  for (let index = available.length - 1; index > 0; index -= 1) {
    const target = Math.floor(session.rng() * (index + 1));
    [available[index], available[target]] = [available[target], available[index]];
  }
  return available.slice(0, count);
}

function clearSandstormEffects(session) {
  for (const troop of session.troops) {
    troop.sandBuriedStartedAt = 0;
    troop.sandBuriedUntil = 0;
    troop.sandAttackSpeedFactor = 1;
  }
  session.sandstorm.buriedTroopIds = [];
  session.sandstorm.slowedTroopIds = [];
  session.troops.forEach((troop) => refreshTroopAttackSpeedFactor(session, troop));
}

function endSandstorm(session, events, forced = false) {
  const storm = session.sandstorm;
  if (storm.state === "idle" && !storm.buriedTroopIds.length && !storm.slowedTroopIds.length) return;
  clearSandstormEffects(session);
  storm.state = "idle";
  storm.startsAt = Infinity;
  storm.endsAt = Infinity;
  storm.recoveryStartedAt = Infinity;
  storm.recoveryEndsAt = Infinity;
  if (forced) {
    storm.repeatEligible = false;
    storm.nextCheckAt = Infinity;
  }
  events?.push({
    type: "sandstormEnded",
    forced,
    stormNumber: storm.stormsThisWave,
    troopCountAtStart: storm.troopCountAtStart,
    troopCountAtEnd: storm.troopCountAtEnd,
    troopLossCount: storm.troopLossCount,
    troopLossRatio: storm.troopLossRatio,
    repeatLossToleranceRatio: storm.repeatLossToleranceRatio,
    repeatEligible: storm.repeatEligible,
    nextCheckAt: storm.nextCheckAt,
  });
}

function activateSandstorm(session, config, events) {
  const storm = session.sandstorm;
  const actionable = session.troops.filter((troop) => !troop.dead && TROOPS[troop.type]?.attack !== "none");
  const buriedCount = actionable.length
    ? Math.min(config.buriedMax, Math.max(config.buriedMin, Math.floor(actionable.length / 5)))
    : 0;
  const buried = randomSelection(session, actionable, buriedCount);
  const buriedIds = new Set(buried.map((troop) => troop.id));
  const ranged = actionable.filter((troop) => !buriedIds.has(troop.id) && usesTargetingSystems(TROOPS[troop.type]));
  const slowed = randomSelection(session, ranged, Math.ceil(ranged.length * config.cadenceAffectedRatio));

  storm.state = "active";
  storm.startsAt = session.elapsed;
  storm.endsAt = session.elapsed + config.durationMs;
  storm.stormsThisWave += 1;
  storm.troopCountAtStart = session.troops.filter((troop) => !troop.dead).length;
  storm.troopCountAtEnd = 0;
  storm.troopLossCount = 0;
  storm.troopLossRatio = 0;
  storm.repeatLossToleranceRatio = config.repeatLossToleranceRatio;
  for (const troop of buried) {
    troop.sandBuriedStartedAt = session.elapsed;
    troop.sandBuriedUntil = storm.endsAt;
    troop.defenseActive = false;
  }
  for (const troop of slowed) {
    troop.sandAttackSpeedFactor = config.cadenceFactor;
    refreshTroopAttackSpeedFactor(session, troop);
  }
  storm.buriedTroopIds = buried.map((troop) => troop.id);
  storm.slowedTroopIds = slowed.map((troop) => troop.id);
  events.push({
    type: "sandstormStarted",
    stormNumber: storm.stormsThisWave,
    troopCountAtStart: storm.troopCountAtStart,
    endsAt: storm.endsAt,
    buriedTroopIds: [...storm.buriedTroopIds],
    slowedTroopIds: [...storm.slowedTroopIds],
  });
}

function updateSandstorm(session, events) {
  const config = session.phase.environmentHazard;
  const storm = session.sandstorm;
  if (config?.id !== "sandstorm") return;
  if (!session.waveActive) {
    endSandstorm(session, events, true);
    return;
  }
  const liveTroopIds = new Set(session.troops.filter((troop) => !troop.dead).map((troop) => troop.id));
  storm.buriedTroopIds = storm.buriedTroopIds.filter((troopId) => {
    const troop = session.troops.find((entry) => entry.id === troopId);
    return liveTroopIds.has(troopId) && isSandBuried(session, troop);
  });
  storm.slowedTroopIds = storm.slowedTroopIds.filter((troopId) => liveTroopIds.has(troopId));
  if (storm.state === "warning" && session.elapsed >= storm.startsAt) {
    activateSandstorm(session, config, events);
    return;
  }
  if (storm.state === "active" && session.elapsed >= storm.endsAt) {
    storm.troopCountAtEnd = session.troops.filter((troop) => !troop.dead).length;
    storm.troopLossCount = Math.max(0, storm.troopCountAtStart - storm.troopCountAtEnd);
    storm.troopLossRatio = storm.troopCountAtStart > 0
      ? storm.troopLossCount / storm.troopCountAtStart
      : 0;
    const toleranceBasisPoints = Math.round(config.repeatLossToleranceRatio * 10000);
    storm.repeatEligible = storm.troopLossCount * 10000
      <= storm.troopCountAtStart * toleranceBasisPoints;
    storm.nextCheckAt = storm.repeatEligible
      ? storm.endsAt + config.checkEveryMs
      : Infinity;
    storm.state = "recovering";
    storm.recoveryStartedAt = session.elapsed;
    storm.recoveryEndsAt = session.elapsed + config.recoveryMs;
    storm.buriedTroopIds = [];
    session.troops.forEach((troop) => {
      troop.sandBuriedStartedAt = 0;
      troop.sandBuriedUntil = 0;
    });
    events.push({
      type: "sandstormRecovering",
      endsAt: storm.recoveryEndsAt,
      stormNumber: storm.stormsThisWave,
      troopCountAtStart: storm.troopCountAtStart,
      troopCountAtEnd: storm.troopCountAtEnd,
      troopLossCount: storm.troopLossCount,
      troopLossRatio: storm.troopLossRatio,
      repeatLossToleranceRatio: storm.repeatLossToleranceRatio,
      repeatEligible: storm.repeatEligible,
      nextCheckAt: storm.nextCheckAt,
    });
    return;
  }
  if (storm.state === "recovering") {
    session.troops.forEach((troop) => refreshTroopAttackSpeedFactor(session, troop));
    if (session.elapsed >= storm.recoveryEndsAt) endSandstorm(session, events);
    return;
  }
  if (storm.state !== "idle" || !storm.repeatEligible || session.elapsed < storm.nextCheckAt) return;
  storm.nextCheckAt += config.checkEveryMs;
  const activeTroops = session.troops.filter((troop) => !troop.dead);
  if (activeTroops.length < config.minTroops) return;
  const chance = Math.min(
    config.maxChance,
    config.baseChance + (activeTroops.length - config.minTroops) * config.chancePerExtraTroop,
  );
  if (session.rng() >= chance) return;
  storm.state = "warning";
  storm.warningStartedAt = session.elapsed;
  storm.startsAt = session.elapsed + config.warningMs;
  events.push({ type: "sandstormWarning", startsAt: storm.startsAt });
}

function applyWorkerQueenWebDebuff(session, troop, projectile) {
  const effectEndsAt = session.elapsed + projectile.webSlowDurationMs;
  troop.webSlowFactor = projectile.webSlowFactor;
  troop.webSlowUntil = effectEndsAt;
  troop.webRangePenaltyTiles = projectile.webRangePenaltyTiles;
  troop.webRangePenaltyUntil = effectEndsAt;
  refreshTroopAttackSpeedFactor(session, troop);
}

function attackIntervalFor(session, troop, config, interval) {
  const trainingSpeed = isOffensiveConfig(config) ? session.modifiers.attackSpeed : 1;
  const precisionSpeed = session.modifiers.precisionDoctrine
    && ["sniper", "ranger", "artilheiraMorteiro"].includes(troop.type) ? 0.95 : 1;
  return interval / ((troop.attackSpeedFactor || 1) * trainingSpeed * precisionSpeed);
}

function attackDamageMultiplier(session, troop, { explosive = false, target = null } = {}) {
  let multiplier = session.modifiers.troopDamage;
  if (session.activeTemporaryDecisions.includes("final_overload")) multiplier *= 1.2;
  if (isOffensiveConfig(TROOPS[troop.type])) multiplier *= session.modifiers.aggressiveDamage;
  if (["marine", "sniper", "caçador"].includes(troop.type)) multiplier *= session.modifiers.ballisticDamage;
  if (explosive) multiplier *= session.modifiers.explosiveDamage;
  if (troop.type === "ranger") multiplier *= session.modifiers.rangerDamage;
  if (troop.type === "guarda") multiplier *= session.modifiers.guardDamage;
  if (session.modifiers.frontlineDoctrine && ["melee", "tileMelee"].includes(TROOPS[troop.type]?.attack)) multiplier *= 1.1;
  if (session.modifiers.advancedFormation && session.advancedFormationColumns.includes(troop.col)) multiplier *= 1.15;
  if (troop.swarmHpApplied) multiplier *= 1.1;
  if (target && session.modifiers.focusedFire) {
    const closest = session.enemies.filter((enemy) => !enemy.dead).sort((left, right) => left.x - right.x)[0];
    if (closest?.id === target.id) multiplier *= 1.18;
  }
  if (target && session.modifiers.continuousSuppression) {
    if (troop.suppressionTargetId === target.id) {
      if ((troop.suppressionHits || 0) >= 3) multiplier *= 1.15;
      troop.suppressionHits = (troop.suppressionHits || 0) + 1;
    } else {
      troop.suppressionTargetId = target.id;
      troop.suppressionHits = 1;
    }
  }
  if (troop.firstImpactAvailable) {
    multiplier *= 1.75;
    troop.firstImpactAvailable = false;
  }
  return multiplier;
}

function applyConcussiveImpact(session, enemy) {
  if (!session.modifiers.concussiveImpact || enemy.dead || ENEMIES[enemy.type]?.controlImmune
    || ENEMIES[enemy.type]?.knockbackImmune || !isGroundTrapEligible(enemy)) return;
  if (session.elapsed < (enemy.concussiveReadyAt || 0)) return;
  interruptWorkerQueenEggLay(session, enemy);
  const resistanceFactor = enemy.variant === "alpha"
    ? CONCUSSIVE_IMPACT.alphaFactor
    : ENEMIES[enemy.type]?.knockbackFactor ?? 1;
  const distance = CONCUSSIVE_IMPACT.baseDistance * resistanceFactor
    * (session.modifiers.territorialControl ? 1.15 : 1);
  enemy.x = Math.min(FIELD.width + 40, enemy.x + distance);
  enemy.previousRenderX = enemy.x;
  enemy.concussiveReadyAt = session.elapsed + CONCUSSIVE_IMPACT.cooldownMs;
}

function detachParasite(session, enemy) {
  if (!enemy?.attachedToTroopId) return;
  const troop = session.troops.find((entry) => entry.id === enemy.attachedToTroopId);
  if (troop?.attachedParasiteId === enemy.id) {
    troop.attachedParasiteId = null;
    refreshTroopAttackSpeedFactor(session, troop);
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
  refreshTroopAttackSpeedFactor(session, troop);
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
  refreshTroopAttackSpeedFactor(session, troop);
  return true;
}

export function getEnemyDamageTakenFactor(enemy, context = {}) {
  const config = ENEMIES[enemy?.type];
  if (!enemy) return 1;
  let factor = 1;
  if (isScarabEmperor(config)) {
    const phase = config[`phase${enemy.bossPhase || 1}`] || config.phase1;
    factor *= phase.damageTakenFactor ?? 1;
    const frontal = context.direct === true
      && Number.isFinite(context.sourceX)
      && context.sourceX <= enemy.x;
    if ((enemy.bossPhase || 1) === 1 && frontal) factor *= phase.frontDamageFactor ?? 1;
  }
  if (config?.spawnProtectionMs > 0
    && Number.isFinite(enemy.spawnedAt)
    && (context.elapsed ?? enemy.spawnedAt) - enemy.spawnedAt < config.spawnProtectionMs) {
    factor *= config.spawnDamageTakenFactor ?? 1;
  }
  return factor;
}

function damageEnemy(session, enemy, amount, events, context = {}) {
  if (!enemy || enemy.dead) return;
  if (context.fortuneOrbital) {
    enemy.hp -= amount;
    const hitPoint = getEnemyHitPoint(enemy, ENEMIES[enemy.type]);
    events.push({ type: "hit", targetId: enemy.id, x: hitPoint.x, y: hitPoint.y, color: "#fbbf24", fortuneOrbital: true });
    if (enemy.hp <= 0) {
      enemy.hp = 0;
      enemy.dead = true;
      detachParasite(session, enemy);
      if (ENEMIES[enemy.type]?.countsAsKill !== false) session.killed += 1;
      const bossDeath = enemy.variant === "alpha" || ENEMIES[enemy.type]?.boss;
      events.push({ type: bossDeath ? "bossDeath" : "enemyDeath", x: enemy.x, y: enemy.y, entity: { ...enemy }, fortuneOrbital: true });
    }
    return;
  }
  const sourceConfig = TROOPS[context.sourceTroopType];
  if (enemy.isEcho && sourceConfig?.glassEchoShatter) {
    enemy.shield = 0;
    enemy.hp = 0;
    enemy.dead = true;
    detachParasite(session, enemy);
    if (ENEMIES[enemy.type]?.countsAsKill !== false) session.killed += 1;
    events.push({ type: "glassEchoShatter", targetId: enemy.id, sourceTroopType: context.sourceTroopType, x: enemy.x, y: enemy.y, entity: { ...enemy }, color: "#7fffd4", seed: nextEffectSeed(session) });
    trySpawnEnergyPickup(session, enemy, events);
    return;
  }
  const damageTakenFactor = getEnemyDamageTakenFactor(enemy, { ...context, elapsed: session.elapsed });
  let incoming = amount * (session.sandboxSettings?.troopDamageMultiplier ?? 1) * damageTakenFactor;
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
    events.push({
      type: "hit", targetId: enemy.id, x: hitPoint.x, y: hitPoint.y,
      color: ENEMIES[enemy.type].color, damageTakenFactor,
    });
  }
  if (enemy.hp <= 0) {
    enemy.hp = 0;
    enemy.dead = true;
    detachParasite(session, enemy);
    if (ENEMIES[enemy.type]?.countsAsKill !== false) session.killed += 1;
    const bossDeath = enemy.variant === "alpha" || ENEMIES[enemy.type]?.boss;
    events.push({ type: bossDeath ? "bossDeath" : "enemyDeath", x: enemy.x, y: enemy.y, entity: { ...enemy } });
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

export function stunEnemy(session, enemy, durationMs) {
  if (!enemy || enemy.dead || durationMs <= 0 || ENEMIES[enemy.type]?.controlImmune) return;
  const previousUntil = Math.max(session.elapsed, Number(enemy.stunnedUntil) || 0);
  const nextUntil = Math.max(previousUntil, session.elapsed + durationMs);
  const pausedFor = nextUntil - previousUntil;
  enemy.stunnedUntil = nextUntil;
  if (enemy.type === "silicaDigger" && enemy.meleeAttackPending) {
    enemy.meleeAttackPending = false;
    enemy.meleeAttackStartedAt = -Infinity;
    enemy.meleeImpactAt = Infinity;
    enemy.meleeTargetId = null;
    enemy.lastAttackAt = -Infinity;
  }
  if (enemy.type === "duneRipper" && enemy.duneState === "roar") {
    if (!enemy.duneRoarSummoned) {
      enemy.duneNextSummonAt = session.elapsed + ENEMIES.duneRipper.interruptedSummonRetryMs;
    }
    enemy.duneState = "idle";
    enemy.duneStateStartedAt = session.elapsed;
    enemy.duneStateEndsAt = Infinity;
    enemy.duneRoarSummoned = false;
  }
  if (enemy.type === "workerQueen") interruptWorkerQueenEggLay(session, enemy);
  for (const field of [
    "attackReadyAt", "castReadyAt", "meleeImpactAt", "ramStateEndsAt", "ramAttackImpactAt",
    "duneStateEndsAt", "duneAttackImpactAt",
  ]) {
    if (Number.isFinite(enemy[field]) && enemy[field] >= session.elapsed) enemy[field] += pausedFor;
  }
  if (enemy.type === "ramBeetle" && Number.isFinite(enemy.ramStateStartedAt)) {
    enemy.ramStateStartedAt += pausedFor;
  }
  if (enemy.type === "duneRipper" && enemy.duneState === "attack"
    && Number.isFinite(enemy.duneStateStartedAt)) {
    enemy.duneStateStartedAt += pausedFor;
  }
  if (enemy.type === "scarabEmperor" && !enemy.scarabTransitionToPhase) {
    if (Number.isFinite(enemy.scarabStateStartedAt)) enemy.scarabStateStartedAt += pausedFor;
    if (Number.isFinite(enemy.scarabStateEndsAt) && enemy.scarabStateEndsAt >= session.elapsed) {
      enemy.scarabStateEndsAt += pausedFor;
    }
  }
  if (enemy.jumping && Number.isFinite(enemy.jumpStartedAt)) enemy.jumpStartedAt += pausedFor;
  enemy.moving = false;
}

function updatePrismaticMantle(session, events) {
  const config = ENEMIES.crisalio;
  const mantle = session.prismaticMantle;
  if (!mantle.rows) mantle.rows = Object.fromEntries(Array.from({ length: FIELD.rows }, (_, row) => [row, { nextPulseAt: Infinity, lastPulseAt: -Infinity }]));
  for (let row = 0; row < FIELD.rows; row += 1) {
    const state = mantle.rows[row];
    const sources = session.enemies.filter((enemy) => !enemy.dead && enemy.type === "crisalio" && enemy.row === row);
    if (!sources.length) {
      state.nextPulseAt = Infinity;
      continue;
    }
    if (!Number.isFinite(state.nextPulseAt)) state.nextPulseAt = session.elapsed + config.shieldPulseEveryMs;
    while (session.elapsed >= state.nextPulseAt) {
      const pulseAt = state.nextPulseAt;
      const source = sources[0];
      const targets = session.enemies.filter((enemy) => !enemy.dead && enemy.row === row && config.shieldTargetTypes.includes(enemy.type));
    for (const target of targets) {
      const value = Math.min(config.shieldCap, config.shieldBase + target.maxHp * config.shieldMaxHpFactor);
      target.shield = value;
      target.shieldMax = value;
      target.lastShieldPulseAt = pulseAt;
    }
    source.lastShieldPulseAt = session.elapsed;
    state.lastPulseAt = pulseAt;
    state.nextPulseAt += config.shieldPulseEveryMs;
    events.push({
      type: "prismaticPulse", sourceId: source.id, x: source.x, y: source.y - 34 * source.scale,
      targetIds: targets.map((target) => target.id), color: config.color, seed: nextEffectSeed(session),
      });
    }
  }
}

function damageTroop(session, troop, amount, events) {
  if (!troop || troop.dead) return;
  const config = TROOPS[troop.type];
  const defenseFactor = isLumiUrsa7(config) && troop.defenseActive ? config.defenseDamageFactor : 1;
  const lastLineFactor = troop.col <= 1 ? session.modifiers.lastLineDamageTaken : 1;
  const advancedFormationFactor = session.modifiers.advancedFormation
    && session.advancedFormationColumns.includes(troop.col) ? 1.1 : 1;
  const finalFortressFactor = session.activeTemporaryDecisions.includes("final_fortress") ? 0.75 : 1;
  let incoming = amount * defenseFactor * lastLineFactor * advancedFormationFactor * finalFortressFactor
    * (session.sandboxSettings?.enemyDamageMultiplier ?? 1);
  if (troop.reactiveShield > 0 && session.elapsed < troop.reactiveShieldUntil) {
    const absorbed = Math.min(troop.reactiveShield, incoming);
    troop.reactiveShield -= absorbed;
    incoming -= absorbed;
  }
  troop.hp -= incoming;
  if (session.modifiers.reactiveBarrier && troop.hp > 0 && troop.hp / troop.maxHp < 0.3
    && !session.reactiveBarrierRows.includes(troop.row)) {
    session.reactiveBarrierRows.push(troop.row);
    troop.reactiveShield = troop.maxHp * 0.25;
    troop.reactiveShieldUntil = session.elapsed + 6000;
    events.push({ type: "shieldHit", targetId: troop.id, x: troop.x, y: troop.y, reactive: true });
  }
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
    recordTroopLoss(session, troop, session.sandbox ? "sandbox" : "enemy");
    releaseParasiteFromTroop(session, troop);
    refreshSwarmDoctrine(session);
    events.push({ type: "troopDeath", x: troop.x, y: troop.y, entity: { ...troop } });
  }
}

function updateFlameChannel(session, troop, config, events, dt) {
  const getTargets = () => session.enemies
    .filter((enemy) => !enemy.dead
      && enemy.row === troop.row
      && enemy.x >= troop.x
      && enemy.x - troop.x <= config.range * CELL.width)
    .sort((left, right) => left.x - right.x)
    .slice(0, config.flameMaxTargets ?? 4);
  const targets = getTargets();

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
    const activeTargets = getTargets();
    if (!activeTargets.length) break;
    const frameCount = config.attackVisual?.frameMuzzles?.length || 1;
    const animation = getTroopAnimation(troop, config, session.elapsed, { attack: frameCount });
    const origin = getMuzzleWorldPosition(troop, config, 0, animation.frame);
    activeTargets.forEach((enemy) => {
      const damage = config.damage * attackDamageMultiplier(session, troop, { target: enemy });
      damageEnemy(session, enemy, damage, events, { direct: true, sourceX: troop.x, sourceTroopType: troop.type });
    });
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
    target,
  });
  const origin = getMuzzleWorldPosition(troop, config, 0);
  const targetPoint = getEnemyHitPoint(target, ENEMIES[target.type]);
  const effectSeed = nextEffectSeed(session);
  if (config.attack === "melee") {
    damageEnemy(session, target, damage, events, { direct: true, sourceX: troop.x, sourceTroopType: troop.type });
    events.push({ type: "melee", x: target.x, y: target.y });
  } else if (config.attack === "laser") {
    damageEnemy(session, target, damage, events, { direct: true, sourceX: troop.x });
    events.push({
      type: "beam", weapon: config.attackVisual?.effect || "laser", troopType: troop.type,
      sourceTroopId: troop.id, row: troop.row,
      x0: origin.x, y0: origin.y, x1: targetPoint.x, y1: origin.y,
      color: config.color, seed: effectSeed,
    });
  } else if (config.attack === "shotgun") {
    const maxTargets = config.shotgunMaxTargets ?? 3;
    const damageFactors = config.shotgunDamageFactors ?? [0.48, 0.40, 0.32];
    const targets = session.enemies
      .filter((enemy) => !enemy.dead && enemy.row === troop.row && enemy.x >= troop.x && enemy.x - troop.x <= config.range * CELL.width)
      .sort((left, right) => left.x - right.x)
      .slice(0, maxTargets);
    targets.forEach((enemy, index) => damageEnemy(
      session,
      enemy,
      damage * config.pellets * (damageFactors[index] ?? 0),
      events,
        { direct: true, sourceX: troop.x, sourceTroopType: troop.type },
    ));
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
      const ballisticSpeed = ["marine", "sniper", "caçador"].includes(troop.type)
        ? session.modifiers.ballisticProjectileSpeed : 1;
      const speed = (config.projectileSpeed || (config.attack === "missile" ? 210 : 390)) * ballisticSpeed;
      const straightLane = troop.type === "marine" || troop.type === "sniper" || troop.type === "krio" || troop.type === "guarda";
      session.projectiles.push({
        id: id("projectile"), kind: config.attack, troopType: troop.type,
        sourceTroopId: troop.id, shotIndex: shot, row: troop.row, straightLane,
        x: shotOrigin.x, y: shotOrigin.y, previousX: shotOrigin.x, previousY: shotOrigin.y,
        origin: { ...shotOrigin }, ageMs: 0, trail: [{ x: shotOrigin.x, y: shotOrigin.y }],
        vx: straightLane ? speed : dx / distance * speed,
        vy: straightLane ? 0 : dy / distance * speed,
        damage, targetId: target.id, radius: (config.radius || 0) * session.modifiers.explosiveRadius,
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
    damage: config.damage * attackDamageMultiplier(session, troop, { explosive: true, target: group.target }),
    collateralMultiplier: config.collateralMultiplier,
    radiusFactor: session.modifiers.explosiveRadius,
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
  return !troopOccupied && !enemyOccupied && !mineOccupied && !reserved && !capsuleReservesCell(session, row, col);
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
    damage: config.damage * attackDamageMultiplier(session, troop, { explosive: true }),
    radius: config.radius * session.modifiers.explosiveRadius * (session.modifiers.territorialControl ? 1.15 : 1),
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
    vx: 390, vy: 0, damage: config.closeDamage * attackDamageMultiplier(session, troop, { target }), targetId: target.id, radius: 0,
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

function enemiesInTileMeleeRange(session, troop, config) {
  const rearOverlap = CELL.width / 2;
  const forwardRange = Math.max(0, Number(config.range) || 0) * CELL.width;
  return session.enemies.filter((enemy) => !enemy.dead
    && enemy.row === troop.row
    && enemy.x >= troop.x - rearOverlap
    && enemy.x <= troop.x + forwardRange);
}

export function selectNaniteHealTarget(session, medic, config = TROOPS.medicaNanites) {
  const healStartThreshold = config.healStartThreshold ?? 1;
  return session.troops
    .filter((troop) => troop.id !== medic.id
      && !troop.dead
      && !troop.windRecovery
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
    const lockedTarget = session.troops.find((troop) =>
      troop.id === medic.healTargetId && !troop.dead && !troop.windRecovery && troop.hp > 0);
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
    const target = session.troops.find((troop) =>
      troop.id === medic.healTargetId && !troop.dead && !troop.windRecovery && troop.hp > 0);
    if (!target) {
      startNaniteCooldown(session, medic, config);
      return;
    }
    setNaniteMedicState(medic, "healing", session.elapsed);
    while (session.elapsed - medic.lastHealPulseAt >= config.healPulseEveryMs) {
      const missingHp = target.maxHp - target.hp;
      const healFactor = session.modifiers.supportDoctrine ? 1.15 : 1;
      const remainingEnergy = config.maxHealingPerCharge * healFactor - medic.healedThisCharge;
      const amount = Math.min(config.healPulseAmount * healFactor, missingHp, remainingEnergy);
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
  if (ENEMIES[enemy.type]?.knockbackImmune) return 0;
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
    vx: config.projectileSpeed, vy: 0, damage: config.damage * attackDamageMultiplier(session, troop, { target }),
    pushDistanceTiles: config.pushDistanceTiles * (session.modifiers.territorialControl ? 1.15 : 1),
    stunChance: config.stunChance, stunMs: config.stunMs
      * (session.modifiers.supportDoctrine ? 1.1 : 1)
      * (session.modifiers.territorialControl ? 1.15 : 1),
    pushSlowFactor: config.pushSlowFactor, pushSlowMs: config.pushSlowMs,
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
  const target = enemiesInTileMeleeRange(session, troop, config).sort((left, right) => left.x - right.x)[0] || null;
  troop.lastAttackMode = mode;
  troop.lastAttackAt = session.elapsed;
  troop.attackBusyUntil = session.elapsed + (visual?.durationMs || 0);
  troop.pendingImpact = {
    mode,
    impactAt: session.elapsed + (visual?.impactMs || 0),
    damage: (mode === "special" ? config.specialDamage : config.damage) * attackDamageMultiplier(session, troop, { target }),
    stunMs: mode === "special" ? config.specialStunMs
      * (session.modifiers.supportDoctrine ? 1.1 : 1)
      * (session.modifiers.territorialControl ? 1.15 : 1) : 0,
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
    const occupants = enemiesInTileMeleeRange(session, troop, config);
    occupants.forEach((enemy) => {
      damageEnemy(session, enemy, impact.damage, events, { direct: true, sourceX: troop.x, sourceTroopType: troop.type });
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
  if (session.elapsed < troop.attackReadyAt || !enemiesInTileMeleeRange(session, troop, config).length) return;
  startTileMeleeAttack(session, troop, config, "normal");
}

function launchExecutorArcSlash(session, troop, config, target, visual) {
  const origin = getMuzzleWorldPosition(troop, config, 0);
  session.projectiles.push({
    id: id("projectile"), kind: "executorArcSlash", visualKind: "executorArcSlash",
    troopType: troop.type, sourceTroopId: troop.id, targetId: target.id, row: troop.row,
    x: origin.x, y: origin.y, previousX: origin.x, previousY: origin.y,
    origin: { ...origin }, targetX: target.x, ageMs: 0,
    trail: [{ x: origin.x, y: origin.y }],
    vx: config.rangedProjectileSpeed, vy: 0, visualArcHeight: 18,
    damage: config.rangedDamage * attackDamageMultiplier(session, troop, { target }),
    color: config.color, active: true, launched: false, phase: "flying",
    seed: nextEffectSeed(session), launchAt: session.elapsed + visual.releaseMs,
  });
}

function updateTroops(session, events, dt) {
  for (const troop of session.troops) {
    if (troop.dead || troop.windRecovery) continue;
    refreshTroopAttackSpeedFactor(session, troop);
    if (isSandBuried(session, troop)) {
      troop.defenseActive = false;
      continue;
    }
    const baseConfig = TROOPS[troop.type];
    const config = effectiveCombatConfig(session, troop, baseConfig);
    if (config.attack === "energy") {
      const reactorInactive = session.waveIndex === session.overchargedReactorInactiveWave
        && session.elapsed - session.waveStartedAt < 5000;
      if (reactorInactive) continue;
      const supportSpeed = session.modifiers.supportDoctrine ? 1.1 : 1;
      troop.energyAccumulator = Math.min(config.attackEveryMs,
        troop.energyAccumulator + dt * (troop.attackSpeedFactor || 1) * supportSpeed);
      if (troop.energyAccumulator < config.attackEveryMs || session.energy >= session.energyMax) continue;
      const overchargeFactor = session.waveIndex === session.overchargedReactorBoostWave ? 1.5 : 1;
      const amount = Math.min(config.energyPerPulse * overchargeFactor, session.energyMax - session.energy);
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
    if (isExecutorArco(config)) {
      updateExecutorArco(session, troop, config, events, {
        color: config.color,
        enemyColumn,
        damageEnemy: (target, amount) => damageEnemy(session, target, amount, events, { direct: true, sourceX: troop.x, sourceTroopType: troop.type }),
        damageMultiplier: (target) => attackDamageMultiplier(session, troop, { target }),
        nextEffectSeed: () => nextEffectSeed(session),
        recoveryFor: (milliseconds) => attackIntervalFor(session, troop, config, milliseconds),
        launchRangedSlash: (source, target, visual) =>
          launchExecutorArcSlash(session, source, config, target, visual),
      });
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
    if (projectile.kind === "executorArcSlash") {
      if (projectile.phase === "impact") {
        projectile.phaseAgeMs += dt;
        if (session.elapsed >= projectile.impactStartedAt + 360) projectile.active = false;
        continue;
      }
      const target = session.enemies.find((enemy) =>
        enemy.id === projectile.targetId && !enemy.dead && enemy.hp > 0);
      if (!target) {
        projectile.active = false;
        continue;
      }
      const targetPoint = getEnemyHitPoint(target, ENEMIES[target.type]);
      projectile.previousX = projectile.x;
      projectile.previousY = projectile.y;
      projectile.previousRenderX = projectile.x;
      projectile.previousRenderY = projectile.y;
      projectile.x += projectile.vx * dt / 1000;
      const flightDistance = Math.max(1, projectile.targetX - projectile.origin.x);
      const progress = Math.max(0, Math.min(1,
        (projectile.x - projectile.origin.x) / flightDistance));
      projectile.y = projectile.origin.y
        + (targetPoint.y - projectile.origin.y) * progress
        - projectile.visualArcHeight * 4 * progress * (1 - progress);
      projectile.trail.push({ x: projectile.x, y: projectile.y });
      if (projectile.trail.length > 8) projectile.trail.shift();
      const crossedTarget = projectile.previousX <= targetPoint.x + 20
        && projectile.x >= targetPoint.x - 20;
      if (!crossedTarget) {
        if (projectile.x <= FIELD.width + 80) continue;
        projectile.active = false;
        continue;
      }
      damageEnemy(session, target, projectile.damage, events, {
        direct: true,
        sourceX: projectile.origin.x,
        sourceTroopType: projectile.troopType,
      });
      projectile.phase = "impact";
      projectile.impactStartedAt = session.elapsed;
      projectile.phaseAgeMs = 0;
      projectile.x = targetPoint.x;
      projectile.y = targetPoint.y;
      projectile.previousX = projectile.x;
      projectile.previousY = projectile.y;
      events.push({
        type: "executorArcSlashImpact", weapon: projectile.visualKind,
        sourceTroopId: projectile.sourceTroopId, targetId: target.id,
        x: targetPoint.x, y: targetPoint.y,
        color: projectile.color, seed: projectile.seed,
      });
      continue;
    }
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

      damageEnemy(session, target, projectile.damage, events, { direct: true, sourceX: source?.x ?? projectile.origin?.x, sourceTroopType: projectile.troopType });
      const pushedFromX = target.x;
      let stunned = false;
      if (!target.dead) {
        const existingVisualOffset = getRepulsorKnockbackOffset(target, session.elapsed);
        const knockbackFactor = getLumiKnockbackFactor(target);
        if (!ENEMIES[target.type]?.controlImmune) {
          interruptWorkerQueenEggLay(session, target);
          target.x = Math.min(
            FIELD.spawnX,
            target.x + CELL.width * projectile.pushDistanceTiles * knockbackFactor,
          );
        }
        const pushedDistance = target.x - pushedFromX;
        target.previousX = target.x;
        target.previousRenderX = target.x;
        if (pushedDistance > 0) {
          target.knockbackVisualOffset = existingVisualOffset - pushedDistance;
          target.knockbackVisualStartedAt = session.elapsed;
          target.knockbackVisualEndsAt = session.elapsed + (projectile.pushVisualDurationMs ?? 300);
          const activeSlowFactor = session.elapsed < target.slowUntil ? target.slowFactor : 1;
          target.slowFactor = Math.min(activeSlowFactor, projectile.pushSlowFactor ?? 1);
          target.slowUntil = Math.max(target.slowUntil || 0, session.elapsed + (projectile.pushSlowMs || 0));
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
          && Math.abs(enemy.x - projectile.targetX) <= CELL.width * 0.5 * projectile.radiusFactor);
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
        damageEnemy(session, target, projectile.damage, events, { direct: true, sourceX: projectile.origin.x });
        events.push({
          type: projectile.kind === "ice" ? "iceImpact" : projectile.kind === "fireball" ? "fireImpact" : "projectileImpact",
          weapon: projectile.visualKind, x: targetPoint.x, y: targetPoint.y,
          color: projectile.color, seed: projectile.seed,
        });
      }
      if (projectile.kind === "ice" && !target.dead && !ENEMIES[target.type]?.controlImmune) {
        target.slowFactor = projectile.slowFactor;
        const controlFactor = (session.modifiers.supportDoctrine ? 1.1 : 1)
          * (session.modifiers.territorialControl ? 1.15 : 1);
        target.slowUntil = session.elapsed + projectile.slowMs * session.modifiers.slowDuration
          * session.modifiers.krioSlowDuration * controlFactor;
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

export function getSilicaDiggerSwarmSpeedFactor(session, enemy) {
  const config = ENEMIES[enemy?.type];
  if (!enemy || enemy.dead || enemy.type !== "silicaDigger") return 1;
  if (enemy.emergeState === "emerging") return 1;
  if (session.elapsed < (enemy.stunnedUntil || 0)) return 1;
  const tile = Math.floor(enemy.x / CELL.width);
  const grouped = session.enemies.filter((candidate) => (
    !candidate.dead
    && candidate.type === enemy.type
    && candidate.row === enemy.row
    && candidate.emergeState !== "emerging"
    && session.elapsed >= (candidate.stunnedUntil || 0)
    && Math.floor(candidate.x / CELL.width) === tile
  )).length;
  return grouped >= config.swarmMinCount ? config.swarmSpeedFactor : 1;
}

function moveEnemy(session, enemy, dt, events) {
  enemy.moving = true;
  const slow = session.elapsed < enemy.slowUntil ? enemy.slowFactor : 1;
  const swarmSpeed = getSilicaDiggerSwarmSpeedFactor(session, enemy);
  enemy.x -= enemy.speed * swarmSpeed * session.modifiers.enemySpeed
    * (session.sandboxSettings?.enemySpeedMultiplier ?? 1) * slow * dt / 1000;
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
  const shielded = !session.sandbox && session.shieldCharges > 0 && !ENEMIES[enemy.type]?.boss;
  if (shielded) session.shieldCharges -= 1;
  const breachDamage = shielded ? 0 : enemy.baseDamage * session.currentWaveBaseDamageFactor * (session.sandboxSettings?.enemyDamageMultiplier ?? 1);
  if (!session.sandboxSettings?.invulnerableBase) session.integrity = Math.max(0, session.integrity - breachDamage);
  if (shielded) events.push({ type: "shieldBlock", x: FIELD.baseX, y: enemy.y, remaining: session.shieldCharges });
  events.push({ type: "breach", damage: breachDamage, x: FIELD.baseX, y: enemy.y });
}

function setWorkerQueenState(session, enemy, state, durationMs = Infinity) {
  if (enemy.queenState === state && !Number.isFinite(durationMs)
    && !Number.isFinite(enemy.queenStateEndsAt)) {
    enemy.moving = state === "walking";
    return;
  }
  enemy.queenState = state;
  enemy.queenStateStartedAt = session.elapsed;
  enemy.queenStateEndsAt = Number.isFinite(durationMs) ? session.elapsed + durationMs : Infinity;
  enemy.queenActionApplied = false;
  enemy.queenTargetId = null;
  enemy.moving = state === "walking";
}

function interruptWorkerQueenEggLay(session, enemy) {
  if (enemy?.type !== "workerQueen" || enemy.queenState !== "eggLay") return false;
  if (!enemy.queenEggsDeposited) {
    enemy.queenNextEggLayAt = session.elapsed + ENEMIES.workerQueen.interruptedEggLayRetryMs;
  }
  enemy.queenEggsDeposited = false;
  setWorkerQueenState(session, enemy, "idle");
  return true;
}

function countWorkerQueenEggs(session, queen) {
  return session.enemies.filter((candidate) => (
    !candidate.dead
    && candidate.type === "workerQueenEgg"
    && candidate.eggOwnerId === queen.id
  )).length;
}

function countWorkerQueenSummons(session, queen) {
  return session.enemies.filter((candidate) => (
    !candidate.dead
    && candidate.type === "silicaDigger"
    && candidate.summonerId === queen.id
  )).length;
}

function workerQueenHasForwardDigger(session, queen) {
  return session.enemies.some((candidate) => (
    !candidate.dead
    && candidate.type === "silicaDigger"
    && candidate.row === queen.row
    && candidate.x < queen.x
  ));
}

function countWorkerQueenForwardTroops(session, queen) {
  return session.troops.filter((troop) => (
    !troop.dead && troop.row === queen.row && troop.x < queen.x
  )).length;
}

function countWorkerQueenGuards(session, queen) {
  return session.enemies.filter((candidate) => (
    !candidate.dead
    && candidate.type === "silicaDigger"
    && candidate.queenGuardOwnerId === queen.id
  )).length;
}

function workerQueenGuardTier(enemy, config) {
  const distanceTiles = Math.max(0, (enemy.x - FIELD.baseX) / CELL.width);
  const tier = config.guardDistanceTiers.find((entry) => distanceTiles >= entry.minDistanceTiles)
    || config.guardDistanceTiers.at(-1);
  return { distanceTiles, tier };
}

function maintainWorkerQueenGuard(session, enemy, config, events) {
  if (countWorkerQueenForwardTroops(session, enemy) < 3
    || session.elapsed < enemy.queenGuardReadyAt || workerQueenHasForwardDigger(session, enemy)) return;
  const livingGuards = countWorkerQueenGuards(session, enemy);
  const capacity = Math.max(0, config.guardMaximumLiving - livingGuards);
  if (!capacity) return;
  const { distanceTiles, tier } = workerQueenGuardTier(enemy, config);
  const amount = Math.min(tier.count, capacity);
  const maximumX = enemy.x - 12;
  if (maximumX <= FIELD.baseX + 4) return;
  const desiredCenterX = enemy.x - config.guardSpawnOffsetTiles * CELL.width;
  const desiredFirstX = desiredCenterX - (amount - 1) * config.guardSpawnSpacingPx / 2;
  const firstX = Math.max(FIELD.baseX + 4, desiredFirstX);
  const spacing = amount > 1
    ? Math.min(config.guardSpawnSpacingPx, Math.max(0, (maximumX - firstX) / (amount - 1)))
    : 0;
  const summons = [];
  for (let index = 0; index < amount; index += 1) {
    const summon = createEnemy(session, {
      type: "silicaDigger",
      row: enemy.row,
      x: Math.min(maximumX, firstX + index * spacing),
      summoned: true,
      queenGuardOwnerId: enemy.id,
    });
    if (!summon) continue;
    summon.emergeState = "emerging";
    summon.emergeStartedAt = session.elapsed;
    summon.emergeEndsAt = session.elapsed + ENEMIES.silicaDigger.emergeDurationMs;
    summon.moving = false;
    summon.attackReadyAt = summon.emergeEndsAt;
    summon.lastAttackAt = -Infinity;
    summon.previousRenderX = summon.x;
    summon.previousRenderY = summon.y;
    summons.push(summon);
  }
  if (!summons.length) return;
  enemy.queenGuardReadyAt = session.elapsed + config.guardSummonCooldownMs;
  events.push({
    type: "workerQueenGuardSummoned",
    sourceEnemyId: enemy.id,
    row: enemy.row,
    x: enemy.x,
    y: enemy.y,
    summonCount: summons.length,
    summonIds: summons.map((summon) => summon.id),
    summonXs: summons.map((summon) => summon.x),
    distanceTiles,
    tierMinDistanceTiles: tier.minDistanceTiles,
    color: config.color,
    seed: nextEffectSeed(session),
  });
}

function updateSilicaDiggerEmergence(session, enemy, config, events) {
  if (enemy.emergeState !== "emerging") return false;
  enemy.moving = false;
  if (session.elapsed < enemy.emergeEndsAt) return true;

  enemy.emergeState = null;
  enemy.emergeStartedAt = -Infinity;
  enemy.emergeEndsAt = -Infinity;
  enemy.attackReadyAt = Math.max(enemy.attackReadyAt, session.elapsed);
  enemy.moving = true;
  events.push({
    type: "silicaDiggerEmerged",
    enemyId: enemy.id,
    sourceEnemyId: enemy.queenGuardOwnerId,
    row: enemy.row,
    x: enemy.x,
    y: enemy.y,
    color: config.color,
    seed: nextEffectSeed(session),
  });
  return false;
}

function workerQueenEggPositions(enemy, config) {
  return Array.from({ length: config.eggsPerLay }, (_, index) => (
    enemy.x + (config.eggSpawnStartTiles + index * config.eggSpawnSpacingTiles) * CELL.width
  ));
}

function canWorkerQueenLayEggs(session, enemy, config) {
  const livingEggs = countWorkerQueenEggs(session, enemy);
  const livingSummons = countWorkerQueenSummons(session, enemy);
  const positions = workerQueenEggPositions(enemy, config);
  return livingEggs + config.eggsPerLay <= config.maximumLivingEggs
    && livingSummons + livingEggs + config.eggsPerLay <= config.maximumLivingSummons
    && positions.every((x) => x <= FIELD.spawnX);
}

function depositWorkerQueenEggs(session, enemy, config, events) {
  if (enemy.queenEggsDeposited) return;
  const eggs = workerQueenEggPositions(enemy, config).map((x) => createEnemy(session, {
    type: "workerQueenEgg",
    row: enemy.row,
    x,
    eggOwnerId: enemy.id,
  })).filter(Boolean);
  eggs.forEach((egg) => {
    egg.previousRenderX = egg.x;
    events.push({
      type: "workerQueenEggDeposited",
      sourceEnemyId: enemy.id,
      eggId: egg.id,
      x: egg.x,
      y: egg.y,
      color: ENEMIES.workerQueenEgg.color,
      seed: nextEffectSeed(session),
    });
  });
  enemy.queenEggsDeposited = true;
  enemy.queenActionApplied = true;
  enemy.queenNextEggLayAt = enemy.queenStateEndsAt + config.eggLayEveryMs;
}

function isWorkerQueenWebTarget(queen, troop) {
  return Boolean(
    troop
    && !troop.dead
    && troop.row === queen.row
    && troop.x <= queen.x
    && TROOPS[troop.type]
    && TROOPS[troop.type].attack !== "none"
  );
}

function workerQueenWebTargets(session, queen) {
  return session.troops.filter((troop) => isWorkerQueenWebTarget(queen, troop));
}

function hasWorkerQueenTriggerTarget(session, queen, config) {
  const triggerDistance = config.webTriggerRangeTiles * CELL.width;
  return workerQueenWebTargets(session, queen)
    .some((troop) => queen.x - troop.x <= triggerDistance);
}

function randomWorkerQueenWebTarget(session, queen) {
  const candidates = workerQueenWebTargets(session, queen);
  if (!candidates.length) return null;
  return candidates[Math.floor(session.rng() * candidates.length)];
}

function launchWorkerQueenWeb(session, enemy, target, config, events) {
  const origin = getEnemyMuzzleWorldPosition(enemy, {
    ...config,
    attackVisual: config.webAttackVisual,
  });
  const targetY = target.y - 18;
  const distance = Math.max(1, origin.x - target.x);
  const flightSeconds = Math.max(0.1, distance / config.webProjectileSpeed);
  const seed = nextEffectSeed(session);
  session.enemyProjectiles.push({
    id: id("enemy_projectile"),
    kind: "inhibitorWeb",
    visualKind: "inhibitorWeb",
    sourceEnemyId: enemy.id,
    targetTroopId: target.id,
    targetLocked: true,
    ignoreInterceptors: true,
    row: enemy.row,
    x: origin.x,
    y: origin.y,
    previousX: origin.x,
    previousY: origin.y,
    previousRenderX: origin.x,
    previousRenderY: origin.y,
    vx: -config.webProjectileSpeed,
    vy: (targetY - origin.y) / flightSeconds,
    damage: config.webDamage,
    webSlowFactor: config.webSlowFactor,
    webSlowDurationMs: config.webSlowDurationMs,
    webRangePenaltyTiles: config.webRangePenaltyTiles,
    color: "#f5e7c6",
    active: true,
    launched: true,
    trail: [{ x: origin.x, y: origin.y }],
    ageMs: 0,
    seed,
  });
  events.push({
    type: "shoot",
    weapon: "inhibitorWeb",
    faction: "enemy",
    sourceEnemyId: enemy.id,
    x: origin.x,
    y: origin.y,
    color: "#f5e7c6",
    seed,
  });
}

function beginWorkerQueenAction(session, enemy, state, durationMs, target = null) {
  setWorkerQueenState(session, enemy, state, durationMs);
  enemy.queenTargetId = target?.id || null;
}

function workerQueenSameTileTarget(session, enemy, config) {
  const target = closestTroopForEnemy(session, enemy);
  return target && enemy.x - target.x <= config.meleeAttackRangeTiles * CELL.width
    ? target
    : null;
}

function updateWorkerQueen(session, enemy, config, dt, events) {
  if (enemy.queenState === "spawn") {
    enemy.moving = false;
    if (session.elapsed < enemy.queenStateEndsAt) return;
    setWorkerQueenState(session, enemy, "walking");
  }

  maintainWorkerQueenGuard(session, enemy, config, events);

  if (enemy.queenState === "eggLay") {
    enemy.moving = false;
    const sameTileTarget = workerQueenSameTileTarget(session, enemy, config);
    if (sameTileTarget) {
      interruptWorkerQueenEggLay(session, enemy);
      beginWorkerQueenAction(session, enemy, "meleeAttack", config.meleeAttackVisual.durationMs, sameTileTarget);
      enemy.attackReadyAt = session.elapsed + config.meleeAttackEveryMs;
      return;
    }
    if (!enemy.queenEggsDeposited
      && session.elapsed >= enemy.queenStateStartedAt + config.eggLayVisual.depositMs) {
      depositWorkerQueenEggs(session, enemy, config, events);
    }
    if (session.elapsed < enemy.queenStateEndsAt) return;
    enemy.queenEggsDeposited = false;
    setWorkerQueenState(session, enemy, "idle");
  }

  if (enemy.queenState === "webAttack") {
    enemy.moving = false;
    if (!enemy.queenActionApplied
      && session.elapsed >= enemy.queenStateStartedAt + config.webAttackVisual.releaseMs) {
      const target = session.troops.find((troop) => (
        troop.id === enemy.queenTargetId
        && isWorkerQueenWebTarget(enemy, troop)
      ));
      if (target) launchWorkerQueenWeb(session, enemy, target, config, events);
      enemy.queenActionApplied = true;
      enemy.queenWebReadyAt = session.elapsed + config.webAttackEveryMs;
    }
    if (session.elapsed < enemy.queenStateEndsAt) return;
    setWorkerQueenState(session, enemy, "idle");
  }

  if (enemy.queenState === "meleeAttack") {
    enemy.moving = false;
    if (!enemy.queenActionApplied
      && session.elapsed >= enemy.queenStateStartedAt + config.meleeAttackVisual.impactMs) {
      const target = session.troops.find((troop) => (
        troop.id === enemy.queenTargetId
        && !troop.dead
        && troop.row === enemy.row
        && enemy.x - troop.x <= config.meleeAttackRangeTiles * CELL.width
      ));
      if (target) {
        damageTroop(session, target, config.meleeDamage, events);
        events.push({ type: "melee", x: target.x, y: target.y, sourceEnemyId: enemy.id });
      }
      enemy.queenActionApplied = true;
    }
    if (session.elapsed < enemy.queenStateEndsAt) return;
    setWorkerQueenState(session, enemy, "idle");
  }

  const sameTileTarget = workerQueenSameTileTarget(session, enemy, config);
  if (sameTileTarget) {
    enemy.moving = false;
    setWorkerQueenState(session, enemy, "idle");
    if (session.elapsed >= enemy.attackReadyAt) {
      beginWorkerQueenAction(session, enemy, "meleeAttack", config.meleeAttackVisual.durationMs, sameTileTarget);
      enemy.attackReadyAt = session.elapsed + config.meleeAttackEveryMs;
      enemy.lastAttackAt = session.elapsed;
    }
    return;
  }

  if (hasWorkerQueenTriggerTarget(session, enemy, config)) {
    enemy.moving = false;
    setWorkerQueenState(session, enemy, "idle");
    if (session.elapsed >= enemy.queenWebReadyAt) {
      const target = randomWorkerQueenWebTarget(session, enemy);
      if (target) {
        beginWorkerQueenAction(session, enemy, "webAttack", config.webAttackVisual.durationMs, target);
        events.push({
          type: "workerQueenWebTargeted",
          sourceEnemyId: enemy.id,
          targetTroopId: target.id,
        });
      }
    }
    return;
  }

  if (session.elapsed >= enemy.queenNextEggLayAt) {
    if (canWorkerQueenLayEggs(session, enemy, config)) {
      enemy.queenEggsDeposited = false;
      beginWorkerQueenAction(session, enemy, "eggLay", config.eggLayVisual.durationMs);
      return;
    }
    enemy.queenNextEggLayAt = session.elapsed + config.eggLayRetryMs;
  }

  setWorkerQueenState(session, enemy, "walking");
  moveEnemy(session, enemy, dt, events);
}

function updateWorkerQueenEgg(session, egg, config, events) {
  egg.moving = false;
  if (session.elapsed < egg.eggHatchAt) return;
  const summon = createEnemy(session, {
    type: "silicaDigger",
    row: egg.row,
    x: egg.x,
    summoned: true,
    summonerId: egg.eggOwnerId,
  });
  if (summon) {
    summon.previousRenderX = summon.x;
    summon.previousRenderY = summon.y;
  }
  egg.dead = true;
  events.push({
    type: "workerQueenEggHatched",
    eggId: egg.id,
    sourceEnemyId: egg.eggOwnerId,
    x: egg.x,
    y: egg.y,
    summon: summon ? { ...summon } : null,
    color: config.color,
    seed: nextEffectSeed(session),
  });
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

function setDuneState(session, enemy, state, durationMs = Infinity) {
  if (enemy.duneState === state && !Number.isFinite(durationMs)
    && !Number.isFinite(enemy.duneStateEndsAt)) {
    enemy.moving = state === "walking";
    return;
  }
  enemy.duneState = state;
  enemy.duneStateStartedAt = session.elapsed;
  enemy.duneStateEndsAt = Number.isFinite(durationMs) ? session.elapsed + durationMs : Infinity;
  enemy.moving = state === "walking";
}

function countLivingDiggerSummons(session, enemy) {
  return session.enemies.filter((candidate) => (
    !candidate.dead
    && candidate.type === "silicaDigger"
    && candidate.summonerId === enemy.id
  )).length;
}

function duneBlockingTarget(session, enemy, config) {
  const target = closestTroopForEnemy(session, enemy);
  const range = config.attackRangeTiles * CELL.width;
  return target && enemy.x - target.x <= range ? target : null;
}

function tryBeginDuneRoar(session, enemy, config) {
  if (session.elapsed < enemy.duneNextSummonAt) return false;
  const living = countLivingDiggerSummons(session, enemy);
  if (living >= config.maximumLivingSummons) {
    enemy.duneNextSummonAt = session.elapsed + config.summonRetryMs;
    return false;
  }
  setDuneState(session, enemy, "roar", config.roarDurationMs);
  enemy.duneRoarSummoned = false;
  return true;
}

function beginDuneAttack(session, enemy, target, config) {
  setDuneState(session, enemy, "attack", config.attackVisual.durationMs);
  enemy.duneAttackApplied = false;
  enemy.duneAttackImpactAt = session.elapsed + config.attackVisual.impactMs;
  enemy.duneAttackTargetId = target.id;
  enemy.attackReadyAt = session.elapsed + config.attackEveryMs;
  enemy.lastAttackAt = session.elapsed;
}

function summonDuneRipperBrood(session, enemy, config, events) {
  const living = countLivingDiggerSummons(session, enemy);
  const amount = Math.min(config.summonCount, config.maximumLivingSummons - living);
  if (amount <= 0) {
    enemy.duneNextSummonAt = session.elapsed + config.summonRetryMs;
    setDuneState(session, enemy, "idle");
    return;
  }
  const summons = [];
  for (let index = 0; index < amount; index += 1) {
    const summon = createEnemy(session, {
      type: "silicaDigger",
      row: enemy.row,
      x: FIELD.spawnX + index * 12,
      summoned: true,
      summonerId: enemy.id,
    });
    if (!summon) continue;
    summon.previousRenderX = summon.x;
    summons.push(summon);
  }
  enemy.duneRoarSummoned = true;
  enemy.duneNextSummonAt = enemy.duneStateEndsAt + config.summonEveryMs;
  events.push({
    type: "duneRipperRoar",
    enemyId: enemy.id,
    row: enemy.row,
    x: enemy.x,
    y: enemy.y,
    spawnX: Math.min(FIELD.width - 24, FIELD.spawnX),
    spawnY: enemy.row * CELL.height + CELL.height / 2,
    summonCount: summons.length,
    color: config.color,
    seed: nextEffectSeed(session),
  });
}

function updateDuneRipper(session, enemy, config, dt, events) {
  if (enemy.duneState === "roar") {
    enemy.moving = false;
    if (!enemy.duneRoarSummoned
      && session.elapsed >= enemy.duneStateStartedAt + config.roarSummonAtMs) {
      summonDuneRipperBrood(session, enemy, config, events);
    }
    if (enemy.duneState !== "roar" || session.elapsed < enemy.duneStateEndsAt) return;
    const blockingTarget = duneBlockingTarget(session, enemy, config);
    setDuneState(session, enemy, blockingTarget ? "idle" : "walking");
    return;
  }

  if (enemy.duneState === "attack") {
    enemy.moving = false;
    if (!enemy.duneAttackApplied && session.elapsed >= enemy.duneAttackImpactAt) {
      const target = session.troops.find((troop) => (
        troop.id === enemy.duneAttackTargetId
        && !troop.dead
        && troop.row === enemy.row
        && enemy.x - troop.x <= config.attackRangeTiles * CELL.width
      ));
      if (target) {
        damageTroop(session, target, enemy.damage, events);
        events.push({ type: "melee", x: target.x, y: target.y, sourceEnemyId: enemy.id });
      }
      enemy.duneAttackApplied = true;
      enemy.duneAttackImpactAt = Infinity;
      enemy.duneAttackTargetId = null;
    }
    if (session.elapsed < enemy.duneStateEndsAt) return;
    if (tryBeginDuneRoar(session, enemy, config)) return;
    const blockingTarget = duneBlockingTarget(session, enemy, config);
    setDuneState(session, enemy, blockingTarget ? "idle" : "walking");
    return;
  }

  const blockingTarget = duneBlockingTarget(session, enemy, config);
  if (tryBeginDuneRoar(session, enemy, config)) return;
  if (blockingTarget) {
    setDuneState(session, enemy, "idle");
    if (session.elapsed >= enemy.attackReadyAt) beginDuneAttack(session, enemy, blockingTarget, config);
    return;
  }
  setDuneState(session, enemy, "walking");
  moveEnemy(session, enemy, dt, events);
}

function setRamState(session, enemy, state, durationMs = Infinity, idleMode = null) {
  if (enemy.ramState === state && (state !== "idle" || enemy.ramIdleMode === idleMode)) {
    enemy.moving = state === "walking" || state === "charge";
    return;
  }
  enemy.ramState = state;
  enemy.ramStateStartedAt = session.elapsed;
  enemy.ramStateEndsAt = Number.isFinite(durationMs) ? session.elapsed + durationMs : Infinity;
  enemy.ramIdleMode = idleMode;
  enemy.moving = state === "walking" || state === "charge";
}

function enterRamRecovery(session, enemy, config) {
  enemy.ramChargeTargetId = null;
  enemy.ramChargeEndX = null;
  setRamState(session, enemy, "idle", config.recoverMs, "recover");
}

function beginRamNormalAttack(session, enemy, target, config) {
  setRamState(session, enemy, "attack", config.attackVisual.durationMs);
  enemy.ramAttackPending = true;
  enemy.ramAttackImpactAt = session.elapsed + config.attackVisual.impactMs;
  enemy.ramAttackTargetId = target.id;
  enemy.attackReadyAt = session.elapsed + config.attackEveryMs;
  enemy.lastAttackAt = session.elapsed;
}

function ramBlockingTarget(session, enemy) {
  const target = closestTroopForEnemy(session, enemy);
  return target && enemy.x - target.x <= troopBlockDistance(target) ? target : null;
}

function updateRamBeetle(session, enemy, config, dt, events) {
  if (enemy.ramState === "chargePrep") {
    const target = session.troops.find((troop) => (
      troop.id === enemy.ramChargeTargetId
      && !troop.dead
      && troop.row === enemy.row
      && troop.x <= enemy.x
    ));
    if (!target) {
      enemy.ramChargeTargetId = null;
      setRamState(session, enemy, "walking");
      return;
    }
    enemy.moving = false;
    if (session.elapsed < enemy.ramStateEndsAt) return;
    enemy.ramChargeConsumed = true;
    enemy.ramChargeEndX = Math.max(FIELD.baseX, enemy.x - config.chargeRange * CELL.width);
    setRamState(session, enemy, "charge");
    events.push({
      type: "ramChargeStarted", sourceEnemyId: enemy.id,
      x: enemy.x, y: enemy.y, color: config.color, seed: nextEffectSeed(session),
    });
    return;
  }

  if (enemy.ramState === "charge") {
    const previousX = enemy.x;
    const slow = session.elapsed < enemy.slowUntil ? enemy.slowFactor : 1;
    const distance = config.chargeSpeed
      * session.modifiers.enemySpeed
      * (session.sandboxSettings?.enemySpeedMultiplier ?? 1)
      * slow * dt / 1000;
    const nextX = Math.max(enemy.ramChargeEndX, previousX - distance);
    const collision = session.troops
      .filter((troop) => !troop.dead && troop.row === enemy.row && troop.x <= previousX)
      .map((troop) => ({ troop, boundary: troop.x + troopBlockDistance(troop) }))
      .filter(({ boundary }) => boundary <= previousX && boundary >= nextX)
      .sort((left, right) => right.boundary - left.boundary)[0];
    enemy.moving = true;
    if (collision) {
      enemy.x = collision.boundary;
      damageTroop(session, collision.troop, config.chargeDamage, events);
      events.push({
        type: "ramImpact", sourceEnemyId: enemy.id, targetId: collision.troop.id,
        x: collision.troop.x, y: collision.troop.y, color: config.color,
        damage: config.chargeDamage, shake: 5, seed: nextEffectSeed(session),
      });
      enterRamRecovery(session, enemy, config);
      return;
    }
    enemy.x = nextX;
    if (enemy.x <= enemy.ramChargeEndX) {
      events.push({
        type: "ramChargeMissed", sourceEnemyId: enemy.id,
        x: enemy.x, y: enemy.y, color: config.color, seed: nextEffectSeed(session),
      });
      enterRamRecovery(session, enemy, config);
    }
    return;
  }

  if (enemy.ramState === "idle" && enemy.ramIdleMode === "recover") {
    enemy.moving = false;
    if (session.elapsed < enemy.ramStateEndsAt) return;
    enemy.ramIdleMode = "cooldown";
    enemy.ramStateStartedAt = session.elapsed;
    enemy.ramStateEndsAt = Infinity;
    enemy.attackReadyAt = session.elapsed;
  }

  if (enemy.ramState === "attack") {
    enemy.moving = false;
    if (enemy.ramAttackPending && session.elapsed >= enemy.ramAttackImpactAt) {
      const target = session.troops.find((troop) => (
        troop.id === enemy.ramAttackTargetId
        && !troop.dead
        && troop.row === enemy.row
        && enemy.x - troop.x <= troopBlockDistance(troop)
      ));
      if (target) {
        damageTroop(session, target, enemy.damage, events);
        events.push({ type: "melee", x: target.x, y: target.y, sourceEnemyId: enemy.id });
      }
      enemy.ramAttackPending = false;
      enemy.ramAttackImpactAt = Infinity;
      enemy.ramAttackTargetId = null;
    }
    if (session.elapsed < enemy.ramStateEndsAt) return;
    setRamState(session, enemy, "idle", Infinity, "cooldown");
  }

  const blockingTarget = ramBlockingTarget(session, enemy);
  if (enemy.ramState === "idle") {
    enemy.moving = false;
    if (!blockingTarget) {
      setRamState(session, enemy, "walking");
      moveEnemy(session, enemy, dt, events);
      return;
    }
    if (session.elapsed >= enemy.attackReadyAt) beginRamNormalAttack(session, enemy, blockingTarget, config);
    return;
  }

  if (!enemy.ramChargeConsumed) {
    const target = closestTroopForEnemy(session, enemy, config.chargeRange);
    if (target) {
      enemy.ramChargeTargetId = target.id;
      setRamState(session, enemy, "chargePrep", config.chargePrepMs);
      events.push({
        type: "ramChargePrep", sourceEnemyId: enemy.id,
        x: enemy.x, y: enemy.y, color: config.color, seed: nextEffectSeed(session),
      });
      return;
    }
  }

  if (blockingTarget) {
    setRamState(session, enemy, "idle", Infinity, "cooldown");
    if (session.elapsed >= enemy.attackReadyAt) beginRamNormalAttack(session, enemy, blockingTarget, config);
    return;
  }
  setRamState(session, enemy, "walking");
  moveEnemy(session, enemy, dt, events);
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

function resolveInhibitorWebImpact(session, projectile, target, events) {
  damageTroop(session, target, projectile.damage, events);
  applyWorkerQueenWebDebuff(session, target, projectile);
  events.push({
    type: "inhibitorWebImpact",
    sourceEnemyId: projectile.sourceEnemyId,
    targetId: target.id,
    targetTroopId: target.id,
    x: target.x,
    y: target.y - 18,
    attackSpeedFactor: projectile.webSlowFactor,
    rangePenaltyTiles: projectile.webRangePenaltyTiles,
    durationMs: projectile.webSlowDurationMs,
    color: projectile.color,
    seed: projectile.seed,
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

    const intendedTarget = projectile.targetTroopId
      ? session.troops.find((troop) => troop.id === projectile.targetTroopId && !troop.dead)
      : null;
    if (projectile.kind === "inhibitorWeb" && projectile.targetLocked) {
      if (!intendedTarget) {
        projectile.active = false;
        continue;
      }
      if (projectile.x <= intendedTarget.x + 20) {
        resolveInhibitorWebImpact(session, projectile, intendedTarget, events);
        projectile.active = false;
      } else if (projectile.x <= FIELD.baseX || projectile.y < -80 || projectile.y > FIELD.height + 80) {
        projectile.active = false;
      }
      continue;
    }
    const target = session.troops
      .filter((troop) => !troop.dead
        && troop.row === projectile.row
        && troop.x <= projectile.previousX + 24
        && troop.x >= projectile.x - 24)
      .sort((left, right) => right.x - left.x)[0] || null;
    if (target) {
      damageTroop(session, target, projectile.damage, events);
      if (projectile.kind === "inhibitorWeb") {
        if (!intendedTarget || intendedTarget.id === target.id) {
          applyWorkerQueenWebDebuff(session, target, projectile);
        }
        events.push({
          type: "inhibitorWebImpact",
          sourceEnemyId: projectile.sourceEnemyId,
          targetId: target.id,
          targetTroopId: target.id,
          x: target.x,
          y: target.y - 18,
          attackSpeedFactor: projectile.webSlowFactor,
          rangePenaltyTiles: projectile.webRangePenaltyTiles || 0,
          durationMs: projectile.webSlowDurationMs,
          color: projectile.color,
          seed: projectile.seed,
        });
      } else {
        events.push({
          type: "abyssImpact", weapon: projectile.visualKind, x: target.x, y: target.y - 18,
          color: projectile.color, seed: projectile.seed,
        });
      }
      projectile.active = false;
    } else if (projectile.x <= FIELD.baseX || projectile.y < -80 || projectile.y > FIELD.height + 80) {
      projectile.active = false;
    }
  }
  session.enemyProjectiles = session.enemyProjectiles.filter((projectile) => projectile.active);
}

function scarabPhaseConfig(config, phase) {
  return config[`phase${phase}`] || config.phase1;
}

function setScarabState(session, enemy, state, durationMs = Infinity) {
  if (enemy.scarabState !== state) enemy.scarabStateStartedAt = session.elapsed;
  enemy.scarabState = state;
  enemy.scarabStateEndsAt = Number.isFinite(durationMs) ? session.elapsed + durationMs : Infinity;
}

function cancelScarabAttack(enemy) {
  enemy.scarabAttackApplied = false;
  enemy.scarabAttackTargetId = null;
}

function startScarabTransition(session, enemy, nextPhase, config, events) {
  cancelScarabAttack(enemy);
  enemy.moving = false;
  enemy.scarabTransitionToPhase = nextPhase;
  if (nextPhase === 2) {
    enemy.scarabPhase2Triggered = true;
    setScarabState(session, enemy, "transitionPhase1To2", config.transitionPhase1To2.durationMs);
  } else {
    enemy.scarabPhase3Triggered = true;
    setScarabState(session, enemy, "transitionPhase2To3", config.transitionPhase2To3.durationMs);
  }
  events.push({
    type: "scarabTransitionStart", sourceEnemyId: enemy.id,
    fromPhase: enemy.bossPhase, toPhase: nextPhase,
    x: enemy.x, y: enemy.y, color: config.color, shake: nextPhase === 3 ? 8 : 6,
    seed: nextEffectSeed(session),
  });
}

function finishScarabTransition(session, enemy, config, events) {
  const nextPhase = enemy.scarabTransitionToPhase;
  if (!nextPhase) return;
  enemy.bossPhase = nextPhase;
  enemy.scarabTransitionToPhase = null;
  const phase = scarabPhaseConfig(config, nextPhase);
  enemy.speed = phase.speed;
  enemy.damage = phase.damage;
  enemy.attackReadyAt = session.elapsed + 400;
  setScarabState(session, enemy, `phase${nextPhase}Idle`);
  events.push({
    type: "scarabTransitionComplete", sourceEnemyId: enemy.id, phase: nextPhase,
    x: enemy.x, y: enemy.y, color: config.color, seed: nextEffectSeed(session),
  });
}

function updateScarabEmperor(session, enemy, config, dt, events) {
  const transitioning = enemy.scarabTransitionToPhase != null;
  if (transitioning) {
    enemy.moving = false;
    if (session.elapsed < enemy.scarabStateEndsAt) return;
    finishScarabTransition(session, enemy, config, events);
    const ratio = enemy.hp / enemy.maxHp;
    if (enemy.bossPhase === 2 && ratio <= config.phase3Threshold && !enemy.scarabPhase3Triggered) {
      startScarabTransition(session, enemy, 3, config, events);
    }
    return;
  }

  if (session.elapsed < (enemy.stunnedUntil || 0)) {
    enemy.moving = false;
    return;
  }

  const hpRatio = enemy.hp / enemy.maxHp;
  if (enemy.bossPhase === 1 && hpRatio <= config.phase2Threshold && !enemy.scarabPhase2Triggered) {
    startScarabTransition(session, enemy, 2, config, events);
    return;
  }
  if (enemy.bossPhase === 2 && hpRatio <= config.phase3Threshold && !enemy.scarabPhase3Triggered) {
    startScarabTransition(session, enemy, 3, config, events);
    return;
  }

  const phase = scarabPhaseConfig(config, enemy.bossPhase);
  if (enemy.scarabState === `phase${enemy.bossPhase}Attack`) {
    enemy.moving = false;
    if (!enemy.scarabAttackApplied
      && session.elapsed >= enemy.scarabStateStartedAt + phase.attackImpactMs) {
      const target = session.troops.find((troop) => (
        troop.id === enemy.scarabAttackTargetId
        && !troop.dead
        && troop.row === enemy.row
        && enemy.x - troop.x <= phase.attackRangeTiles * CELL.width
      ));
      if (target) {
        damageTroop(session, target, phase.damage, events);
        events.push({
          type: "scarabAttackImpact", sourceEnemyId: enemy.id, targetId: target.id,
          phase: enemy.bossPhase, damage: phase.damage,
          x: target.x, y: target.y, color: config.color, seed: nextEffectSeed(session),
        });
      }
      enemy.scarabAttackApplied = true;
    }
    if (session.elapsed >= enemy.scarabStateEndsAt) {
      cancelScarabAttack(enemy);
      setScarabState(session, enemy, `phase${enemy.bossPhase}Idle`);
    }
    return;
  }

  const target = closestTroopForEnemy(session, enemy, phase.attackRangeTiles);
  const inRange = target && enemy.x - target.x <= phase.attackRangeTiles * CELL.width;
  if (inRange) {
    enemy.moving = false;
    setScarabState(session, enemy, `phase${enemy.bossPhase}Idle`);
    if (session.elapsed >= enemy.attackReadyAt) {
      enemy.scarabAttackApplied = false;
      enemy.scarabAttackTargetId = target.id;
      enemy.attackReadyAt = session.elapsed + phase.attackEveryMs;
      enemy.lastAttackAt = session.elapsed;
      setScarabState(session, enemy, `phase${enemy.bossPhase}Attack`, phase.attackDurationMs);
    }
    return;
  }

  setScarabState(session, enemy, `phase${enemy.bossPhase}Walking`);
  moveEnemy(session, enemy, dt, events);
}

function updateEnemies(session, dt, events) {
  for (const enemy of [...session.enemies]) {
    if (enemy.dead) continue;
    enemy.previousRenderX = enemy.x;
    enemy.previousRenderY = enemy.y;
    const config = ENEMIES[enemy.type];
    if (updateSilicaDiggerEmergence(session, enemy, config, events)) continue;
    if (enemy.type === "scarabEmperor") {
      updateScarabEmperor(session, enemy, config, dt, events);
      continue;
    }
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

    if (enemy.type === "duneRipper") {
      updateDuneRipper(session, enemy, config, dt, events);
      continue;
    }

    if (enemy.type === "ramBeetle") {
      updateRamBeetle(session, enemy, config, dt, events);
      continue;
    }

    if (enemy.type === "workerQueenEgg") {
      updateWorkerQueenEgg(session, enemy, config, events);
      continue;
    }

    if (enemy.type === "workerQueen") {
      updateWorkerQueen(session, enemy, config, dt, events);
      continue;
    }

    if (enemy.meleeAttackPending) {
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
        if (config.attackVisual?.impactMs) {
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
      if (enemy.dead || enemy.row !== mine.row || ENEMIES[enemy.type]?.triggersGroundTraps === false || !isGroundTrapEligible(enemy)) return false;
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
  session.pendingOutcome = null;
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
    assistanceTriggered: session.assistanceTriggered,
    assistanceUsed: session.assistanceUsed,
    adaptiveAid: {
      hardshipScore: session.adaptiveAid.hardshipScore,
      triggerWave: session.adaptiveAid.triggerWave,
      triggerTier: session.adaptiveAid.triggerTier,
      offeredOptions: session.adaptiveAid.availableOptions.map((option) => option.id),
      selectedOption: session.adaptiveAid.selectedOptionId,
    },
  };
}

export function simulateAdaptiveAid(session, tier) {
  const events = [];
  const result = simulateAdaptiveAidDomain(session, tier, events);
  return { ...result, events };
}

export function openAdaptiveAidCapsule(session) {
  const events = [];
  const result = openAdaptiveAidCapsuleDomain(session, events);
  return { ...result, events };
}

export function selectAdaptiveAidOption(session, optionId, target = null) {
  const events = [];
  const result = selectAdaptiveAidOptionDomain(session, optionId, target, events, {
    stunEnemy,
    damageEnemy,
    createTroopEntity,
    getTroopDeploymentLimit,
    getActiveTroopCount,
    refreshSwarmDoctrine,
  });
  session.enemies = session.enemies.filter((enemy) => !enemy.dead);
  return { ...result, events };
}

export function stepBattle(session, dt = 32) {
  if (session.outcome) return [];
  const events = [];
  session.elapsed += dt;
  updateAdaptiveAidLifecycle(session, events);
  if (session.pendingOutcome && !adaptiveAidBlocksIntermission(session.adaptiveAid?.status)) {
    finish(session, session.pendingOutcome);
    return events;
  }
  updateEnergyPickups(session, dt, events);
  updateWindCurrent(session, events, {
    troops: TROOPS,
    enemies: ENEMIES,
    isCellReserved: capsuleReservesCell,
  });
  updateSandstorm(session, events);
  if (session.waveActive || session.sandbox) {
    session.supplyAccumulator += dt;
    while (session.supplyAccumulator >= 1000) {
      session.supplyAccumulator -= 1000;
      session.supply = Math.min(session.supplyMax, session.supply + 1);
    }
    while (session.waveActive && session.queue.length && session.elapsed >= session.nextSpawnAt) {
      const queued = session.queue.shift();
      const enemy = createEnemy(session, queued);
      session.nextSpawnAt = session.queue.length
        ? session.waveStartedAt + session.queue[0].spawnAtMs
        : Infinity;
      if (!enemy) continue;
      events.push({ type: "spawn", x: enemy.x, y: enemy.y, enemy });
    }
    updateDematerializationPulses(session, events);
    updatePrismaticMantle(session, events);
    updateTroops(session, events, dt);
    updateProjectiles(session, dt, events);
    updateEnemyProjectiles(session, dt, events);
    updateEnemies(session, dt, events);
    updateMines(session, events);
    if (!session.sandbox && session.integrity <= 0) {
      endSandstorm(session, events, true);
      endWindCurrent(session, events, true);
      finish(session, "defeat");
      return events;
    }
    const waveCleared = !session.sandbox && !session.outcome && session.waveActive
      && session.queue.length === 0 && session.enemies.length === 0 && session.enemyProjectiles.length === 0;
    if (waveCleared) {
      session.waveActive = false;
      session.activeTemporaryDecisions = [];
      endSandstorm(session, events, true);
      endWindCurrent(session, events, true);
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
        if (adaptiveAidBlocksIntermission(session.adaptiveAid?.status)) session.pendingOutcome = "victory";
        else finish(session, "victory");
      } else {
        session.waveIndex += 1;
        session.preparing = true;
        const completedWaveNumber = completedWave + 1;
        session.pendingDecisionLevel = getDecisionStage(completedWaveNumber, session.phase.waves.length);
        session.pendingDecision = getDecisionOptions({
          completedWave: completedWaveNumber,
          totalWaves: session.phase.waves.length,
          integrity: session.integrity,
          integrityMax: session.integrityMax,
          energy: session.energy,
          energyMax: session.energyMax,
          supply: session.supply,
          supplyMax: session.supplyMax,
          loadout: session.loadout,
          troops: session.troops,
          modifiers: session.modifiers,
          decisions: session.decisions,
          seed: session.seed,
        });
        events.push({ type: "waveComplete", wave: completedWave + 1 });
      }
    } else evaluateAdaptiveAid(session, events);
  }
  return events;
}

export function getSnapshot(session) {
  const deploymentStats = Object.fromEntries(session.loadout.map((troopId) => {
    const activeCount = getActiveTroopCount(session, troopId);
    const maxDeployed = getTroopDeploymentLimit(troopId);
    return [troopId, { ...getEffectiveTroopStats(session, troopId), activeCount, maxDeployed, limitReached: activeCount >= maxDeployed }];
  }));
  return {
    energy: Math.round(session.energy), energyMax: Math.round(session.energyMax),
    energyPulse: session.elapsed - session.lastEnergyGainAt < 700,
    supply: Math.round(session.supply * 10) / 10, supplyMax: session.supplyMax,
    integrity: Math.round(session.integrity), integrityMax: Math.round(session.integrityMax),
    wave: session.waveIndex + 1, totalWaves: session.phase.waves.length,
    pendingOutcome: session.pendingOutcome,
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
    fortifiedRow: session.fortifiedRow,
    advancedFormationColumns: [...session.advancedFormationColumns],
    pendingPositionalDecision: session.pendingPositionalDecision ? { ...session.pendingPositionalDecision } : null,
    activeTemporaryDecisions: [...session.activeTemporaryDecisions],
    queuedTemporaryDecisions: [...session.queuedTemporaryDecisions],
    adaptiveAid: {
      status: session.adaptiveAid.status,
      triggered: session.adaptiveAid.triggered,
      used: session.adaptiveAid.used,
      hardshipScore: session.adaptiveAid.hardshipScore,
      triggerWave: session.adaptiveAid.triggerWave,
      triggerTier: session.adaptiveAid.triggerTier,
      selectedOptionId: session.adaptiveAid.selectedOptionId,
      availableOptions: session.adaptiveAid.availableOptions.map((option) => ({ ...option })),
      capsule: session.adaptiveAid.capsule ? { ...session.adaptiveAid.capsule } : null,
      pendingTarget: session.adaptiveAid.pendingTarget,
      battleNotice: session.adaptiveAid.battleNotice ? { ...session.adaptiveAid.battleNotice } : null,
    },
    assistanceTriggered: session.assistanceTriggered,
    assistanceUsed: session.assistanceUsed,
    fortuneFreeDeploymentCharges: session.fortuneFreeDeploymentCharges,
    prismaticMantle: { ...session.prismaticMantle },
    webDebuffs: session.troops
      .filter((troop) => session.elapsed < Math.max(
        troop.webSlowUntil || 0,
        troop.webRangePenaltyUntil || 0,
      ))
      .map((troop) => ({
        troopId: troop.id,
        remainingMs: Math.max(0, Math.max(
          troop.webSlowUntil || 0,
          troop.webRangePenaltyUntil || 0,
        ) - session.elapsed),
        attackSpeedFactor: troop.webSlowFactor || 1,
        rangePenaltyTiles: troop.webRangePenaltyTiles || 0,
      })),
    sandstorm: {
      state: session.sandstorm.state,
      startsInMs: session.sandstorm.state === "warning"
        ? Math.max(0, session.sandstorm.startsAt - session.elapsed)
        : 0,
      remainingMs: session.sandstorm.state === "active"
        ? Math.max(0, session.sandstorm.endsAt - session.elapsed)
        : session.sandstorm.state === "recovering"
          ? Math.max(0, session.sandstorm.recoveryEndsAt - session.elapsed)
          : 0,
      buriedTroopIds: [...session.sandstorm.buriedTroopIds],
      slowedTroopIds: [...session.sandstorm.slowedTroopIds],
      stormsThisWave: session.sandstorm.stormsThisWave,
      troopCountAtStart: session.sandstorm.troopCountAtStart,
      troopCountAtEnd: session.sandstorm.troopCountAtEnd,
      troopLossCount: session.sandstorm.troopLossCount,
      troopLossRatio: session.sandstorm.troopLossRatio,
      repeatLossToleranceRatio: session.sandstorm.repeatLossToleranceRatio,
      repeatEligible: session.sandstorm.repeatEligible,
      nextCheckInMs: Number.isFinite(session.sandstorm.nextCheckAt)
        ? Math.max(0, session.sandstorm.nextCheckAt - session.elapsed)
        : 0,
    },
    windCurrent: {
      state: session.windCurrent.state,
      direction: session.windCurrent.direction,
      verticalDirection: session.windCurrent.verticalDirection,
      selectedRows: [...session.windCurrent.selectedRows],
      sourceRow: session.windCurrent.sourceRow,
      targetRow: session.windCurrent.targetRow,
      startsInMs: session.windCurrent.state === "warning"
        ? Math.max(0, session.windCurrent.startsAt - session.elapsed)
        : 0,
      remainingMs: session.windCurrent.state === "active"
        ? Math.max(0, session.windCurrent.endsAt - session.elapsed)
        : session.windCurrent.state === "recovering"
          ? Math.max(0, session.windCurrent.recoveryEndsAt - session.elapsed)
          : 0,
      currentsThisWave: session.windCurrent.currentsThisWave,
      selectedTroopId: session.windCurrent.selectedTroopId,
      shiftedTroopIds: [...session.windCurrent.shiftedTroopIds],
      shiftedEnemyIds: [...session.windCurrent.shiftedEnemyIds],
      ejectedEnemyIds: [...session.windCurrent.ejectedEnemyIds],
      troopCountAtStart: session.windCurrent.troopCountAtStart,
      troopCountAtEnd: session.windCurrent.troopCountAtEnd,
      troopLossCount: session.windCurrent.troopLossCount,
      troopLossRatio: session.windCurrent.troopLossRatio,
      repeatLossToleranceRatio: session.windCurrent.repeatLossToleranceRatio,
      repeatEligible: session.windCurrent.repeatEligible,
      nextCheckInMs: Number.isFinite(session.windCurrent.nextCheckAt)
        ? Math.max(0, session.windCurrent.nextCheckAt - session.elapsed)
        : 0,
      recoveryQueue: session.windCurrent.recoveryQueue.map((entry) => ({ ...entry })),
    },
    dematerializationPulses: session.dematerializationPulses.map((pulse) => ({ ...pulse })),
    nextWaveEnemyCountFactor: session.nextWaveEnemyCountFactor,
  };
}

export function cellFromPoint(x, y) {
  return { row: clamp(Math.floor(y / CELL.height), 0, FIELD.rows - 1), col: clamp(Math.floor(x / CELL.width), 0, FIELD.cols - 1) };
}
