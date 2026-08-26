import { DAMAGE_TYPES, DEFAULT_MAX_DEPLOYED_PER_TROOP, ENEMIES, TROOPS } from "../content.js";
import { buildSpawnQueue, calculateStars, createRng, getDecisionOptions, getDecisionStage, isGroundTrapEligible } from "../domain.js";
import { CHAPTER_FIVE_PACKETS } from "../chapterFivePackets.js";
import { CHAPTER_SIX_PACKETS } from "../chapterSixWaves.js";
import {
  BOSS_ENCOUNTER_PACKET_ID,
  enqueueBossReinforcement as enqueueBossReinforcementSystem,
  initializeBossEncounterForWave,
  markBossEncounterSpawned,
  markBossReinforcementSpawned,
  shouldDeferBossAwareSpawn,
  updateBossEncounter as updateBossEncounterSystem,
} from "../systems/bossEncounterSystem.js";
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
} from "../adaptiveAid.js";
import {
  CELL, FIELD, VIEWPORT, getEnemyHitPoint, getEnemyMuzzleWorldPosition, getLeviathanHitPointForRow,
  getMuzzleWorldPosition, getRepulsorKnockbackOffset, getTroopAnimation, getEnemyAnimation,
} from "../visualGeometry.js";
import {
  forceExecutorComboStep, isExecutorArco, updateExecutorArco,
} from "../executorArco.js";
import {
  isIcaroAirTarget,
  selectIcaroBurstRetarget,
  updateInterceptadorIcaro,
} from "../interceptadorIcaro.js";
import { initializeMantisFlightPath, sampleMantisArc, updateMantis } from "../mantis.js";
import { updateFuzileiroVoltaico } from "../fuzileiroVoltaico.js";
import { getAresFireBonus, updateAresThermalShields } from "../troops/aresT.js";
import { getCryoDamageFactor, getCryoShockDuration, isCryoThermalTarget, selectCryoTarget } from "../troops/cryo7.js";
import { getBastiaoFloodedDamageFactor, recordBastiaoDamage, updateBastiaoMare } from "../bastiaoMare.js";
import {
  createWindCurrentState,
  endWindCurrent,
  resetWindCurrentForWave,
  updateWindCurrent,
} from "../windCurrent.js";
import {
  createTideCycleState,
  endTideCycle,
  getTideAdjustedEnemySlowFactor,
  getTideEnemySpeedFactor,
  getTidePlacementBlockReason,
  getTideSnapshot,
  getTideTroopAttackSpeedFactor,
  getTideCellState,
  isTideCellFlooded,
  isTideMineDisabled,
  isTideReactorPaused,
  recordTideTroopElimination,
  resetTideCycleForWave,
  updateTideCycle,
} from "../tideCycle.js";
import {
  createThermalCycleState,
  createThermalPlatform,
  renewThermalPlatform,
  THERMAL_STATES,
  createTemporaryMagmaEruption,
  createTemporaryMagmaHazard,
  getTemporaryMagmaAt,
  activatePermanentThermalHazards,
  deactivatePermanentThermalHazards,
  clearPermanentThermalHazards,
  isSessionMagmaCell,
  getThermalPlatformAt,
  coolThermalPlatform,
  isMagmaCell,
  isTroopThermalCompatible,
  getThermalSnapshot,
  enterThermalIntermission,
  resumeThermalHazard,
  updateThermalTerrain,
} from "../thermalTerrain.js";
import {
  CHAPTER_SIX_ALPHA_MODIFIERS,
  countPressureTroops,
  createAlphaPressureState,
  evaluateAlphaPressure,
  resetAlphaPressureForWave,
} from "../chapterSixAlphaPressure.js";
import { chapterFourAlphaMultipliers } from "../chapterFourEnemies.js";
import {
  applyConductivity,
  applyElectricCharge,
  electricDamageTakenFactor,
  expireElectricState,
  isElectricParalyzed,
} from "../electricCharge.js";
import {
  createPositionalConfirmationEvent,
  getPositionalTargetPreview,
  validatePositionalTarget,
} from "../positionalTargeting.js";
import { compactActive } from "../battleCollections.js";
import {
  DEMATERIALIZATION_PULSE,
  beginDematerializationPulse,
  createDematerializationPulseState,
  getDematerializationPulseTargets,
} from "../dematerializationPulse.js";
import { canTroopTargetEnemy, isEnemyTargetable, isRasgamarSubmerged, isIncubatorSubmerged, RASGAMAR_SUBMERGED_STATES } from "../enemyTargeting.js";
import {
  getBattleIndex,
  livingEnemyById,
  livingTroopById,
  rebuildBattleIndex,
  registerEnemyInIndex,
  registerTroopInIndex,
} from "../battleIndex.js";
import { createProjectileTrail, pushProjectileTrail } from "../projectileTrail.js";
import { forceLeviathanAttack as forceLeviathanAttackDomain, updateLeviathan } from "../leviathanNereida.js";
import { debugColosso as debugColossoDomain, forceColossoAttack as forceColossoAttackDomain, getColossoCoreHitMetadata, getColossoDamageFactor, updateColossoCaldeira } from "../colossoCaldeira.js";
import { createEnemyEntity } from "../enemies/enemyFactory.js";
import { getEnemyBehavior } from "../enemies/enemyRegistry.js";
import {
  getLivingRasgamarTroopsInRow,
  getRasgamarRelocationDuration,
  hasLivingTroopsForRasgamar,
  hasLivingTroopsInRasgamarRow,
  selectRasgamarRangedTarget,
  selectRasgamarRelocationRow,
} from "../enemies/chapter05/enguiaRasgamarTactics.js";
import {
  accelerateWaveOutro as accelerateWaveOutroState,
  advanceWaveOutroState,
  cellFromPoint as cellFromPointFromGeometry,
  getWaveOutroCinematicFactor as getWaveOutroCinematicFactorFromState,
  getRouteTelemetry as getRouteTelemetryFromState,
  isWaveOutroActive as isWaveOutroActiveState,
  WAVE_OUTRO_TIMINGS,
} from "./waveOutro.js";
import {
  enemiesForRow,
  enemyOccupiesTargetRow,
  getEnemyTargetableRows,
  indexedEnemyById,
  indexedTroopById,
  troopsForRow,
} from "./queries.js";
import { getDefaultTroopDeploymentLimit, getPlacementBlockReasonForPhase, isCombatRow, isSystemEnabledForPhase, isTroopAllowedForPhase } from "../phaseRules.js";
import { createConvoyFlow, createConvoyState } from "../chapter07/convoyState.js";
import { updateConvoyEnergy } from "../chapter07/convoyEnergy.js";
import { advanceConvoyTransit, completeConvoySector, startConvoySector } from "../chapter07/convoyFlow.js";
import { hasCombatRelevantEnemies, enterCheckpointPreparation } from "../chapter07/convoyCheckpoints.js";
import { applyConvoyCheckpointOption } from "../chapter07/convoyCheckpointRewards.js";
import { updateConvoyReinforcements } from "../chapter07/convoySpawnDirector.js";
import { canEnemyReachConvoy, hasBlockingTroop, updateConvoyThreat } from "../chapter07/convoyTargeting.js";
import { damageConvoy } from "../chapter07/convoyDamage.js";
import { getPersistentBiteMultiplier, commitPersistentBite, resetPersistentBite } from "../chapter07/persistentBite.js";
import { updateSaltadorAlado } from "../chapter07/saltadorAlado.js";
import { updateSporeField } from "../chapter07/sporeField.js";
import { repositionTroop as repositionConvoyTroop } from "../chapter07/convoyReposition.js";
import { calculateConvoyStars } from "../chapter07/convoyScoring.js";
import { updateConvoyAnimation } from "../chapter07/convoyAnimation.js";
import { CONVOY_DEFEAT_RESULT_DELAY_MS } from "../chapter07/convoyAnimationConfig.js";
import { spawnEnergyPickup, trySpawnEnemyEnergyPickup, updateEnergyPickups, setEnergyPickupPointer } from "../energyPickups.js";
import { getVertebralToxinAttackSpeedFactor } from "../chapter07/vertebralToxin.js";
import { generateForestObstacles } from "../chapter07/forestObstacleGeneration.js";
import { damageForestObstacle, destroyForestObstacle } from "../chapter07/forestObstacleSystem.js";
import { getBlockingForestObstacle, getForestObstacleAt, getForestObstacleHitPoint, resolveForestCombatTarget } from "../chapter07/forestObstacleTargeting.js";

export {
  createWindCurrentState,
  endWindCurrent,
  resetWindCurrentForWave,
  updateWindCurrent,
} from "../windCurrent.js";
export { createPositionalConfirmationEvent, getPositionalTargetPreview, validatePositionalTarget };

export { CELL, FIELD, VIEWPORT } from "../visualGeometry.js";
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

const mortarTargetCounts = new Uint16Array(FIELD.cols);
const mortarTargetEntities = Array(FIELD.cols).fill(null);

export function getTroopDeploymentLimit(troopId, phaseOrSession = null) {
  const phase = phaseOrSession?.phase || phaseOrSession;
  const missionLimit = Number(
    phase?.startingTroopRules?.deploymentLimits?.[troopId]
      ?? phase?.troopDeploymentLimits?.[troopId],
  );
  if (Number.isFinite(missionLimit) && missionLimit >= 0) return Math.floor(missionLimit);
  const defaultLimit = phase ? getDefaultTroopDeploymentLimit(phase) : DEFAULT_MAX_DEPLOYED_PER_TROOP;
  return Number.isFinite(TROOPS[troopId]?.maxDeployed)
    ? Math.min(TROOPS[troopId].maxDeployed, defaultLimit)
    : defaultLimit;
}

export function getActiveTroopCount(session, troopId) {
  const indexed = getBattleIndex(session)?.activeTroopsByType.get(troopId);
  if (!indexed) {
    let count = 0;
    for (const troop of session.troops) if (!troop.dead && troop.type === troopId) count += 1;
    return count;
  }
  let count = 0;
  for (const troop of indexed) if (!troop.dead) count += 1;
  return count;
}

export function validateLoadoutForPhase(phase, loadout) {
  const uniqueLoadout = [...new Set(loadout || [])];
  if (!uniqueLoadout.length) return { ok: false, reason: "Selecione pelo menos uma tropa." };
  if (uniqueLoadout.length > (phase.loadoutLimit ?? 6)) return { ok: false, reason: `Este capítulo permite no máximo ${phase.loadoutLimit} tropas.` };
  if (uniqueLoadout.some((troopId) => !TROOPS[troopId])) return { ok: false, reason: "Loadout contém uma tropa inválida." };
  if (uniqueLoadout.some((troopId) => !isTroopAllowedForPhase(phase, troopId))) return { ok: false, reason: "Loadout contém uma tropa bloqueada nesta missão." };
  return { ok: true, loadout: uniqueLoadout };
}

let entityId = 1;
const id = (prefix) => `${prefix}_${entityId++}`;
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
export const CONCUSSIVE_IMPACT = Object.freeze({ baseDistance: 35, cooldownMs: 3000, heavyFactor: 0.5, alphaFactor: 0.25 });
export { WAVE_OUTRO_TIMINGS };
export { DEMATERIALIZATION_PULSE };
export { spawnEnergyPickup, setEnergyPickupPointer, updateEnergyPickups, trySpawnEnemyEnergyPickup as trySpawnEnergyPickup };

const DEFAULT_SANDBOX_SETTINGS = {
  rulesMode: "free",
  mechanicMode: "none",
  invulnerableBase: true,
  enemyHpMultiplier: 1,
  enemySpeedMultiplier: 1,
  enemyDamageMultiplier: 1,
  troopDamageMultiplier: 1,
  magmaThermalState: "auto",
  magmaCrustCoverage: 0.48,
  magmaFlowMultiplier: 1,
  magmaWarpMultiplier: 1,
  magmaVentLimit: 7,
  magmaParticleLimit: 60,
  magmaPaused: false,
  magmaShowHeatmap: false,
  magmaShowRegionMask: false,
};

function applySandboxMechanic(phase, settings = {}) {
  if (!settings.mechanicMode || !phase?.sandboxMechanics) return phase;
  const profile = phase.sandboxMechanics[settings.mechanicMode] || phase.sandboxMechanics.none;
  return {
    ...phase,
    environmentHazard: profile?.environmentHazard || null,
    chapterMechanic: profile?.chapterMechanic || null,
    magmaTerrain: Object.prototype.hasOwnProperty.call(profile || {}, "magmaTerrain")
      ? profile.magmaTerrain
      : Object.prototype.hasOwnProperty.call(phase, "sandboxBaseMagmaTerrain")
        ? phase.sandboxBaseMagmaTerrain
        : phase.magmaTerrain,
    ambientEffects: Object.prototype.hasOwnProperty.call(profile || {}, "ambientEffects")
      ? profile.ambientEffects
      : phase.sandboxBaseAmbientEffects || phase.ambientEffects,
  };
}

function initializeSandboxHazard(session) {
  if (!session.sandbox) return;
  const hazard = session.phase.environmentHazard;
  session.waveStartedAt = 0;
  session.sandstorm.nextCheckAt = hazard?.id === "sandstorm"
    ? session.elapsed + Math.min(1200, hazard.firstCheckDelayMs)
    : Infinity;
  session.sandstorm.repeatLossToleranceRatio = hazard?.repeatLossToleranceRatio || 0;
  resetWindCurrentForWave(session, hazard);
  resetTideCycleForWave(session, hazard);
}

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
  const sandboxSettings = sandbox ? { ...DEFAULT_SANDBOX_SETTINGS, ...options.sandboxSettings } : null;
  const sessionPhase = sandbox ? applySandboxMechanic(phase, sandboxSettings) : phase;
  const hasThermalCycle = sessionPhase.environmentHazard?.id === "thermal_cycle";
  const supplyLimit = sessionPhase.supplyLimit ?? 20;
  const validation = validateLoadoutForPhase(sessionPhase, loadout);
  if (!sandbox && sessionPhase.progressionMode === "convoy" && !validation.ok) throw new Error(validation.reason);
  const session = {
    phase: sessionPhase,
    enemyConfigs: ENEMIES,
    loadout: [...loadout],
    seed,
    rng: createRng(seed),
    elapsed: 0,
    energy: sessionPhase.energy,
    energyMax: sessionPhase.energyCapacity ?? sessionPhase.energy,
    lastEnergyGainAt: -Infinity,
    integrity: sessionPhase.baseIntegrity,
    integrityMax: sessionPhase.baseIntegrity,
    supply: supplyLimit,
    supplyMax: supplyLimit,
    supplyAccumulator: 0,
    waveIndex: 0,
    waveActive: false,
    preparing: !sandbox,
    pendingDecision: null,
    pendingDecisionLevel: null,
    waveOutro: {
      status: "idle",
      elapsedMs: 0,
      startedAt: null,
      lastKill: null,
      completedWave: null,
      decisionOptions: null,
      decisionLevel: null,
      finalWave: false,
      killed: 0,
      survivors: 0,
      integrityPercent: 100,
      energyGained: 0,
    },
    waveKillStart: 0,
    lastEnemyKillCandidate: null,
    queue: [],
    nextSpawnAt: 0,
    waveStartedAt: 0,
    bossEncounter: null,
    troops: [],
    enemies: [],
    forestObstacles: [],
    mines: [],
    projectiles: [],
    enemyProjectiles: [],
    sporeFruits: [],
    sporeClouds: [],
    chapterSevenMetrics: { forestTreesSpawned: 0, forestTreesDestroyed: 0, forestDamageReceived: 0, forestSporeTreesDestroyed: 0, forestSporeBursts: 0, forestEnemiesStunned: 0, forestCoverBlocks: 0,
      sporeFruitsThrown: 0, sporeFruitsHit: 0, sporeTroopsConfused: 0, sporeEscortConfusions: 0, sporeMultiHits: 0, escortLostWhileSporeConfused: 0,
      tartaragarraCharges: 0, tartaragarraChargeHits: 0, tartaragarraChargeMisses: 0, tartaragarraTroopsStunned: 0,
      tartaragarraShellHits: 0, tartaragarraShellDamagePrevented: 0, tartaragarraConvoyHeadbutts: 0, tartaragarraConvoyDamage: 0,
      garravinhaLatchAttempts: 0, garravinhaLatches: 0, garravinhaLatchTicks: 0, garravinhaLatchDamage: 0,
      garravinhaLatchInterruptions: 0, garravinhaReleased: 0, garravinhaSideAttacks: 0,
      dardifagoShots: 0, dardifagoNormalShots: 0, dardifagoToxicShots: 0, dardifagoTroopHits: 0, dardifagoConvoyHits: 0,
      dardifagoToxinApplications: 0, dardifagoToxinRefreshes: 0, dardifagoTroopDamage: 0, dardifagoConvoyDamage: 0, dardifagoInterruptedShots: 0 },
    energyPickups: [],
    energyPickupPointer: null,
    dematerializationPulses: isSystemEnabledForPhase(sessionPhase, "dematerializationPulse")
      ? Array.from({ length: FIELD.rows }, (_, row) => createDematerializationPulseState(row))
      : [],
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
    tideCycle: createTideCycleState(),
    thermalCycle: hasThermalCycle
      ? { ...createThermalCycleState(sessionPhase.environmentHazard, 0), paused: !sandbox }
      : null,
    alphaPressure: createAlphaPressureState(sessionPhase.alphaPressure),
    temporaryMagmaHazards: [],
    permanentThermalHazards: [],
    supportStructures: [],
    thermalMetrics: { burnDamage: 0, troopsLost: 0, heatSampleTotal: 0, heatSampleCount: 0, platformRenewals: 0, aresShieldGained: 0, aresShieldAbsorbed: 0 },
    metrics: {
      cryo7Shots: 0, cryo7Hits: 0, cryo7ThermalHits: 0, cryo7FireHits: 0,
      cryo7BonusDamage: 0, cryo7ShockApplications: 0, cryo7NormalFreezeMs: 0,
      cryo7FireFreezeMs: 0, cryo7ShockBlockedByRecovery: 0, cryo7ShockImmuneTargets: 0,
      cryo7PlatformHeatRemoved: 0,
      mantisSalvos: 0, mantisSpikesLaunched: 0, mantisSpikeImpacts: 0,
      mantisSpikeDetonations: 0, mantisExplosionHits: 0, mantisCollateralHits: 0,
      mantisDamageDealt: 0,
      alphaPressure: { checks: 0, triggers: 0, spawned: 0 },
    },
    troopConfigs: TROOPS,
    deployCooldowns: {},
    modifiers: { ...DEFAULT_MODIFIERS },
    shieldCharges: 0,
    reactiveBarrierRows: [],
    fortifiedRow: null,
    focusedFireRow: null,
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
    adaptiveAid: createAdaptiveAidState(!sandbox && sessionPhase.progressionMode !== "convoy"),
    recentTroopLosses: [],
    assistanceTriggered: false,
    assistanceUsed: false,
    fortuneFreeDeploymentCharges: 0,
    decisions: [],
    killed: 0,
    deployed: {},
    providedTroops: {},
    outcome: null,
    pendingOutcome: null,
    result: null,
    sandbox,
    sandboxSettings,
  };
  if (sessionPhase.progressionMode === "convoy") {
    session.convoy = createConvoyState(sessionPhase);
    session.convoyFlow = createConvoyFlow();
    session.convoySectorQueue = session.queue;
  }
  if (sessionPhase.chapterId === "chapter_07" && sessionPhase.forestObstacles?.enabled) {
    session.forestObstacles = generateForestObstacles(sessionPhase, seed);
    session.chapterSevenMetrics.forestTreesSpawned = session.forestObstacles.length;
  }
  initializeSandboxHazard(session);
  deployStartingTroops(session);
  return session;
}

export function canPlaceTroop(session, troopId, row, col) {
  const troop = TROOPS[troopId];
  const effective = getEffectiveTroopStats(session, troopId);
  const freePlacement = session.sandbox && session.sandboxSettings?.rulesMode === "free";
  if (session.waveOutro?.status && !["idle", "completed"].includes(session.waveOutro.status)) return "Aguarde a conclusão da onda.";
  const phaseReason = getPlacementBlockReasonForPhase(session.phase, row, col, troopId);
  if (phaseReason) return phaseReason;
  if (!troop || !session.loadout.includes(troopId)) return "Tropa fora do loadout.";
  if (col < FIELD.firstTroopCol || col > FIELD.lastTroopCol) return "Posição reservada para a defesa da base.";
  if (row < 0 || row >= FIELD.rows || col < 0 || col >= FIELD.cols - 1) return "Posição fora da zona de combate.";
  const forestObstacle = getForestObstacleAt(session, row, col);
  if (forestObstacle?.alive && forestObstacle.blocksPlacement) return `${forestObstacle.type === "ferrivore" ? "Árvore Ferrívora" : "Cobertura"} bloqueia esta posição.`;
  const tideCell = getTideCellState(session, row, col);
  const canBypassTidePlacement = tideCell.status !== "drying" && (
    (tideCell.type === "deepWater" && troop.canDeployInDeepWater)
    || (tideCell.flooded && troop.canDeployInFloodedCells)
  );
  const tidePlacementReason = canBypassTidePlacement
    ? null
    : getTidePlacementBlockReason(session, row, col);
  if (tidePlacementReason) return tidePlacementReason;
  const magma = isSessionMagmaCell(session, row, col);
  const thermalPlatform = troopId === "thermalPlatform";
  const existingPlatform = getThermalPlatformAt(session, row, col);
  if (thermalPlatform && session.troops.some((entry) => !entry.dead && entry.type === "aresT" && entry.row === row && entry.col === col)) {
    return "ARES-T já possui proteção térmica própria.";
  }
  if (troopId === "aresT" && existingPlatform) return "ARES-T já possui proteção térmica própria.";
  if (thermalPlatform && !magma) return "Plataformas Térmicas só podem ser instaladas sobre magma.";
  const renewingPlatform = thermalPlatform && Boolean(existingPlatform);
  if (magma && !thermalPlatform && !existingPlatform && !isTroopThermalCompatible(troop)) return "Magma exige uma Plataforma Térmica; apenas o Drone Sentinela pode operar diretamente.";
  const occupant = session.troops.find((entry) => !entry.dead && entry.row === row && entry.col === col);
  const droneStack = troopId === "droneSentinela" && occupant?.type === "droneSentinela" ? occupant : null;
  if (occupant && !droneStack && !thermalPlatform) {
    return troopId === "droneSentinela" ? "Célula ocupada por outra tropa." : "Célula ocupada.";
  }
  if (droneStack && isDroneStackFull(droneStack, troop)) {
    return `Esta formação já possui o máximo de ${troop.maxDronesPerTile} drones.`;
  }
  if (session.mines.some((entry) => entry.active && entry.row === row && entry.col === col)
    || session.projectiles.some((entry) => entry.active && entry.kind === "mine" && entry.targetRow === row && entry.targetCol === col)) return "Célula reservada por uma mina.";
  if (capsuleReservesCell(session, row, col)) return "Célula ocupada pela Cápsula da Colônia.";
  const deploymentLimit = getTroopDeploymentLimit(troopId, session);
  if (troopId === "droneSentinela") {
    if (!droneStack && getDroneSentinelaTileCount(session) >= deploymentLimit) {
      return `Limite de ${deploymentLimit} células com Drone Sentinela no campo.`;
    }
    if (getTotalDroneSentinelaCount(session) >= troop.maxTotalDrones) {
      return `Limite total de ${troop.maxTotalDrones} drones no campo.`;
    }
  } else if (thermalPlatform && !renewingPlatform && !freePlacement && (session.supportStructures || []).filter((entry) => !entry.destroyed && entry.type === troopId).length >= deploymentLimit) {
    return `Limite de ${deploymentLimit} ${troop.label} no campo.`;
  } else if (!thermalPlatform && !freePlacement && getActiveTroopCount(session, troopId) >= deploymentLimit) {
    return `Limite de ${deploymentLimit} ${troop.label} no campo.`;
  }
  if (!freePlacement && session.energy < effective.price) return `Energia insuficiente: requer ${effective.price}.`;
  if (!freePlacement && session.supply < effective.supply) return `Supply insuficiente: requer ${effective.supply}.`;
  if (!freePlacement && (session.waveActive || session.sandbox || troop.cooldownDuringPreparation) && Number(session.deployCooldowns[troopId] || 0) > session.elapsed) return "Implantação recarregando.";
  return null;
}

export function damageForestObstacleInBattle(session, treeIdOrTree, amount, events = []) {
  const tree = typeof treeIdOrTree === "string"
    ? session.forestObstacles?.find((entry) => entry.id === treeIdOrTree)
    : treeIdOrTree;
  return damageForestObstacle(session, tree, amount, events, stunEnemy);
}

export function destroyForestObstacleInBattle(session, treeIdOrTree, events = []) {
  const tree = typeof treeIdOrTree === "string"
    ? session.forestObstacles?.find((entry) => entry.id === treeIdOrTree)
    : treeIdOrTree;
  return destroyForestObstacle(session, tree, events, stunEnemy);
}

export function getDroneStackAt(session, row, col) {
  return session.troops.find((troop) => (
    !troop.dead && troop.type === "droneSentinela" && troop.row === row && troop.col === col
  )) || null;
}

export function getDroneSentinelaTileCount(session) {
  return session.troops.filter((troop) => !troop.dead && troop.type === "droneSentinela").length;
}

export function getTotalDroneSentinelaCount(session) {
  return session.troops
    .filter((troop) => !troop.dead && troop.type === "droneSentinela")
    .reduce((total, troop) => total + Number(troop.droneCount || 1), 0);
}

export function isDroneStackFull(troop, config = TROOPS.droneSentinela) {
  return Number(troop?.droneCount || 0) >= Number(config.maxDronesPerTile || 3);
}

function calculateTroopBaseMaxHp(session, troopId) {
  const config = TROOPS[troopId];
  const frontline = session.modifiers.frontlineDoctrine
    && ["colono", "lumiUrsa7", "muralhaReforcada", "colossoImpacto", "bastiaoMare"].includes(troopId) ? 1.2 : 1;
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
    amphibious: Boolean(config.amphibious),
    canDeployInFloodedCells: Boolean(config.canDeployInFloodedCells),
    canDeployInDeepWater: Boolean(config.canDeployInDeepWater),
    ignoreTidePressure: Boolean(config.ignoreTidePressure),
    ignoreTideAttackSpeedPenalty: Boolean(config.ignoreTideAttackSpeedPenalty),
    ignoreTideReactorPause: Boolean(config.ignoreTideReactorPause),
    anchoredWhenFlooded: Boolean(config.anchoredWhenFlooded),
    floodedDamageTakenFactor: Number(config.floodedDamageTakenFactor) || 1,
    blockDistancePx: Number(config.blockDistancePx) || undefined,
    droneCount: troopId === "droneSentinela" ? 1 : undefined,
    droneState: troopId === "operadorJano" ? "idle" : undefined,
    droneStateStartedAt: troopId === "operadorJano" ? session.elapsed : undefined,
    droneStackLevel: troopId === "droneSentinela" ? 1 : undefined,
    droneVolleyTargetId: null,
    droneVolleyStartedAt: -Infinity,
    droneDeathLevel: null,
    reactiveShield: 0, reactiveShieldUntil: 0, swarmHpApplied: false,
    attackReadyAt: session.elapsed, mineReadyAt: session.elapsed, gunReadyAt: session.elapsed,
    interceptionReadyAt: troopId === "interceptadorIcaro"
      ? session.elapsed + config.interceptionCooldownMs
      : Infinity,
    icaroLockedTargetIds: [],
    mantisTargets: [], mantisFireAt: Infinity,
    energyAccumulator: 0, energyChargeProgress: 0, energyPickupSpawnTimes: [],
    lastAttackAt: -Infinity, attackStartedAt: -Infinity,
    channelingAttack: false, channelTickAccumulator: 0, lastAttackMode: null,
    pendingImpact: null, pendingComboImpact: null, pendingRepulsorShot: null,
    pendingAresImpact: null,
    cryoShockRecoveryByTarget: {},
    cryoShotCount: 0,
    thermalShieldHp: Number(config.thermalShield?.initialHp) || 0,
    thermalShieldNextPulseAt: config.thermalShield ? session.elapsed + config.thermalShield.pulseEveryMs : Infinity,
    thermalShieldPausedAt: null,
    attackTargetId: null, specialRequested: false, attackBusyUntil: 0,
    attackReleased: false, attackReleaseAt: Infinity,
    comboStep: 0, comboTargetId: null, comboExpiresAt: null,
    specialReadyAt: config.specialEveryMs ? session.elapsed + config.specialEveryMs : Infinity,
    state: "idle", stateStartedAt: session.elapsed, stateEndsAt: Infinity,
    defenseActive: false, defenseThreatId: null, defenseExitAt: null,
    lastRepulsorAt: -Infinity, healTargetId: null, healedThisCharge: 0,
    lastHealPulseAt: -Infinity, cooldownStartedAt: null, cooldownEndsAt: null,
    attackSpeedFactor: 1, attachedParasiteId: null,
    webSlowUntil: 0, webSlowFactor: 1, webRangePenaltyUntil: 0, webRangePenaltyTiles: 0,
    sandBuriedStartedAt: 0, sandBuriedUntil: 0, sandAttackSpeedFactor: 1,
    submerged: false, submergedStartedAt: -Infinity,
    tidePressureDamageApplied: 0, tidePressureInundationId: null,
    tidePressureLastEventAt: -Infinity,
    windRecovery: false,
    electricStacks: 0, electricStacksExpireAt: 0,
    electricParalyzedUntil: 0, electricImmunityUntil: 0,
    electricConductivityUntil: 0, electricVulnerabilityUntil: 0,
    electricReactorPausedUntil: 0,
    firstImpactAvailable: session.modifiers.firstImpact,
    previousRenderX: x, previousRenderY: y, dead: false,
    emberBurnUntil: 0, emberBurnNextTickAt: 0, emberBurnSourceEnemyId: null,
    emberBurnStartedAt: null, emberBurnEndedAt: null, emberBurnTickEveryMs: 500,
  };
}

export function deployStartingTroops(session) {
  const entries = Array.isArray(session?.phase?.startingTroops)
    ? session.phase.startingTroops
    : [];
  if (!entries.length) return [];

  const rules = {
    consumeEnergy: false,
    consumeSupply: false,
    requireLoadout: false,
    removable: false,
    refundable: false,
    countTowardDeploymentLimit: true,
    ...(session.phase.startingTroopRules || {}),
  };
  const occupiedCells = new Set(
    session.troops
      .filter((troop) => !troop.dead)
      .map((troop) => String(troop.row) + ":" + String(troop.col)),
  );
  const provided = [];

  for (const entry of entries) {
    const troopType = String(entry?.type || "");
    const row = Number(entry?.row);
    const col = Number(entry?.col);
    if (!TROOPS[troopType]) {
      throw new Error("Tropa inicial desconhecida na fase " + session.phase.id + ": " + (troopType || "<vazia>") + ".");
    }
    if (!Number.isInteger(row) || row < 0 || row >= FIELD.rows
      || !Number.isInteger(col) || col < FIELD.firstTroopCol || col > FIELD.lastTroopCol) {
      throw new Error("Posição inválida para a tropa inicial " + troopType + ": linha " + row + ", coluna " + col + ".");
    }
    const cellKey = String(row) + ":" + String(col);
    if (occupiedCells.has(cellKey)) {
      throw new Error("Célula inicial duplicada ou ocupada na fase " + session.phase.id + ": " + cellKey + ".");
    }

    const config = TROOPS[troopType];
    const energyCost = rules.consumeEnergy ? Number(config.price) || 0 : 0;
    const supplyCost = rules.consumeSupply ? Number(config.supply) || 0 : 0;
    const troop = createTroopEntity(session, troopType, row, col, {
      energyCost,
      supplyCost,
    });
    if (!troop) continue;

    troop.missionProvided = true;
    troop.providedByPhaseId = session.phase.id;
    troop.providedAtStart = true;
    troop.lockedPlacement = rules.removable === false;
    troop.refundable = rules.refundable !== false;
    troop.countTowardDeploymentLimit = rules.countTowardDeploymentLimit !== false;
    troop.requiresLoadout = rules.requireLoadout === true;

    session.troops.push(troop);
    session.providedTroops[troopType] = (session.providedTroops[troopType] || 0) + 1;
    occupiedCells.add(cellKey);
    provided.push(troop);

    if (rules.consumeEnergy) session.energy = Math.max(0, session.energy - energyCost);
    if (rules.consumeSupply) session.supply = Math.max(0, session.supply - supplyCost);
  }

  if (provided.length) rebuildBattleIndex(session);
  return provided;
}

export function addDroneToStack(session, troop, config, effective, events = []) {
  if (!troop || troop.dead) return { ok: false, reason: "Formação inválida." };
  if (isDroneStackFull(troop, config)) {
    return { ok: false, reason: `Esta formação já possui o máximo de ${config.maxDronesPerTile} drones.` };
  }
  const addedBaseHp = calculateTroopBaseMaxHp(session, "droneSentinela");
  const addedFortificationHp = session.fortifiedRow === troop.row ? addedBaseHp * 0.2 : 0;
  const addedMaxHp = addedBaseHp + addedFortificationHp;
  troop.droneCount += 1;
  troop.droneStackLevel = troop.droneCount;
  troop.baseMaxHp += addedBaseHp;
  troop.fortificationBonusMaxHp += addedFortificationHp;
  troop.maxHp += addedMaxHp;
  troop.hp = Math.min(troop.maxHp, troop.hp + addedMaxHp);
  troop.energyCost += effective.price;
  troop.supplyCost += effective.supply;
  troop.state = "idle";
  troop.stateStartedAt = session.elapsed;
  troop.stateEndsAt = Infinity;
  events.push({
    type: "droneStackAdded", troopId: troop.id, row: troop.row, col: troop.col,
    droneCount: troop.droneCount, x: troop.x, y: troop.y,
  });
  return { ok: true, troop, upgraded: true, droneCount: troop.droneCount };
}

export function placeTroop(session, troopId, row, col) {
  const reason = canPlaceTroop(session, troopId, row, col);
  if (reason) return { ok: false, reason };
  const config = TROOPS[troopId];
  const effective = getEffectiveTroopStats(session, troopId);
  if (troopId === "thermalPlatform") {
    const existingPlatform = getThermalPlatformAt(session, row, col);
    const freePlacement = session.sandbox && session.sandboxSettings?.rulesMode === "free";
    if (existingPlatform) {
      const renewal = renewThermalPlatform(session, existingPlatform, config);
      if (!freePlacement) {
        session.energy -= effective.price;
        session.supply -= effective.supply;
      }
      if (!freePlacement && (session.waveActive || session.sandbox || config.cooldownDuringPreparation)) {
        session.deployCooldowns[troopId] = session.elapsed + effective.deployCooldownMs;
      }
      session.thermalMetrics.platformRenewals = (session.thermalMetrics.platformRenewals || 0) + 1;
      return {
        ok: true,
        support: existingPlatform,
        renewed: true,
        events: [{ type: "thermalPlatformRenewed", supportId: existingPlatform.id, row, col,
          previousHeat: renewal.previousHeat, previousHp: renewal.previousHp,
          heat: 0, hp: existingPlatform.maxHp,
          x: col * CELL.width + CELL.width / 2, y: row * CELL.height + CELL.height / 2 }],
        activeCount: (session.supportStructures || []).length,
        maxDeployed: getTroopDeploymentLimit(troopId, session),
        event: { type: "thermalPlatformRenewed", x: col * CELL.width + CELL.width / 2, y: row * CELL.height + CELL.height / 2 },
      };
    }
    const burningTroop = session.troops.find((entry) => !entry.dead && entry.row === row && entry.col === col && (entry.thermalBurning || entry.thermalExposed));
    const platform = createThermalPlatform(session, row, col, config, () => id("support"));
    const temporaryHazard = getTemporaryMagmaAt(session, row, col);
    if (temporaryHazard) platform.temporaryHazardId = temporaryHazard.id;
    if (!freePlacement) { session.energy -= effective.price; session.supply -= effective.supply; }
    session.deployed[troopId] = (session.deployed[troopId] || 0) + 1;
    if (!freePlacement && (session.waveActive || session.sandbox || config.cooldownDuringPreparation)) session.deployCooldowns[troopId] = session.elapsed + effective.deployCooldownMs;
    return { ok: true, support: platform, events: [{ type: "thermalPlatformDeployed", row, col, supportId: platform.id, rescuedTroopId: burningTroop?.id || null }], activeCount: (session.supportStructures || []).length, maxDeployed: getTroopDeploymentLimit(troopId, session), event: { type: "deploy", x: col * CELL.width + CELL.width / 2, y: row * CELL.height + CELL.height / 2 } };
  }
  const existingDroneStack = troopId === "droneSentinela" ? getDroneStackAt(session, row, col) : null;
  const events = [];
  const troop = existingDroneStack || createTroopEntity(session, troopId, row, col, {
    energyCost: effective.price,
    supplyCost: effective.supply,
  });
  if (existingDroneStack) addDroneToStack(session, troop, config, effective, events);
  else {
    session.troops.push(troop);
    registerTroopInIndex(getBattleIndex(session), troop);
    if (troopId === "droneSentinela") {
      events.push({
        type: "droneStackCreated", troopId: troop.id, row, col,
        droneCount: 1, x: troop.x, y: troop.y,
      });
    }
  }
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
  return {
    ok: true, troop, upgraded: Boolean(existingDroneStack), events,
    activeCount: getActiveTroopCount(session, troopId),
    maxDeployed: getTroopDeploymentLimit(troopId, session),
    event: events[0] || { type: "deploy", x: troop.x, y: troop.y },
  };
}

export function removeTroop(session, row, col) {
  if (session.waveOutro?.status && !["idle", "completed"].includes(session.waveOutro.status)) {
    return { ok: false, reason: "Aguarde a conclusão da onda." };
  }
  const index = session.troops.findIndex((troop) => !troop.dead && troop.row === row && troop.col === col);
  if (index < 0) return { ok: false, reason: "Nenhuma unidade nessa célula." };
  const selectedTroop = session.troops[index];
  if (selectedTroop.missionProvided && selectedTroop.lockedPlacement) {
    return { ok: false, reason: "Esta tropa faz parte da defesa inicial da missão e não pode ser removida." };
  }
  const [troop] = session.troops.splice(index, 1);
  recordTroopLoss(session, troop, "manualRemoval");
  releaseParasiteFromTroop(session, troop);
  const config = TROOPS[troop.type];
  compactActive(session.mines, (mine) => mine.ownerId !== troop.id);
  compactActive(session.projectiles, (projectile) =>
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
    case "focused_fire": {
      const selectedRow = Number(target?.row);
      if (!Number.isInteger(selectedRow)
        || !session.troops.some((troop) => !troop.dead && troop.row === selectedRow)) return false;
      session.modifiers.focusedFire = true;
      session.focusedFireRow = selectedRow;
      break;
    }
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
  if (session.phase?.progressionMode === "convoy") return startConvoySector(session);
  if (session.outcome || session.waveActive || session.pendingDecision || session.pendingPositionalDecision
    || (session.waveOutro?.status && !["idle", "completed"].includes(session.waveOutro.status))) return false;
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
  const wave = session.phase.waves[session.waveIndex];
  session.queue = buildSpawnQueue(session.phase, session.waveIndex, session.seed + session.waveIndex * 997, enemyCountFactor);
  initializeBossEncounterForWave(session, wave, session.queue, { row: 2 });
  session.permanentThermalHazards = [];
  session.waveActive = true;
  resumeThermalHazard(session);
  resetAlphaPressureForWave(session);
  session.waveKillStart = session.killed;
  session.lastEnemyKillCandidate = null;
  session.waveOutro = { ...session.waveOutro, status: "idle", elapsedMs: 0, startedAt: null, lastKill: null, decisionOptions: null };
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
  resetTideCycleForWave(session, hazard);
  session.troops.filter((troop) => !troop.dead && troop.type === "demolidora")
    .forEach((troop) => { troop.mineReadyAt = session.elapsed; });
  return true;
}

export function selectDecision(session, option, target = null) {
  if (!session.pendingDecision?.some((entry) => entry.id === option.id)) return false;
  if (option.positional) {
    const validation = validatePositionalTarget(session, option, target);
    if (!validation.valid) return false;
    target = validation.target;
  }
  if (!applyDecision(session, option.id, target)) return false;
  session.decisions.push({ wave: session.waveIndex, level: session.pendingDecisionLevel, id: option.id, ...(target ? { target: { ...target, columns: target.columns ? [...target.columns] : undefined } } : {}) });
  session.pendingDecision = null;
  session.pendingDecisionLevel = null;
  if (option.id === "early_assault") startWave(session);
  return true;
}

// Kept temporarily as a reference while the individual algorithms migrate to
// their behavior modules. New entities are created exclusively by enemyFactory.
function createEnemyLegacy(session, queued) {
  const base = ENEMIES[queued.type];
  if (!base) return null;
  const alpha = queued.variant === "alpha" && base.allowAlphaVariant !== false;
  const echo = Boolean(queued.isEcho);
  const mechanic = session.phase.chapterMechanic;
  const echoHpFactor = echo ? mechanic?.hpFactor ?? 0.45 : 1;
  const echoSpeedFactor = echo ? mechanic?.speedFactor ?? 1.2 : 1;
  const echoDamageFactor = echo ? mechanic?.damageFactor ?? 0.6 : 1;
  const chapterFourAlpha = alpha ? chapterFourAlphaMultipliers(queued.type) : null;
  const alphaHpFactor = chapterFourAlpha?.hp ?? (alpha ? 8 : 1);
  const alphaDamageFactor = chapterFourAlpha?.damage ?? (alpha ? 2 : 1);
  const alphaSpeedFactor = chapterFourAlpha?.speed ?? (alpha ? 0.75 : 1);
  const alphaScaleFactor = chapterFourAlpha?.scale ?? (alpha ? 1.45 : 1);
  const maxHp = base.hp * alphaHpFactor * echoHpFactor * (session.sandboxSettings?.enemyHpMultiplier ?? 1);
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
    speed: base.speed * alphaSpeedFactor * echoSpeedFactor,
    damage: base.damage * alphaDamageFactor * echoDamageFactor,
    attackReadyAt: 0, lastAttackAt: -Infinity,
    casting: false, castStartedAt: -Infinity, castReadyAt: Infinity, moving: true,
    jumpConsumed: false, jumping: false, jumpStartedAt: -Infinity, jumpProgress: 0,
    jumpFromX: null, jumpTargetTroopId: null, attachedToTroopId: null,
    slowUntil: 0, slowFactor: 1, stunnedUntil: 0, cryoFrozenUntil: 0, cryoShockRecoveryUntil: 0,
    emergeState: null, emergeStartedAt: -Infinity, emergeEndsAt: -Infinity,
    bossPhase: isScarabEmperor(base) ? 1 : 0,
    shield: 0, shieldMax: 0, lastShieldPulseAt: -Infinity,
    structuralRuptureHits: 0,
    structuralRuptured: false,
    structuralRuptureAppliedAt: null,
    structuralRuptureDamageTakenFactor: 1,
    meleeAttackPending: false, meleeAttackStartedAt: -Infinity,
    meleeImpactAt: Infinity, meleeTargetId: null,
    salamandraChargeUntil: 0,
    salamandraNextChargeAt: queued.type === "salamandraCinerea"
      ? session.elapsed + (base.charge?.delayAfterSpawnMs || 0)
      : Infinity,
    salamandraCharges: 0,
    salamandraInitialChargeUsed: false,
    nereidaState: queued.type === "carapacaNereida" ? "spawnEmerge" : null,
    nereidaStateStartedAt: queued.type === "carapacaNereida" ? session.elapsed : -Infinity,
    nereidaStateEndsAt: queued.type === "carapacaNereida" ? session.elapsed + base.spawnDurationMs : Infinity,
    nereidaAttackApplied: false, nereidaAttackTargetId: null, nereidaMovementDistance: 0, lastHitAt: -Infinity,
    veuSalinoState: queued.type === "medusaVeuSalino" ? "spawnRise" : null,
    veuSalinoStateStartedAt: queued.type === "medusaVeuSalino" ? session.elapsed : -Infinity,
    veuSalinoStateEndsAt: queued.type === "medusaVeuSalino" ? session.elapsed + base.spawnDurationMs : Infinity,
    veuSalinoNextHealAt: queued.type === "medusaVeuSalino" ? session.elapsed + (base.firstHealDelayMs ?? base.healEveryMs) : Infinity,
    veuSalinoNextAttackAt: queued.type === "medusaVeuSalino" ? session.elapsed : Infinity,
    veuSalinoAttackTargetId: null, veuSalinoProjectileReleased: false, veuSalinoHealApplied: false,
    veuSalinoRetreatTargetX: null, veuSalinoRetreatCheckedAt: -Infinity,
    veuSalinoMovementMode: queued.type === "medusaVeuSalino" ? "advance" : null,
    veuSalinoCoverTargetId: null, veuSalinoCoverCheckedAt: -Infinity, veuSalinoMovementTargetX: null,
    veuSalinoCombatTargetId: null, veuSalinoRetreatStartedAt: -Infinity, veuSalinoRetreatCompletedAt: -Infinity,
    veuSalinoHasAttackPosition: false, veuSalinoHealTargetIds: [],
    mordelumeState: queued.type === "mordelume" ? "spawnEmerge" : null,
    mordelumeStateStartedAt: queued.type === "mordelume" ? session.elapsed : -Infinity,
    mordelumeStateEndsAt: queued.type === "mordelume" ? session.elapsed + base.spawnDurationMs : Infinity,
    mordelumeAttackTargetId: null, mordelumeDamageFramesApplied: [],
    sprintUntil: 0, sprintCooldownUntil: 0, lastSprintCellKey: null,
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
    chapterFourState: base.chapterId === "chapter_04"
      ? (queued.type === "gorjal"
        ? "charge"
        : queued.type === "voltriz" || queued.type === "nimbarca" ? "flying" : "walking")
      : null,
    chapterFourStateStartedAt: base.chapterId === "chapter_04" ? session.elapsed : -Infinity,
    chapterFourStateEndsAt: Infinity,
    chapterFourActionApplied: false,
    stunnedStartedAt: -Infinity,
    nextSpecialAt: queued.type === "gorjal"
      ? Infinity
      : queued.type === "derivante"
        ? session.elapsed + base.breachCheckEveryMs
        : queued.type === "nimbarca"
          ? session.elapsed + (alpha ? 7000 : base.resonancePulseEveryMs)
          : Infinity,
    rooted: false,
    raizTargetLostAt: queued.type === "raizFulgor" ? null : undefined,
    blockedSince: null,
    jumpSourceRow: null,
    jumpSourceY: null,
    jumpTargetRow: null,
    jumpTargetY: null,
    electricAttackTargetId: null,
    voltrizTargetId: null,
    nimbarcaAttackTargetId: null,
    gorjalAttackTargetId: null,
    gorjalChargeTargetId: null,
    gorjalLastChargedTroopId: null,
    gorjalChargeEndX: queued.type === "gorjal"
      ? Math.max(FIELD.baseX, FIELD.spawnX - base.initialChargeMaxTiles * CELL.width)
      : null,
    gorjalChargeCooldownStartedAt: null,
    gorjalInitialCharge: queued.type === "gorjal" && base.initialChargeOnSpawn !== false,
    gorjalInitialChargeCompleted: false,
    gorjalInitialChargeStartedEventSent: false,
    derivanteAttackTargetId: null,
    derivanteBehavior: queued.type === "derivante" ? "hunting" : null,
    derivanteCoverEnemyId: null,
    derivanteCoverTargetDistance: null,
    derivanteCoverLostAt: queued.type === "derivante" ? -Infinity : null,
    derivanteJumpReason: null,
    derivanteJumpSourceX: queued.type === "derivante" ? FIELD.spawnX : null,
    derivanteJumpTargetX: null,
    derivanteNextDodgeAt: queued.type === "derivante" ? session.elapsed + 1500 : null,
    derivanteIncomingProjectileId: null,
    derivanteAttackApplied: false,
    rasgamarState: queued.type === "enguiaRasgamar" ? "spawnSubmerged" : null,
    rasgamarStateStartedAt: queued.type === "enguiaRasgamar" ? session.elapsed : -Infinity,
    rasgamarStateEndsAt: queued.type === "enguiaRasgamar" ? session.elapsed + base.submergedSpawnMs : Infinity,
    rasgamarTargetId: null,
    rasgamarTargetX: null,
    rasgamarPulseIndexes: [],
    rasgamarNextActionAt: queued.type === "enguiaRasgamar" ? session.elapsed + base.submergedSpawnMs : Infinity,
    rasgamarNextExposureAt: queued.type === "enguiaRasgamar" ? session.elapsed + base.idleSurfaceExposureEveryMs : Infinity,
    rasgamarSubmerged: queued.type === "enguiaRasgamar",
    rasgamarPatrolCol: null,
    leviathanState: queued.type === "leviathanNereida" ? "spawnRise" : null,
    leviathanStateStartedAt: queued.type === "leviathanNereida" ? session.elapsed : -Infinity,
    leviathanStateEndsAt: queued.type === "leviathanNereida" ? session.elapsed + base.spawnDurationMs : Infinity,
    leviathanTelegraphStartedAt: null, leviathanTelegraphEndsAt: null,
    leviathanAnimationStartedAt: queued.type === "leviathanNereida" ? session.elapsed : -Infinity,
    leviathanAnimationEndsAt: queued.type === "leviathanNereida" ? session.elapsed + base.spawnDurationMs : Infinity,
    leviathanImpactFrame: null, leviathanImpactApplied: false,
    leviathanPhase: queued.type === "leviathanNereida" ? 1 : 0,
    leviathanPreviousAttack: null, leviathanQueuedAttack: null,
    leviathanNextDecisionAt: queued.type === "leviathanNereida" ? session.elapsed + base.attackDecisionEveryMs : Infinity,
    leviathanGlobalAttackReadyAt: queued.type === "leviathanNereida" ? session.elapsed + base.spawnDurationMs + 1500 : Infinity,
    leviathanTargetRows: [], leviathanTargetCells: [], leviathanTargetTroopIds: [],
    leviathanBodyRow: queued.type === "leviathanNereida" ? base.bossAnchorRow : null,
    leviathanAttackRow: null, leviathanTargetableRows: [], leviathanBrineTargetTroopIds: [],
    leviathanBrineReleasedAt: null, leviathanBrineEndsAt: null, leviathanBrineHitTroopIds: [], leviathanBrineContacts: [],
    leviathanAttackApplied: false, leviathanProjectileReleased: false, leviathanDelugeUsed: false,
    leviathanSubmerged: false, leviathanTargetable: false, leviathanDamageFactor: 1,
    leviathanBiteReadyAt: 0, leviathanTailReadyAt: 0, leviathanBrineReadyAt: 0,
    leviathanVortexReadyAt: 0, leviathanDiveReadyAt: 0, leviathanTideReadyAt: 0,
    leviathanRoarReadyAt: 0, leviathanExposedUntil: 0, leviathanPulseIndex: 0,
    leviathanRouteAttackCounts: queued.type === "leviathanNereida" ? Array(FIELD.rows).fill(0) : null,
    leviathanMoveState: queued.type === "leviathanNereida" ? "idle" : null,
    leviathanHomeX: queued.type === "leviathanNereida"
      ? FIELD.enemyEntryCol * CELL.width + CELL.width / 2
      : null,
    leviathanHomeY: queued.type === "leviathanNereida" ? base.bossAnchorRow * CELL.height + CELL.height / 2 : null,
    leviathanMoveFromX: null, leviathanMoveFromY: null, leviathanMoveToX: null, leviathanMoveToY: null,
    leviathanMoveStartedAt: session.elapsed, leviathanMoveEndsAt: session.elapsed,
    leviathanMoveCurve: "linear", leviathanMoveTargetRow: base.bossAnchorRow,
    leviathanPendingMove: null, leviathanReturningUnderwater: false,
    leviathanSurfaceAnchor: "deepOcean", leviathanAttackStage: null,
    leviathanPreviousRenderX: null, leviathanPreviousRenderY: null,
    summoned: Boolean(queued.summoned),
    summonerId: queued.summonerId || null,
    baseDamage: (alpha ? 40 : base.baseDamage) * echoDamageFactor,
    scale: base.scale * alphaScaleFactor * (echo ? 0.94 : 1),
    previousRenderX: FIELD.spawnX, previousRenderY: 0, dead: false,
  };
  if (base.stationary) enemy.moving = false;
  if (queued.type === "enguiaRasgamar") {
    enemy.x = FIELD.enemyEntryCol * CELL.width + CELL.width / 2;
    enemy.previousRenderX = enemy.x;
    enemy.moving = false;
  }
  if (queued.type === "leviathanNereida") {
    enemy.row = base.bossAnchorRow;
    enemy.x = FIELD.enemyEntryCol * CELL.width + CELL.width / 2;
    enemy.previousRenderX = enemy.x;
    enemy.leviathanPreviousRenderX = enemy.x;
    enemy.leviathanPreviousRenderY = enemy.y;
    enemy.moving = false;
  }
  enemy.y = enemy.row * CELL.height + CELL.height / 2;
  enemy.previousRenderY = enemy.y;
  if (queued.type === "leviathanNereida") enemy.leviathanHomeY = enemy.y;
  session.enemies.push(enemy);
  registerEnemyInIndex(getBattleIndex(session), enemy);
  if (queued.type === "crisalio" && !Number.isFinite(session.prismaticMantle.rows[enemy.row].nextPulseAt)) {
    session.prismaticMantle.rows[enemy.row].nextPulseAt = session.elapsed + base.shieldPulseEveryMs;
  }
  return enemy;
}

function createEnemyRuntime(session, events) {
  return {
    session,
    createId: id,
    get elapsed() { return session.elapsed; },
    configFor: (enemy) => ENEMIES[enemy.type],
    updateScarabEmperor: (enemy, config, dt, events) => updateScarabEmperor(session, enemy, config, dt, events),
    updateWorkerQueen: (enemy, config, dt, events) => updateWorkerQueen(session, enemy, config, dt, events),
    updateWorkerQueenEgg: (enemy, config, events) => updateWorkerQueenEgg(session, enemy, config, events),
    updateDuneRipper: (enemy, config, dt, events) => updateDuneRipper(session, enemy, config, dt, events),
    updateVoltriz: (enemy, config, dt, events) => updateVoltriz(session, enemy, config, dt, events),
    updateNimbarca: (enemy, config, dt, events) => updateNimbarca(session, enemy, config, dt, events),
    updateGorjal: (enemy, config, dt, events) => updateGorjal(session, enemy, config, dt, events),
    updateDerivante: (enemy, config, dt, events) => updateDerivante(session, enemy, config, dt, events),
    updateRaizFulgor: (enemy, config, dt, events) => updateRaizFulgor(session, enemy, config, dt, events),
    updateRasgamar: (enemy, config, dt, events) => updateRasgamar(session, enemy, config, dt, events),
    updateCarapacaNereida: (enemy, config, dt, events) => updateCarapacaNereida(session, enemy, config, dt, events),
    updateMedusaVeuSalino: (enemy, config, dt, events) => updateMedusaVeuSalino(session, enemy, config, dt, events),
    updateMordelume: (enemy, config, dt, events) => updateMordelume(session, enemy, config, dt, events),
    updateSalamandra: (enemy, config, dt, events) => updateSalamandra(session, enemy, config, dt, events),
    updateDevorador: (enemy, config, dt, events) => updateDevorador(session, enemy, config, dt, events),
    updateVermeIncubador: (enemy, config, dt, events) => updateVermeIncubador(session, enemy, config, dt, events),
    updatePredadorCaldeira: (enemy, config, dt, events) => updatePredadorCaldeira(session, enemy, config, dt, events),
    updateCuspidorBrasa: (enemy, config, dt, events) => updateCuspidorBrasa(session, enemy, config, dt, events),
    updateRasgaCeus: (enemy, config, dt, events) => updateRasgaCeus(session, enemy, config, dt, events),
    updateLeviathan: (enemy, config, events) => updateLeviathan(session, enemy, config, { damageTroop, eliminateTroop, refreshTroop: refreshTroopAttackSpeedFactor }, events),
    updateColossoCaldeira: (enemy, config, events) => updateColossoCaldeira(session, enemy, config, {
      damageTroop: (troop, amount) => damageTroop(session, troop, amount, events),
      createMagmaHazard: (row, col, sourceEnemyId, durationMs) => createTemporaryMagmaHazard(session, row, col, sourceEnemyId, durationMs, 550, "colossoRift"),
      enqueueSpawn: (entry) => {
        session.queue.push({ ...entry, packetId: "colosso_rift", block: "boss_rift", sourceIndex: 0, spawnAtMs: Math.max(0, session.elapsed - session.waveStartedAt) });
        session.queue.sort((left, right) => left.spawnAtMs - right.spawnAtMs || left.sourceIndex - right.sourceIndex);
        session.nextSpawnAt = session.waveStartedAt + session.queue[0].spawnAtMs;
      },
      completeDeath: () => { session.killed += 1; },
      clearMagmaHazards: (sourceEnemyId) => {
        for (const hazard of session.temporaryMagmaHazards || []) {
          if (hazard.sourceEnemyId === sourceEnemyId) { hazard.active = false; hazard.endsAt = session.elapsed; }
        }
      },
      deactivatePermanentThermalHazards: (sourceEnemyId) => deactivatePermanentThermalHazards(session, sourceEnemyId),
      clearPermanentThermalHazards: (sourceEnemyId) => clearPermanentThermalHazards(session, sourceEnemyId),
      cancelSummons: () => {
        session.queue = session.queue.filter((entry) => !["boss_rift", "boss_reinforcement"].includes(entry.block));
        session.nextSpawnAt = session.queue.length ? session.waveStartedAt + session.queue[0].spawnAtMs : Infinity;
      },
    }, events),
    setMordelumeState: (enemy, state, duration) => setMordelumeState(session, enemy, state, duration),
    moveEnemy: (enemy, dt, events) => moveEnemy(session, enemy, dt, events),
    closestTroop: (enemy, range) => closestTroopForEnemy(session, enemy, range),
    troopBlockDistance,
    damageTroop: (troop, amount, context = {}) => damageTroop(session, troop, amount, events, context),
    stunTroop: (troop, durationMs) => stunTroop(session, troop, durationMs, events),
    damageConvoy: (amount, context = {}) => damageConvoy(session, amount, events, context),
    canEnemyReachConvoy: (enemy, config) => canEnemyReachConvoy(session, enemy, config),
    hasBlockingTroop: (enemy) => hasBlockingTroop(session, enemy),
    refreshTroopAttackSpeedFactor: (troop) => refreshTroopAttackSpeedFactor(session, troop),
    escortIds: () => [],
    convoyX: () => session.convoy?.x ?? Infinity,
    rng: () => session.rng(),
    troops: () => session.troops,
  };
}

function updateSalamandra(session, enemy, config, dt, events) {
  if (enemy.meleeAttackPending) {
    enemy.moving = false;
    if (session.elapsed >= enemy.meleeImpactAt) {
      const biteTarget = session.troops.find((troop) => troop.id === enemy.meleeTargetId && !troop.dead);
      if (biteTarget && biteTarget.row === enemy.row && enemy.x - biteTarget.x <= troopBlockDistance(biteTarget)) {
        damageTroop(session, biteTarget, enemy.damage, events);
        events.push({ type: "salamandraBite", sourceEnemyId: enemy.id, targetTroopId: biteTarget.id, x: biteTarget.x, y: biteTarget.y });
      }
      enemy.meleeAttackPending = false;
      enemy.meleeImpactAt = Infinity;
      enemy.meleeTargetId = null;
    }
    return;
  }
  const target = closestTroopForEnemy(session, enemy);
  const distance = target ? enemy.x - target.x : Infinity;
  const charging = session.elapsed < enemy.salamandraChargeUntil;
  const initialChargeReady = !enemy.salamandraInitialChargeUsed
    && session.elapsed >= enemy.spawnedAt + (config.charge.delayAfterSpawnMs || 0);
  if (!charging && config.charge.enabled && target
    && ((distance >= config.charge.minDistance && distance <= config.charge.maxDistance) || initialChargeReady)
    && session.elapsed >= enemy.salamandraNextChargeAt) {
    enemy.salamandraChargeUntil = session.elapsed + config.charge.durationMs;
    enemy.salamandraCharges += 1;
    enemy.salamandraInitialChargeUsed = true;
    enemy.salamandraNextChargeAt = session.elapsed + config.charge.cooldownMs;
    session.metrics ??= {};
    session.metrics.salamanderCharges = (session.metrics.salamanderCharges || 0) + 1;
  }
  if (target && distance <= troopBlockDistance(target)) {
    enemy.moving = false;
    if (session.elapsed >= enemy.attackReadyAt) {
      enemy.meleeAttackPending = true;
      enemy.meleeAttackStartedAt = session.elapsed;
      enemy.meleeImpactAt = session.elapsed + config.attackVisual.impactMs;
      enemy.meleeTargetId = target.id;
      enemy.attackReadyAt = session.elapsed + config.attackEveryMs;
      enemy.lastAttackAt = session.elapsed;
    }
    return;
  }
  enemy.moving = true;
  const originalSpeed = enemy.speed;
  if (charging) enemy.speed *= config.charge.speedMultiplier;
  moveEnemy(session, enemy, dt, events);
  enemy.speed = originalSpeed;
}

function setDevoradorState(session, enemy, state, durationMs = Infinity) {
  enemy.devoradorState = state;
  enemy.devoradorStateStartedAt = session.elapsed;
  enemy.devoradorStateEndsAt = Number.isFinite(durationMs) ? session.elapsed + durationMs : Infinity;
  enemy.devoradorImpactApplied = false;
}

function updateDevorador(session, enemy, config, dt, events) {
  const frenzy = enemy.devoradorFrenzy;
  if (!enemy.devoradorFrenzyTriggered && enemy.hp / enemy.maxHp <= config.frenzyThreshold) {
    enemy.devoradorFrenzyTriggered = true;
    enemy.armorDamageFactor = config.frenzyArmorDamageFactor;
    if (["attack", "crushingBite"].includes(enemy.devoradorState)) enemy.devoradorFrenzyPending = true;
    else setDevoradorState(session, enemy, "frenzyTransition", config.frenzyTransitionVisual.durationMs);
  }
  if (enemy.devoradorState === "frenzyTransition") {
    enemy.moving = false;
    if (session.elapsed >= enemy.devoradorStateEndsAt) {
      enemy.devoradorFrenzy = true;
      enemy.devoradorFrenzyPending = false;
      setDevoradorState(session, enemy, "walking");
    }
    return;
  }
  const target = enemy.devoradorTargetId
    ? session.troops.find((troop) => troop.id === enemy.devoradorTargetId && !troop.dead)
    : null;
  if (["attack", "crushingBite"].includes(enemy.devoradorState)) {
    enemy.moving = false;
    if (!enemy.devoradorImpactApplied && session.elapsed >= enemy.devoradorStateStartedAt
      + (enemy.devoradorState === "crushingBite" ? config.crushingBiteVisual.impactMs : config.attackVisual.impactMs)) {
      enemy.devoradorImpactApplied = true;
      const valid = target && target.row === enemy.row
        && Math.abs(enemy.x - target.x) <= config.meleeContactDistancePx;
      if (valid) {
        const crushing = enemy.devoradorState === "crushingBite";
        damageTroop(session, target, crushing ? config.crushingBiteDamage : config.damage, events, { sourceEnemyId: enemy.id });
        enemy.devoradorSuccessfulBites += 1;
        if (crushing) {
          stunTroop(session, target, config.crushingBiteStunMs, events);
          events.push({ type: "devoradorCrushingBite", sourceEnemyId: enemy.id, targetTroopId: target.id, x: target.x, y: target.y });
        } else events.push({ type: "devoradorBite", sourceEnemyId: enemy.id, targetTroopId: target.id, x: target.x, y: target.y });
      }
    }
    if (session.elapsed >= enemy.devoradorStateEndsAt) {
      enemy.devoradorTargetId = null;
      if (enemy.devoradorFrenzyPending) {
        enemy.devoradorFrenzyPending = false;
        setDevoradorState(session, enemy, "frenzyTransition", config.frenzyTransitionVisual.durationMs);
      } else setDevoradorState(session, enemy, "walking");
    }
    return;
  }
  const currentTarget = target && target.row === enemy.row ? target : closestTroopForEnemy(session, enemy);
  const distance = currentTarget ? enemy.x - currentTarget.x : Infinity;
  if (currentTarget && Math.abs(distance) <= config.meleeContactDistancePx) {
    enemy.moving = false;
    if (session.elapsed >= enemy.attackReadyAt) {
      const crushing = (enemy.devoradorSuccessfulBites + 1) % config.crushingBiteEvery === 0;
      enemy.devoradorTargetId = currentTarget.id;
      enemy.devoradorCrushing = crushing;
      setDevoradorState(session, enemy, crushing ? "crushingBite" : "attack", crushing ? config.crushingBiteVisual.durationMs : config.attackVisual.durationMs);
      enemy.attackReadyAt = session.elapsed + config.attackEveryMs / (frenzy ? config.frenzyAttackSpeedFactor : 1);
      enemy.lastAttackAt = session.elapsed;
    }
    return;
  }
  // Sem tropas na rota ele continua avançando até a base; a patrulha não deve congelar.
  enemy.moving = true;
  const originalSpeed = enemy.speed;
  enemy.speed = config.speed * (frenzy ? config.frenzySpeedFactor : 1);
  moveEnemy(session, enemy, dt, events);
  enemy.speed = originalSpeed;
}

function setPredadorState(session, enemy, state, durationMs = Infinity) {
  enemy.predatorState = state;
  enemy.predatorStateStartedAt = session.elapsed;
  enemy.predatorStateEndsAt = Number.isFinite(durationMs) ? session.elapsed + durationMs : Infinity;
  enemy.predatorClawApplied = false;
  enemy.predatorBiteApplied = false;
  enemy.moving = state === "walking" || state === "hunting";
}

function predatorMovementSpeed(enemy, config) {
  const huntFactor = enemy.predatorState === "hunting" ? config.hunt.speedMultiplier : 1;
  const frenzyFactor = enemy.predatorFrenzy ? config.frenzySpeedFactor : 1;
  return config.speed * huntFactor * frenzyFactor;
}

function updatePredadorCaldeira(session, enemy, config, dt, events) {
  if (!enemy.predatorFrenzyTriggered && enemy.hp / Math.max(1, enemy.maxHp) <= config.frenzyThreshold) {
    enemy.predatorFrenzyTriggered = true;
    enemy.armorDamageFactor = config.frenzyArmorDamageFactor;
    if (enemy.predatorState === "attackCombo") enemy.predatorFrenzyPending = true;
    else {
      setPredadorState(session, enemy, "frenzyTransition", config.frenzyTransitionVisual.durationMs);
      events.push({ type: "predatorFrenzy", sourceEnemyId: enemy.id, x: enemy.x, y: enemy.y });
    }
  }

  if (enemy.predatorState === "frenzyTransition") {
    enemy.moving = false;
    if (session.elapsed >= enemy.predatorStateEndsAt) {
      enemy.predatorFrenzy = true;
      enemy.predatorFrenzyPending = false;
      setPredadorState(session, enemy, "walking");
    }
    return;
  }

  if (enemy.predatorState === "idle" && session.elapsed < enemy.predatorStateEndsAt) {
    enemy.moving = false;
    return;
  }

  const lockedTarget = enemy.predatorTargetId
    ? session.troops.find((troop) => troop.id === enemy.predatorTargetId && !troop.dead)
    : null;
  if (enemy.predatorState === "attackCombo") {
    enemy.moving = false;
    const age = session.elapsed - enemy.predatorStateStartedAt;
    const validTarget = lockedTarget && lockedTarget.row === enemy.row
      && enemy.x - lockedTarget.x <= config.meleeContactDistancePx;
    if (!enemy.predatorClawApplied && age >= config.attackVisual.clawImpactMs) {
      enemy.predatorClawApplied = true;
      if (validTarget) {
        damageTroop(session, lockedTarget, config.clawDamage, events, { sourceEnemyId: enemy.id });
        events.push({ type: "predatorClaw", sourceEnemyId: enemy.id, targetTroopId: lockedTarget.id, x: lockedTarget.x, y: lockedTarget.y });
      }
    }
    if (!enemy.predatorBiteApplied && age >= config.attackVisual.biteImpactMs) {
      enemy.predatorBiteApplied = true;
      if (validTarget) {
        damageTroop(session, lockedTarget, config.biteDamage, events, { sourceEnemyId: enemy.id });
        events.push({ type: "predatorBite", sourceEnemyId: enemy.id, targetTroopId: lockedTarget.id, x: lockedTarget.x, y: lockedTarget.y });
      }
    }
    if (session.elapsed >= enemy.predatorStateEndsAt) {
      enemy.predatorTargetId = null;
      if (enemy.predatorFrenzyPending) {
        enemy.predatorFrenzyPending = false;
        setPredadorState(session, enemy, "frenzyTransition", config.frenzyTransitionVisual.durationMs);
        events.push({ type: "predatorFrenzy", sourceEnemyId: enemy.id, x: enemy.x, y: enemy.y });
      } else setPredadorState(session, enemy, "idle", 120);
    }
    return;
  }

  const target = closestTroopForEnemy(session, enemy);
  const distance = target ? enemy.x - target.x : Infinity;
  if (target && distance <= config.meleeContactDistancePx) {
    enemy.moving = false;
    if (session.elapsed >= enemy.attackReadyAt) {
      enemy.predatorTargetId = target.id;
      const attackFactor = enemy.predatorFrenzy ? config.frenzyAttackSpeedFactor : 1;
      setPredadorState(session, enemy, "attackCombo", config.attackVisual.durationMs / (enemy.predatorFrenzy ? config.frenzyAnimationSpeedFactor : 1));
      enemy.attackReadyAt = session.elapsed + config.attackEveryMs / attackFactor;
      enemy.lastAttackAt = session.elapsed;
    }
    return;
  }

  const inHuntZone = target && distance > config.meleeContactDistancePx
    && (distance <= config.hunt.maxDistanceTiles * CELL.width || enemy.predatorState === "hunting");
  const desiredState = inHuntZone ? "hunting" : "walking";
  if (enemy.predatorState !== desiredState) setPredadorState(session, enemy, desiredState);
  enemy.moving = true;
  const originalSpeed = enemy.speed;
  enemy.speed = predatorMovementSpeed(enemy, config);
  moveEnemy(session, enemy, dt, events);
  enemy.speed = originalSpeed;
}

function setCuspidorState(session, enemy, state, durationMs = Infinity) {
  if (enemy.cuspidorState !== state) enemy.cuspidorStateStartedAt = session.elapsed;
  enemy.cuspidorState = state;
  enemy.cuspidorStateEndsAt = Number.isFinite(durationMs) ? session.elapsed + durationMs : Infinity;
  enemy.moving = state === "walking" || state === "reposition";
}

function launchCuspidorEmberGlob(session, enemy, config, events) {
  const targetX = Number(enemy.cuspidorTargetX);
  const targetY = Number(enemy.cuspidorTargetY);
  if (!Number.isFinite(targetX) || !Number.isFinite(targetY)) return null;
  const origin = getEnemyMuzzleWorldPosition(
    enemy,
    config,
    "attack",
    config.attackVisual.releaseFrame,
  );
  const distance = Math.max(1, origin.x - targetX);
  const flightMs = Math.max(80, distance / Math.max(1, config.projectileSpeed) * 1000);
  const projectile = {
    id: id("enemy_projectile"), kind: "emberGlob", visualKind: "emberGlob",
    sourceEnemyId: enemy.id, targetTroopId: enemy.cuspidorTargetId,
    targetRow: enemy.cuspidorTargetRow, targetX, targetY,
    x: origin.x, y: origin.y, previousX: origin.x, previousY: origin.y,
    previousRenderX: origin.x, previousRenderY: origin.y,
    startX: origin.x, startY: origin.y, flightMs,
    vx: -config.projectileSpeed, vy: 0, arcHeight: config.projectileArcHeight,
    damage: config.damage, splashDamage: config.splashDamage,
    splashRadiusPx: config.splashRadiusPx, splashSameRowOnly: config.splashSameRowOnly,
    burnDamagePerSecond: config.burnDamagePerSecond, burnDurationMs: config.burnDurationMs,
    burnTickEveryMs: config.burnTickEveryMs, color: "#f97316", active: true, launched: true,
    trail: createProjectileTrail(14, origin.x, origin.y), ageMs: 0, seed: nextEffectSeed(session),
  };
  session.enemyProjectiles.push(projectile);
  events.push({
    type: "emberGlobLaunched", sourceEnemyId: enemy.id, targetTroopId: enemy.cuspidorTargetId,
    x: origin.x, y: origin.y, targetX, targetY, color: projectile.color, seed: projectile.seed,
  });
  return projectile;
}

function updateCuspidorBrasa(session, enemy, config, dt, events) {
  if (enemy.cuspidorState === "attack") {
    enemy.moving = false;
    const age = session.elapsed - enemy.cuspidorStateStartedAt;
    if (!enemy.cuspidorProjectileReleased && age >= config.attackVisual.releaseMs) {
      launchCuspidorEmberGlob(session, enemy, config, events);
      enemy.cuspidorProjectileReleased = true;
    }
    if (session.elapsed >= enemy.cuspidorStateEndsAt) {
      enemy.cuspidorTargetId = null;
      enemy.cuspidorTargetX = null;
      enemy.cuspidorTargetY = null;
      enemy.cuspidorTargetRow = null;
      enemy.cuspidorProjectileReleased = false;
      const target = closestTroopForEnemy(session, enemy);
      const minimumDistance = config.minimumAttackRangeTiles * CELL.width;
      const desiredTargetX = enemy.x - config.repositionDistanceTiles * CELL.width;
      enemy.cuspidorRepositionTargetX = target
        ? Math.max(desiredTargetX, target.x + minimumDistance)
        : desiredTargetX;
      setCuspidorState(session, enemy, "reposition");
    }
    return;
  }

  if (enemy.cuspidorState === "reposition") {
    const repositionTargetX = Number(enemy.cuspidorRepositionTargetX);
    if (Number.isFinite(repositionTargetX) && enemy.x > repositionTargetX) {
      moveEnemyTowardX(session, enemy, repositionTargetX, dt, events, 3);
      return;
    }
    enemy.cuspidorRepositionTargetX = null;
    setCuspidorState(session, enemy, "idle");
  }

  const target = closestTroopForEnemy(session, enemy);
  const distance = target ? enemy.x - target.x : Infinity;
  if (!target || distance > config.maximumAttackRangeTiles * CELL.width) {
    if (enemy.cuspidorState !== "walking") setCuspidorState(session, enemy, "walking");
    enemy.moving = true;
    moveEnemy(session, enemy, dt, events);
    return;
  }

  enemy.moving = false;
  if (enemy.cuspidorState !== "idle") setCuspidorState(session, enemy, "idle");
  if (session.elapsed >= enemy.cuspidorAttackReadyAt) {
    enemy.cuspidorTargetId = target.id;
    enemy.cuspidorTargetX = target.x;
    enemy.cuspidorTargetY = target.y - 18;
    enemy.cuspidorTargetRow = target.row;
    enemy.cuspidorProjectileReleased = false;
    enemy.cuspidorAttackReadyAt = session.elapsed + config.attackEveryMs;
    enemy.lastAttackAt = session.elapsed;
    setCuspidorState(session, enemy, "attack", config.attackVisual.durationMs);
  }
}

function setIncubatorState(session, enemy, state, durationMs = Infinity) {
  enemy.incubatorState = state;
  enemy.incubatorStateStartedAt = session.elapsed;
  enemy.incubatorStateEndsAt = Number.isFinite(durationMs) ? session.elapsed + durationMs : Infinity;
  enemy.incubationImpactApplied = false;
}

function incubatorTargetCandidates(session, enemy, config) {
  return session.troops.filter((troop) => {
    if (troop.dead || isTroopThermalCompatible(TROOPS[troop.type])) return false;
    if (getThermalPlatformAt(session, troop.row, troop.col) || isSessionMagmaCell(session, troop.row, troop.col)) return false;
    const key = `${troop.row}:${troop.col}`;
    return Number(enemy.incubatorRecentTargets?.[key] || 0) <= session.elapsed;
  });
}

function selectIncubatorTarget(session, enemy, config) {
  const candidates = incubatorTargetCandidates(session, enemy, config);
  if (!candidates.length) return null;
  const weighted = candidates.map((troop) => {
    const troopConfig = TROOPS[troop.type] || {};
    const weight = troopConfig.unitKind === "support" || troopConfig.role === "support" ? 1.4
      : troopConfig.range > 0 ? 1.2 : 1;
    return { troop, weight };
  });
  const total = weighted.reduce((sum, entry) => sum + entry.weight, 0);
  let roll = session.rng() * total;
  return weighted.find((entry) => (roll -= entry.weight) <= 0)?.troop || weighted.at(-1).troop;
}

function incubatorBeginBurrow(session, enemy, target, config) {
  enemy.incubatorOriginRow = enemy.row;
  enemy.incubatorOriginX = enemy.x;
  enemy.incubatorOriginY = enemy.y;
  enemy.incubatorTargetTroopId = target.id;
  enemy.incubatorTargetRow = target.row;
  enemy.incubatorTargetCol = target.col;
  enemy.incubatorTargetX = target.x;
  enemy.incubatorTargetY = target.y;
  setIncubatorState(session, enemy, "burrowOrigin", config.burrowDurationMs);
}

function updateVermeIncubador(session, enemy, config, dt, events) {
  const state = enemy.incubatorState;
  if (["undergroundToTarget", "undergroundReturn"].includes(state)) {
    enemy.moving = false;
    if (session.elapsed >= enemy.incubatorStateEndsAt) {
      if (state === "undergroundToTarget") {
        enemy.row = enemy.incubatorTargetRow;
        enemy.x = enemy.incubatorTargetX + config.targetEmergenceOffsetTiles * CELL.width;
        enemy.y = enemy.row * CELL.height + CELL.height / 2;
        enemy.previousRenderX = enemy.x;
        enemy.previousRenderY = enemy.y;
        enemy.incubatorSubmerged = false;
        enemy.incubatorReturning = false;
        setIncubatorState(session, enemy, "emerging", config.emergeDurationMs);
      } else {
        enemy.row = enemy.incubatorOriginRow;
        enemy.x = enemy.incubatorOriginX;
        enemy.y = enemy.incubatorOriginY;
        enemy.previousRenderX = enemy.x;
        enemy.previousRenderY = enemy.y;
        enemy.incubatorSubmerged = false;
        enemy.incubatorReturning = true;
        enemy.nextIncubationAt = session.elapsed + config.incubationCooldownMs;
        setIncubatorState(session, enemy, "emerging", config.returnEmergeDurationMs);
      }
    }
    return;
  }
  if (["burrowOrigin", "burrowTarget"].includes(state)) {
    enemy.moving = false;
    if (session.elapsed >= enemy.incubatorStateEndsAt) {
      enemy.incubatorSubmerged = true;
      setIncubatorState(session, enemy, state === "burrowOrigin" ? "undergroundToTarget" : "undergroundReturn",
        state === "burrowOrigin" ? config.undergroundTravelMs : config.returnTravelMs);
    }
    return;
  }
  if (state === "emerging") {
    enemy.moving = false;
    if (session.elapsed >= enemy.incubatorStateEndsAt) {
      if (!enemy.incubatorReturning && enemy.incubatorTargetTroopId && !enemy.incubationImpactApplied) {
        setIncubatorState(session, enemy, "incubateAttack", config.incubationAttackVisual.durationMs);
      }
      else setIncubatorState(session, enemy, "crawl");
    }
    return;
  }
  if (state === "incubateAttack") {
    enemy.moving = false;
    if (!enemy.incubationImpactApplied && session.elapsed >= enemy.incubatorStateStartedAt + config.incubationAttackVisual.impactMs) {
      enemy.incubationImpactApplied = true;
      const hazard = createTemporaryMagmaEruption(session, enemy.incubatorTargetRow, enemy.incubatorTargetCol, enemy.id, config.eruptionDurationMs, config.fissureCloseVisualMs);
      const key = `${enemy.incubatorTargetRow}:${enemy.incubatorTargetCol}`;
      enemy.incubatorRecentTargets[key] = session.elapsed + config.recentTargetCooldownMs;
      events.push({ type: "incubatorEruption", hazardId: hazard.id, sourceEnemyId: enemy.id, row: hazard.row, col: hazard.col, x: hazard.col * CELL.width + CELL.width / 2, y: hazard.row * CELL.height + CELL.height / 2 });
    }
    if (session.elapsed >= enemy.incubatorStateEndsAt) setIncubatorState(session, enemy, "burrowTarget", config.targetBurrowDurationMs);
    return;
  }
  if (state === "attack") {
    enemy.moving = false;
    if (!enemy.incubationImpactApplied && session.elapsed >= enemy.incubatorStateStartedAt + config.attackVisual.impactMs) {
      enemy.incubationImpactApplied = true;
      const target = session.troops.find((troop) => troop.id === enemy.incubatorTargetTroopId && !troop.dead);
      if (target && target.row === enemy.row && Math.abs(enemy.x - target.x) <= config.meleeContactDistancePx) damageTroop(session, target, config.damage, events, { sourceEnemyId: enemy.id });
    }
    if (session.elapsed >= enemy.incubatorStateEndsAt) setIncubatorState(session, enemy, "crawl");
    return;
  }
  if (state === "crawl") {
    enemy.moving = true;
    if (session.elapsed >= enemy.nextIncubationAt
      && (session.temporaryMagmaHazards || []).filter((hazard) => hazard.active).length < config.maxConcurrentFissures) {
      const target = selectIncubatorTarget(session, enemy, config);
      if (target) {
        incubatorBeginBurrow(session, enemy, target, config);
        return;
      }
    }
    const target = session.troops.find((troop) => !troop.dead && troop.row === enemy.row && troop.x <= enemy.x
      && enemy.x - troop.x <= config.meleeContactDistancePx);
    if (target && session.elapsed >= enemy.attackReadyAt) {
      enemy.incubatorTargetTroopId = target.id;
      enemy.incubationImpactApplied = false;
      setIncubatorState(session, enemy, "attack", config.attackVisual.durationMs);
      enemy.attackReadyAt = session.elapsed + config.attackEveryMs;
      enemy.lastAttackAt = session.elapsed;
      return;
    }
    moveEnemy(session, enemy, dt, events);
  }
}

function setRasgaCeusState(session, enemy, state, durationMs = Infinity) {
  enemy.rasgaCeusState = state;
  enemy.rasgaCeusStateStartedAt = session.elapsed;
  enemy.rasgaCeusStateEndsAt = Number.isFinite(durationMs) ? session.elapsed + durationMs : Infinity;
}

function rasgaCeusTargetScore(session, enemy, troop) {
  const config = TROOPS[troop.type] || {};
  const weight = config.role === "support" || config.tags?.includes("support") ? 3
    : config.range >= 5 ? 2 : config.tags?.includes("frontline") ? 1 : 1.5;
  return weight + session.rng() * 0.15 - Math.abs(enemy.x - troop.x) / (CELL.width * 100);
}

function selectRasgaCeusTarget(session, enemy, config) {
  const direction = enemy.flightDirection || -1;
  return session.troops
    .filter((troop) => !troop.dead && troop.row === enemy.row
      && troop.type !== "thermalPlatform" && troop.unitKind !== "support"
      && (troop.x - enemy.x) * direction >= -config.huntBehindTiles * CELL.width
      && (troop.x - enemy.x) * direction <= config.huntAheadTiles * CELL.width)
    .sort((left, right) => rasgaCeusTargetScore(session, enemy, right) - rasgaCeusTargetScore(session, enemy, left))[0] || null;
}

function rasgaCeusBezier(p0, p1, p2, p3, t) {
  const u = 1 - t;
  return u ** 3 * p0 + 3 * u ** 2 * t * p1 + 3 * u * t ** 2 * p2 + t ** 3 * p3;
}

function rasgaCeusLivingTroopsInRow(session, row) {
  return session.troops.filter((troop) => !troop.dead && troop.hp > 0 && troop.row === row
    && troop.type !== "thermalPlatform" && troop.unitKind !== "support");
}

function updateRasgaCeusPatrolBounds(session, enemy, config) {
  const troops = rasgaCeusLivingTroopsInRow(session, enemy.row);
  if (!troops.length) return null;
  const left = Math.min(...troops.map((troop) => troop.x));
  const right = Math.max(...troops.map((troop) => troop.x));
  const minimumSpan = config.minimumPatrolSpanTiles * CELL.width;
  const center = (left + right) / 2;
  const span = Math.max(minimumSpan, right - left + config.patrolPaddingTiles * 2 * CELL.width);
  enemy.patrolMinX = Math.max(FIELD.baseX + 24, center - span / 2);
  enemy.patrolMaxX = Math.min(FIELD.width - 24, center + span / 2);
  return troops;
}

function moveRasgaCeusDirectional(session, enemy, config, dt, speedFactor = 1) {
  const speed = config.speed * speedFactor * session.modifiers.enemySpeed
    * (session.sandboxSettings?.enemySpeedMultiplier ?? 1);
  enemy.x += enemy.flightDirection * speed * dt / 1000;
  enemy.visualFacing = enemy.flightDirection;
}

function moveRasgaCeusPatrol(session, enemy, config, dt) {
  const troops = updateRasgaCeusPatrolBounds(session, enemy, config);
  if (!troops) return false;
  const patrolSpeedFactor = enemy.rasgaCeusState === "turning"
    ? Math.min(1, Math.abs(session.elapsed - enemy.rasgaCeusStateStartedAt - config.turnDurationMs / 2) / (config.turnDurationMs / 2))
    : 1;
  moveRasgaCeusDirectional(session, enemy, config, dt, patrolSpeedFactor);
  if (enemy.rasgaCeusState === "turning") {
    if (session.elapsed - enemy.rasgaCeusStateStartedAt >= config.turnDurationMs) {
      enemy.patrolPass = (enemy.patrolPass || 0) + 1;
      enemy.visualFacing = enemy.flightDirection;
      setRasgaCeusState(session, enemy, "cruise");
    }
    return true;
  }
  const atEdge = enemy.flightDirection < 0 ? enemy.x <= enemy.patrolMinX : enemy.x >= enemy.patrolMaxX;
  if (atEdge) {
    enemy.x = enemy.flightDirection < 0 ? enemy.patrolMinX : enemy.patrolMaxX;
    enemy.turnFromDirection = enemy.flightDirection;
    enemy.flightDirection *= -1;
    enemy.visualFacing = enemy.flightDirection;
    setRasgaCeusState(session, enemy, "turning", config.turnDurationMs);
  }
  return true;
}

function updateRasgaCeus(session, enemy, config, dt, events) {
  const state = enemy.rasgaCeusState;
  enemy.airborne = true;
  enemy.moving = true;
  enemy.groundRangedTargetable = enemy.flightAltitude <= config.groundTargetAltitude;
  if (state === "spawnFlight") {
    const progress = Math.min(1, (session.elapsed - enemy.rasgaCeusStateStartedAt) / 700);
    enemy.flightAltitude = config.maximumFlightAltitude - (config.maximumFlightAltitude - config.cruiseAltitude) * progress;
    if (progress >= 1) setRasgaCeusState(session, enemy, "cruise");
    if (rasgaCeusLivingTroopsInRow(session, enemy.row).length) moveRasgaCeusPatrol(session, enemy, config, dt);
    else {
      setRasgaCeusState(session, enemy, "baseApproach");
      enemy.flightDirection = -1;
      enemy.visualFacing = -1;
    }
    return;
  }
  if (state === "baseApproach") {
    if (rasgaCeusLivingTroopsInRow(session, enemy.row).length) {
      enemy.nextDiveAt = session.elapsed + 600;
      setRasgaCeusState(session, enemy, "cruise");
      return;
    }
    enemy.flightAltitude = config.cruiseAltitude;
    enemy.flightDirection = -1;
    enemy.visualFacing = -1;
    enemy.speed = config.speed * config.baseApproachSpeedFactor;
    moveEnemy(session, enemy, dt, events);
    enemy.speed = config.speed;
    return;
  }
  if ((state === "cruise" || state === "turning") && !rasgaCeusLivingTroopsInRow(session, enemy.row).length) {
    setRasgaCeusState(session, enemy, "baseApproach");
    enemy.flightDirection = -1;
    return;
  }
  if (state === "turning") {
    enemy.flightAltitude = config.cruiseAltitude;
    enemy.groundRangedTargetable = false;
    moveRasgaCeusPatrol(session, enemy, config, dt);
    return;
  }
  if (state === "targeting") {
    const target = session.troops.find((troop) => troop.id === enemy.diveTargetId && !troop.dead);
    if (!target) {
      enemy.diveTargetId = null;
      enemy.nextDiveAt = session.elapsed + 1800;
      setRasgaCeusState(session, enemy, "cruise");
      return;
    }
    moveRasgaCeusDirectional(session, enemy, config, dt, 0.65);
    if (session.elapsed >= enemy.rasgaCeusStateEndsAt) {
      enemy.diveFromX = enemy.x;
      enemy.diveFromAltitude = enemy.flightAltitude;
      enemy.preDiveDirection = enemy.flightDirection;
      enemy.diveTargetX = target.x + config.strikeStandOffTiles * CELL.width;
      enemy.diveTargetY = target.y;
      enemy.diveStartedAt = session.elapsed;
      enemy.strikeConsumed = false;
      setRasgaCeusState(session, enemy, "diving", config.diveDurationMs);
      session.metrics ??= {};
      session.metrics.rasgaCeusDives = (session.metrics.rasgaCeusDives || 0) + 1;
    }
    return;
  }
  if (state === "diving") {
    const progress = Math.min(1, (session.elapsed - enemy.diveStartedAt) / config.diveDurationMs);
    const approachDirection = enemy.preDiveDirection || -1;
    enemy.x = rasgaCeusBezier(
      enemy.diveFromX,
      enemy.diveFromX + approachDirection * 35,
      enemy.diveTargetX - approachDirection * 25,
      enemy.diveTargetX,
      progress,
    );
    enemy.flightAltitude = config.strikeAltitude + (enemy.diveFromAltitude - config.strikeAltitude) * (1 - progress);
    enemy.groundRangedTargetable = true;
    if (progress >= 1) {
      setRasgaCeusState(session, enemy, "strike", 120);
      const target = session.troops.find((troop) => troop.id === enemy.diveTargetId && !troop.dead);
      if (!enemy.strikeConsumed && target && target.row === enemy.row) {
        damageTroop(session, target, config.damage, events);
        session.metrics ??= {};
        session.metrics.rasgaCeusSuccessfulStrikes = (session.metrics.rasgaCeusSuccessfulStrikes || 0) + 1;
        events.push({ type: "rasgaCeusStrike", sourceEnemyId: enemy.id, targetTroopId: target.id, x: target.x, y: target.y });
      }
      enemy.strikeConsumed = true;
    }
    return;
  }
  if (state === "strike") {
    enemy.flightAltitude = config.strikeAltitude;
    if (!enemy.strikeConsumed) {
      const target = session.troops.find((troop) => troop.id === enemy.diveTargetId && !troop.dead);
      if (target && target.row === enemy.row) {
        damageTroop(session, target, config.damage, events);
        session.metrics ??= {};
        session.metrics.rasgaCeusSuccessfulStrikes = (session.metrics.rasgaCeusSuccessfulStrikes || 0) + 1;
        events.push({ type: "rasgaCeusStrike", sourceEnemyId: enemy.id, targetTroopId: target.id, x: target.x, y: target.y });
      }
      enemy.strikeConsumed = true;
    }
    if (session.elapsed >= enemy.rasgaCeusStateEndsAt) setRasgaCeusState(session, enemy, "climbing", config.climbDurationMs);
    return;
  }
  if (state === "climbing") {
    const progress = Math.min(1, (session.elapsed - enemy.rasgaCeusStateStartedAt) / config.climbDurationMs);
    enemy.x += config.climbForwardTiles * CELL.width * dt / config.climbDurationMs;
    enemy.visualFacing = enemy.x >= enemy.diveTargetX ? 1 : enemy.visualFacing;
    enemy.flightAltitude = config.strikeAltitude + (config.cruiseAltitude - config.strikeAltitude) * progress;
    enemy.groundRangedTargetable = enemy.flightAltitude <= config.groundTargetAltitude;
    if (progress >= 1) {
      enemy.nextDiveAt = session.elapsed + config.diveCooldownMs + Math.floor(session.rng() * 2000);
      enemy.diveTargetId = null;
      enemy.flightDirection = enemy.preDiveDirection || enemy.flightDirection;
      enemy.visualFacing = enemy.flightDirection;
      setRasgaCeusState(session, enemy, "cruise");
    }
    return;
  }
  if (state === "cruise") {
    enemy.flightAltitude = config.cruiseAltitude;
    enemy.groundRangedTargetable = false;
    if (session.elapsed >= enemy.nextDiveAt) {
      const target = selectRasgaCeusTarget(session, enemy, config);
      if (target) {
        enemy.diveTargetId = target.id;
        setRasgaCeusState(session, enemy, "targeting", config.targetLockMs);
        session.metrics ??= {};
        session.metrics.rasgaCeusTargetsMarked = (session.metrics.rasgaCeusTargetsMarked || 0) + 1;
        events.push({ type: "rasgaCeusTargetMarked", sourceEnemyId: enemy.id, targetTroopId: target.id, x: target.x, y: target.y });
        return;
      }
    }
    moveRasgaCeusPatrol(session, enemy, config, dt);
  }
}

function createEnemy(session, queued) {
  const config = ENEMIES[queued.type];
  if (!config) return null;
  const firstLivingCrisalio = queued.type === "crisalio"
    && !session.enemies.some((entry) => !entry.dead && entry.type === "crisalio");
  const { enemy } = createEnemyEntity(session, queued, config, id);
  session.enemies.push(enemy);
  registerEnemyInIndex(getBattleIndex(session), enemy);
  if (queued.type === "crisalio" && !Number.isFinite(session.prismaticMantle.rows[enemy.row].nextPulseAt)) {
    session.prismaticMantle.rows[enemy.row].nextPulseAt = session.elapsed + config.shieldPulseEveryMs;
  }
  return enemy;
}

function scheduleAlphaPressureSpawn(session, result, events) {
  const spawnAt = session.elapsed + result.warningMs;
  const scheduled = [{
    type: result.type,
    row: result.row,
    variant: "alpha",
    alphaModifiers: CHAPTER_SIX_ALPHA_MODIFIERS,
    spawnSource: "alphaPressure",
    spawnAt,
  }];
  session.alphaPressure.pendingSpawns.push(...scheduled);
  events.push({
    type: "chapterSixAlphaPressureTriggered",
    troopCount: result.troopCount,
    chance: result.chance,
    alphaCount: 1,
    row: result.row,
    enemyType: result.type,
    warningMs: result.warningMs,
  });
}

function updateAlphaPressureSpawns(session, events) {
  const state = session.alphaPressure;
  if (!state?.pendingSpawns?.length || (!session.waveActive && !session.sandbox)) return;
  const pending = [];
  for (const scheduled of state.pendingSpawns) {
    if (session.elapsed < scheduled.spawnAt) {
      pending.push(scheduled);
      continue;
    }
    const enemy = createEnemy(session, scheduled);
    if (!enemy) continue;
    state.totalAlphaSpawned += 1;
    state.spawnsThisWave += 1;
    session.metrics.alphaPressure.spawned += 1;
    events.push({ type: "spawn", x: enemy.x, y: enemy.y, enemy });
  }
  state.pendingSpawns = pending;
}

function enqueueBossReinforcement(session, packetKey) {
  return enqueueBossReinforcementSystem(session, packetKey, {
    packets: session.bossEncounter?.packetCatalog === "chapterSix" ? CHAPTER_SIX_PACKETS : CHAPTER_FIVE_PACKETS,
    fieldRows: FIELD.rows,
  });
}

function livingEnemyCount(session) {
  return session.enemies.reduce((count, enemy) => count + Number(!enemy.dead), 0);
}

function deferChapterFivePacket(session, packetId, delayMs = 750) {
  session.queue.forEach((entry) => {
    if (entry.packetId === packetId) entry.spawnAtMs += delayMs;
  });
  session.queue.sort((left, right) => left.spawnAtMs - right.spawnAtMs
    || String(left.packetId || "").localeCompare(String(right.packetId || ""))
    || left.sourceIndex - right.sourceIndex);
  session.nextSpawnAt = session.waveStartedAt + (session.queue[0]?.spawnAtMs ?? Infinity);
}

function shouldDeferChapterFiveSpawn(session, queued) {
  const maximum = session.phase.waves[session.waveIndex]?.maximumLivingEnemies;
  return shouldDeferBossAwareSpawn(
    session,
    queued,
    maximum,
    livingEnemyCount(session),
  );
}

function updateBossEncounter(session) {
  return updateBossEncounterSystem(session, {
    enqueueReinforcement: (packetKey) => enqueueBossReinforcement(session, packetKey),
  });
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

export function spawnEnemy(session, {
  type, row = 0, count = 1, variant, groupInTile = false,
} = {}) {
  if (!session.sandbox) return { ok: false, reason: "Spawn manual disponível apenas no Campo de Provas.", enemies: [], events: [] };
  if (!ENEMIES[type] || ENEMIES[type].hiddenFromCatalog) return { ok: false, reason: "Inimigo desconhecido.", enemies: [], events: [] };
  if ((ENEMIES[type].debugOnly || ENEMIES[type].testOnly) && !session.sandbox) return { ok: false, reason: "Inimigo disponível apenas no Campo de Provas.", enemies: [], events: [] };
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
  const nextSettings = { ...session.sandboxSettings, ...settings };
  if (settings.mechanicMode && settings.mechanicMode !== session.sandboxSettings.mechanicMode) {
    session.phase = applySandboxMechanic(session.phase, nextSettings);
    session.sandstorm.state = "idle";
    session.sandstorm.buriedTroopIds = [];
    session.sandstorm.slowedTroopIds = [];
    session.windCurrent = createWindCurrentState();
    session.tideCycle = createTideCycleState();
  }
  session.sandboxSettings = nextSettings;
  if (Object.prototype.hasOwnProperty.call(settings, "magmaThermalState")
    && session.phase?.environmentHazard?.id === "thermal_cycle") {
    const forcedState = settings.magmaThermalState;
    if (forcedState && forcedState !== "auto" && THERMAL_STATES[forcedState]) {
      session.thermalCycle = {
        ...session.thermalCycle,
        state: forcedState,
        cycleIndex: -1,
        stateStartedAt: session.elapsed,
        stateEndsAt: Infinity,
        heatRatePerSecond: THERMAL_STATES[forcedState].heatPerSecond,
        paused: false,
      };
    } else if (forcedState === "auto") {
      session.thermalCycle = createThermalCycleState(session.phase.environmentHazard, session.elapsed);
    }
  }
  initializeSandboxHazard(session);
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
  session.temporaryMagmaHazards = [];
  session.permanentThermalHazards = [];
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

export { getEnemyTargetableRows, enemyOccupiesTargetRow };

function enemyHitPointForRow(enemy, row, elapsed) {
  const config = ENEMIES[enemy.type];
  if (enemy.type === "colossoCaldeira") {
    const zone = enemy.hitZones?.find((entry) => entry.rows.includes(row));
    // The Colosso occupies several logical lanes, but all impact feedback must
    // land on the body. Row-derived coordinates placed hits above its head.
    const xOffset = zone?.part === "leftArm" ? -112 : zone?.part === "rightArm" ? -76 : zone?.part === "core" ? -94 : -88;
    return { x: enemy.x + xOffset, y: enemy.y - 72 };
  }
  if (enemy.type !== "leviathanNereida") return getEnemyHitPoint(enemy, config);
  const state = enemy.leviathanState || "idleSurface";
  const animation = getEnemyAnimation(enemy, config, elapsed, { [state]: 8, idleSurface: 8 });
  return getLeviathanHitPointForRow(enemy, config, row, animation.state, animation.frame);
}

function resolveTroopTarget(session, troop, config) {
  const target = resolveForestCombatTarget(session, troop, {
    ...config,
    enemyTargetable: (enemy) => canTroopTargetEnemy(session, troop, config, enemy, ENEMIES[enemy.type]),
  }, enemiesForRow(session, troop.row));
  if (target) {
    if (target.kind === "forestObstacle") session.chapterSevenMetrics.forestCoverBlocks += 1;
    return target;
  }
  if (troop.type === "cryo7") {
    const enemy = selectCryoTarget(session.enemies, troop, config, {
      occupiesTargetRow: enemyOccupiesTargetRow,
      canTarget: (entry) => canTroopTargetEnemy(session, troop, config, entry, ENEMIES[entry.type]),
      enemyConfigFor: (entry) => ENEMIES[entry.type],
      cellWidth: CELL.width,
    });
    return enemy ? { kind: "enemy", entity: enemy } : null;
  }
  return null;
}

function enemyColumn(enemy) {
  return clamp(Math.floor(enemy.x / CELL.width), 0, FIELD.cols - 1);
}

export function forceExecutorCombo(session, step) {
  if (!session.sandbox) return { ok: false, reason: "Controle disponível apenas no Campo de Provas." };
  return forceExecutorComboStep(session, step, TROOPS.executorArco, enemyColumn);
}

export function forceLeviathanAttack(session, attack) {
  if (!session?.sandbox) return { ok: false, reason: "Controle disponível apenas no Campo de Provas.", events: [] };
  const enemy = session.enemies.find((entry) => !entry.dead && entry.type === "leviathanNereida");
  const events = [];
  const result = forceLeviathanAttackDomain(session, enemy, attack, ENEMIES.leviathanNereida, events);
  return { ...result, events };
}

export function forceColossoAttack(session, attack) {
  if (!session?.sandbox) return { ok: false, reason: "Controle disponível apenas no Campo de Provas.", events: [] };
  const enemy = session.enemies.find((entry) => !entry.dead && entry.type === "colossoCaldeira");
  const events = [];
  const result = forceColossoAttackDomain(session, enemy, attack, ENEMIES.colossoCaldeira, events);
  return { ...result, events };
}

export function debugColosso(session, action) {
  if (!session?.sandbox) return { ok: false, reason: "Controle disponível apenas no Campo de Provas.", events: [] };
  const enemy = session.enemies.find((entry) => !entry.dead && entry.type === "colossoCaldeira");
  const events = [];
  const result = debugColossoDomain(session, enemy, action, ENEMIES.colossoCaldeira, events);
  return { ...result, events };
}

export function debugLeviathan(session, action) {
  if (!session?.sandbox) return { ok: false, reason: "Controle disponível apenas no Campo de Provas." };
  const boss = session.enemies.find((entry) => !entry.dead && entry.type === "leviathanNereida");
  if (!boss) return { ok: false, reason: "Leviatã não está ativo." };
  if (action === "phase1" || action === "phase2" || action === "phase3") {
    const ratio = action === "phase1" ? 1 : action === "phase2" ? .70 : .35;
    boss.hp = boss.maxHp * ratio; boss.leviathanPhase = Number(action.at(-1));
  } else if (action === "resetCooldowns") {
    for (const key of ["leviathanBiteReadyAt", "leviathanTailReadyAt", "leviathanBrineReadyAt", "leviathanVortexReadyAt", "leviathanDiveReadyAt", "leviathanTideReadyAt", "leviathanRoarReadyAt", "leviathanDelugeReadyAt"]) boss[key] = session.elapsed;
    boss.leviathanGlobalAttackReadyAt = session.elapsed;
  } else if (action === "exposeGills") {
    boss.leviathanState = "exposedGills"; boss.leviathanStateStartedAt = session.elapsed; boss.leviathanStateEndsAt = session.elapsed + ENEMIES.leviathanNereida.devastatingDive.exposedDurationMs; boss.leviathanTargetable = true; boss.leviathanDamageFactor = ENEMIES.leviathanNereida.exposedGillsDamageFactor;
  } else if (action === "clearTide") {
    if (session.tideCycle?.bossOverride?.sourceId === boss.id) delete session.tideCycle.bossOverride;
    session.tideCycle.leviathanFloodedCells = []; session.tideCycle.leviathanFloodedUntil = 0;
  } else if (action === "kill") { boss.hp = 0; boss.dead = true; }
  return { ok: true, action };
}

function mortarTargetGroup(session, troop, config) {
  mortarTargetCounts.fill(0);
  mortarTargetEntities.fill(null);
  for (const enemy of enemiesForRow(session, troop.row)) {
    if (!enemyOccupiesTargetRow(enemy, troop.row)) continue;
    const col = enemyColumn(enemy);
    const offset = col - troop.col;
    if (offset < config.minRange || offset > config.range) continue;
    mortarTargetCounts[col] += 1;
    const current = mortarTargetEntities[col];
    if (!current || enemy.x < current.x
      || (enemy.x === current.x && enemy.id.localeCompare(current.id) < 0)) mortarTargetEntities[col] = enemy;
  }
  let selectedCol = -1;
  for (let col = 0; col < FIELD.cols; col += 1) {
    if (mortarTargetCounts[col] > 0
      && (selectedCol < 0 || mortarTargetCounts[col] > mortarTargetCounts[selectedCol])) selectedCol = col;
  }
  return selectedCol < 0
    ? null
    : {
      target: mortarTargetEntities[selectedCol],
      row: troop.row,
      col: selectedCol,
      targetX: mortarTargetEntities[selectedCol].x,
      targetSpeed: getEffectiveEnemyMoveSpeed(session, mortarTargetEntities[selectedCol]),
    };
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
  const rasgamarFactor = session.elapsed < (troop.rasgamarAttackSlowUntil || 0)
    ? troop.rasgamarAttackSlowFactor || 1
    : 1;
  const veuSalinoFactor = session.elapsed < (troop.veuSalinoAttackSlowUntil || 0)
    ? troop.veuSalinoAttackSlowFactor || 1
    : 1;
  const leviathanFactor = session.elapsed < (troop.leviathanBrineUntil || 0)
    ? troop.leviathanBrineAttackSpeedFactor || 1
    : 1;
  const vertebralFactor = getVertebralToxinAttackSpeedFactor(session, troop);
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
  const tideFactor = getTideTroopAttackSpeedFactor(session, troop);
  setTroopAttackSpeedFactor(
    troop,
    Math.min(parasiteFactor, webFactor, rasgamarFactor, veuSalinoFactor, leviathanFactor, vertebralFactor, sandFactor, tideFactor, troop.thermalAttackSpeedFactor || 1),
    session.elapsed,
  );
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
  if (!session.waveActive && !session.sandbox) {
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

export function getFocusedFireDamageMultiplier(session, troop, target) {
  if (!target || !session.modifiers.focusedFire || troop.row !== session.focusedFireRow
    || !enemyOccupiesTargetRow(target, session.focusedFireRow)) return 1;
  const closest = session.enemies
    .filter((enemy) => enemyOccupiesTargetRow(enemy, session.focusedFireRow))
    .reduce((best, enemy) => (!best || enemy.x < best.x ? enemy : best), null);
  return closest?.id === target.id ? 1.18 : 1;
}

function attackDamageMultiplier(session, troop, { explosive = false, target = null } = {}) {
  let multiplier = session.modifiers.troopDamage;
  if (session.activeTemporaryDecisions.includes("final_overload")) multiplier *= 1.2;
  if (isOffensiveConfig(TROOPS[troop.type])) multiplier *= session.modifiers.aggressiveDamage;
  if (["marine", "sniper", "caçador", "interceptadorIcaro"].includes(troop.type)) multiplier *= session.modifiers.ballisticDamage;
  if (explosive) multiplier *= session.modifiers.explosiveDamage;
  if (troop.type === "ranger") multiplier *= session.modifiers.rangerDamage;
  if (troop.type === "guarda") multiplier *= session.modifiers.guardDamage;
  if (session.modifiers.frontlineDoctrine && ["melee", "tileMelee"].includes(TROOPS[troop.type]?.attack)) multiplier *= 1.1;
  if (session.modifiers.advancedFormation && session.advancedFormationColumns.includes(troop.col)) multiplier *= 1.15;
  if (troop.swarmHpApplied) multiplier *= 1.1;
  multiplier *= getFocusedFireDamageMultiplier(session, troop, target);
  multiplier *= getAresFireBonus(troop, target, target ? ENEMIES[target.type] : null);
  if (troop.type === "cryo7" && target) {
    const cryoFactor = getCryoDamageFactor(ENEMIES[target.type], TROOPS.cryo7);
    multiplier *= cryoFactor;
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
    || ENEMIES[enemy.type]?.knockbackImmune || enemy.rooted || !isGroundTrapEligible(enemy)) return;
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
  if (config?.id === "carapacaNereida" && context.direct === true
    && Number.isFinite(context.sourceX) && context.sourceX < enemy.x) {
    factor *= context.flooded === true ? config.floodedFrontDamageFactor : config.frontDamageFactor;
  }
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

function rememberEnemyKill(session, enemy, sourceTroopId = null) {
  const config = ENEMIES[enemy?.type] || {};
  const kill = {
    enemy: getEnemyDeathEntity(enemy, session.elapsed),
    sourceTroopId,
    row: enemy.row,
    cinematic: Boolean(enemy.variant === "alpha" || config.boss || config.elite),
  };
  session.lastEnemyKillCandidate = kill;
}

function clearRasgamarCoil(session, enemy, { applySlow = false } = {}) {
  const troop = indexedTroopById(session, enemy?.rasgamarTargetId);
  if (troop?.rasgamarCoiledBy === enemy.id) {
    troop.rasgamarCoiledBy = null;
    if (applySlow) {
      troop.rasgamarAttackSlowFactor = ENEMIES.enguiaRasgamar.coilAttackSlowFactor;
      troop.rasgamarAttackSlowUntil = session.elapsed + ENEMIES.enguiaRasgamar.coilAttackSlowMs;
    }
  }
  if (enemy) {
    enemy.rasgamarTargetId = null;
    enemy.rasgamarPulseIndexes = [];
  }
}

function notifyEnemyDeath(session, enemy, events, context = {}) {
  getEnemyBehavior(enemy.type).onDeath(createEnemyRuntime(session, events), enemy, events, context);
}

function damageEnemy(session, enemy, amount, events, context = {}) {
  if (!enemy || enemy.dead) return;
  if (Number.isFinite(context.sourceX) && context.sourceX < enemy.x && context.sourceTroopId) {
    const sourceTroop = session.troops.find((troop) => troop.id === context.sourceTroopId && !troop.dead);
    const blocker = sourceTroop ? getBlockingForestObstacle(session, sourceTroop, enemy) : null;
    if (blocker) {
      session.chapterSevenMetrics.forestCoverBlocks += 1;
      damageForestObstacle(session, blocker, amount, events, stunEnemy);
      events.push({ type: "forestObstacleIntercept", sourceTroopId: context.sourceTroopId, targetId: blocker.id, blockedEnemyId: enemy.id, x: blocker.x, y: blocker.y });
      return;
    }
  }
  if (enemy.type === "rasgaCeusCinereo") {
    session.metrics ??= {};
    if (enemy.flightAltitude <= ENEMIES.rasgaCeusCinereo.groundTargetAltitude && context.ranged) {
      session.metrics.rasgaCeusGroundWindowDamageTaken = (session.metrics.rasgaCeusGroundWindowDamageTaken || 0) + Math.max(0, amount);
    }
    if (amount >= enemy.hp) {
      const metric = ["diving", "strike", "climbing"].includes(enemy.rasgaCeusState)
        ? "rasgaCeusKilledDuringDive" : enemy.flightAltitude > ENEMIES.rasgaCeusCinereo.groundTargetAltitude ? "rasgaCeusKilledHighAltitude" : null;
      if (metric) session.metrics[metric] = (session.metrics[metric] || 0) + 1;
    }
  }
  getEnemyBehavior(enemy.type).receiveDamage(createEnemyRuntime(session, events), enemy, amount, events, context);
  if (isRasgamarSubmerged(enemy)) {
    return;
  }
  if (enemy.type === "leviathanNereida" && enemy.leviathanSubmerged) return;
  if (context.fortuneOrbital) {
    enemy.hp -= amount;
    const hitPoint = getEnemyHitPoint(enemy, ENEMIES[enemy.type]);
    events.push({ type: "hit", targetId: enemy.id, x: hitPoint.x, y: hitPoint.y, color: "#fbbf24", fortuneOrbital: true });
    if (enemy.hp <= 0) {
      enemy.hp = 0;
      enemy.dead = true;
      notifyEnemyDeath(session, enemy, events, context);
      clearRasgamarCoil(session, enemy);
      detachParasite(session, enemy);
      if (ENEMIES[enemy.type]?.countsAsKill !== false) session.killed += 1;
      rememberEnemyKill(session, enemy, context.sourceTroopId || null);
      const bossDeath = enemy.variant === "alpha" || ENEMIES[enemy.type]?.boss;
      events.push({
        type: bossDeath ? "bossDeath" : "enemyDeath",
        x: enemy.x,
        y: enemy.y,
        entity: getEnemyDeathEntity(enemy, session.elapsed),
        sourceTroopId: context.sourceTroopId || null,
        fortuneOrbital: true,
      });
    }
    return;
  }
  const sourceConfig = TROOPS[context.sourceTroopType];
  if (enemy.isEcho && sourceConfig?.glassEchoShatter) {
    enemy.shield = 0;
    enemy.hp = 0;
    enemy.dead = true;
    notifyEnemyDeath(session, enemy, events, context);
    clearRasgamarCoil(session, enemy);
    detachParasite(session, enemy);
    if (ENEMIES[enemy.type]?.countsAsKill !== false) session.killed += 1;
    rememberEnemyKill(session, enemy, context.sourceTroopId || null);
    events.push({ type: "glassEchoShatter", targetId: enemy.id, sourceTroopType: context.sourceTroopType, x: enemy.x, y: enemy.y, entity: { ...enemy }, color: "#7fffd4", seed: nextEffectSeed(session) });
    trySpawnEnemyEnergyPickup(session, enemy, events);
    return;
  }
  const cell = { row: enemy.row, col: clamp(Math.floor(enemy.x / CELL.width), 0, FIELD.cols - 1) };
  const damageTakenFactor = getEnemyDamageTakenFactor(enemy, {
    ...context, elapsed: session.elapsed, flooded: isTideCellFlooded(session, cell.row, cell.col),
  });
  if (enemy.type === "carapacaNereida") enemy.lastHitAt = session.elapsed;
  let chapterFourFactor = 1;
  if (enemy.type === "gorjal" && enemy.chapterFourState === "recover") {
    chapterFourFactor *= ENEMIES.gorjal.recoverDamageTakenFactor;
  }
  if (enemy.type === "raizFulgor" && enemy.rooted) {
    chapterFourFactor *= ENEMIES.raizFulgor.rootedDamageTakenFactor;
  }
  const packetEnemies = getBattleIndex(session)?.enemiesByPacket.get(enemy.packetId) || session.enemies;
  const nereidaProtector = context.ranged === true && context.direct === true
    ? session.enemies.find((carrier) => {
      if (carrier.dead || carrier.type !== "carapacaNereida" || carrier.id === enemy.id) return false;
      const carrierConfig = ENEMIES.carapacaNereida;
      return !ENEMIES[enemy.type]?.boss && enemy.type !== "carapacaNereida" && carrier.row === enemy.row
        && enemy.x > carrier.x && enemy.x - carrier.x <= carrierConfig.escortRangeTiles * CELL.width
        && Number.isFinite(context.sourceX) && context.sourceX < carrier.x;
    })
    : null;
  const protector = packetEnemies.find((candidate) => {
    if (candidate.dead || candidate.type !== "nimbarca" || candidate.id === enemy.id
      || candidate.packetId !== enemy.packetId || candidate.row !== enemy.row) return false;
    return Math.abs(candidate.x - enemy.x) <= ENEMIES.nimbarca.shieldRadiusTiles * CELL.width;
  });
  if (protector && context.direct !== false) {
    const shieldFactor = protector.variant === "alpha" ? 0.75 : ENEMIES.nimbarca.alliedProjectileDamageFactor;
    chapterFourFactor *= context.nimbarcaShieldIgnoreFactor == null
      ? shieldFactor
      : 1 - (1 - shieldFactor) * (1 - context.nimbarcaShieldIgnoreFactor);
  } else if (enemy.type === "nimbarca" && context.direct !== false) {
    const shieldFactor = enemy.variant === "alpha" ? 0.85 : ENEMIES.nimbarca.selfProjectileDamageFactor;
    chapterFourFactor *= context.nimbarcaShieldIgnoreFactor == null
      ? shieldFactor
      : 1 - (1 - shieldFactor) * (1 - context.nimbarcaShieldIgnoreFactor);
  }
  const armorFactor = Number.isFinite(context.armorFactorOverride)
    ? context.armorFactorOverride
    : Number.isFinite(enemy.armorDamageFactor)
    ? enemy.armorDamageFactor
    : ENEMIES[enemy.type]?.armorDamageFactor ?? 1;
  const armorPierce = clamp(context.armorPierceFactor || 0, 0, 1);
  const effectiveArmorFactor = armorFactor < 1
    ? armorFactor + (1 - armorFactor) * armorPierce
    : armorFactor;
  const ruptureFactor = enemy.structuralRuptured
    ? enemy.structuralRuptureDamageTakenFactor || 1.25
    : 1;
  let incoming = amount * (session.sandboxSettings?.troopDamageMultiplier ?? 1)
    * damageTakenFactor * chapterFourFactor * effectiveArmorFactor * ruptureFactor;
  if (enemy.type === "leviathanNereida") incoming *= enemy.leviathanDamageFactor || 1;
  const colossoCoreHit = enemy.type === "colossoCaldeira" && context.sourceTroopId
    ? getColossoCoreHitMetadata(enemy, indexedTroopById(session, context.sourceTroopId)?.row)
    : null;
  if (enemy.type === "colossoCaldeira" && context.sourceTroopId) {
    const source = indexedTroopById(session, context.sourceTroopId);
    if (source) incoming *= getColossoDamageFactor(enemy, source.row);
  }
  if (nereidaProtector) incoming *= ENEMIES.carapacaNereida.escortedRangedDamageFactor;
  const sourceTroop = context.sourceTroopId ? indexedTroopById(session, context.sourceTroopId) : null;
  const hitPoint = (enemy.type === "leviathanNereida" || enemy.type === "colossoCaldeira") && sourceTroop
    ? enemyHitPointForRow(enemy, sourceTroop.row, session.elapsed)
    : getEnemyHitPoint(enemy, ENEMIES[enemy.type]);
  if (enemy.shield > 0 && incoming > 0) {
    const shieldIgnore = clamp(context.shieldIgnoreFactor || 0, 0, 1);
    const bypassDamage = incoming * shieldIgnore;
    let shieldableDamage = incoming - bypassDamage;
    const absorbed = Math.min(enemy.shield, shieldableDamage);
    enemy.shield = Math.max(0, enemy.shield - absorbed);
    shieldableDamage -= absorbed;
    incoming = bypassDamage + shieldableDamage;
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
    if (enemy.type === "predadorCaldeira"
      && !enemy.predatorFrenzyTriggered
      && enemy.hp / Math.max(1, enemy.maxHp) <= ENEMIES.predadorCaldeira.frenzyThreshold) {
      enemy.predatorFrenzyTriggered = true;
      enemy.armorDamageFactor = ENEMIES.predadorCaldeira.frenzyArmorDamageFactor;
      if (enemy.predatorState === "attackCombo") enemy.predatorFrenzyPending = true;
    }
    events.push({
      type: "hit", targetId: enemy.id, x: hitPoint.x, y: hitPoint.y,
      color: ENEMIES[enemy.type].color, damageTakenFactor, amount: Math.round(incoming),
      ...(colossoCoreHit || {}),
    });
    if (colossoCoreHit) events.push({
      type: "colossoCoreHit", bossId: enemy.id, x: hitPoint.x, y: hitPoint.y,
      ...colossoCoreHit, damage: Math.round(incoming),
    });
  }
  if (enemy.hp <= 0) {
    if (enemy.type === "colossoCaldeira") {
      // Its defeat is an event: preserve the entity long enough for the collapse
      // animation while preventing any further attacks or rift spawns.
      enemy.hp = 0;
      enemy.colossoDying = true;
      enemy.colossoRifts = [];
      session.queue = session.queue.filter((entry) => !["boss_rift", "boss_reinforcement"].includes(entry.block));
      session.nextSpawnAt = session.queue.length ? session.waveStartedAt + session.queue[0].spawnAtMs : Infinity;
      for (const hazard of session.temporaryMagmaHazards || []) {
        if (hazard.sourceEnemyId === enemy.id) { hazard.active = false; hazard.endsAt = session.elapsed; }
      }
      deactivatePermanentThermalHazards(session, enemy.id);
      enemy.colossoState = "death";
      enemy.colossoStateStartedAt = session.elapsed;
      enemy.colossoStateEndsAt = session.elapsed + ENEMIES.colossoCaldeira.deathDurationMs;
      events.push({ type: "colossoDeathStarted", bossId: enemy.id, x: enemy.x, y: enemy.y });
      return;
    }
    enemy.hp = 0;
    enemy.dead = true;
    notifyEnemyDeath(session, enemy, events, context);
    detachParasite(session, enemy);
    if (ENEMIES[enemy.type]?.countsAsKill !== false) session.killed += 1;
    rememberEnemyKill(session, enemy, context.sourceTroopId || null);
    const bossDeath = enemy.variant === "alpha" || ENEMIES[enemy.type]?.boss;
    events.push({
      type: bossDeath ? "bossDeath" : "enemyDeath",
      x: enemy.x,
      y: enemy.y,
      entity: getEnemyDeathEntity(enemy, session.elapsed),
      sourceTroopId: context.sourceTroopId || null,
    });
    trySpawnGlassEcho(session, enemy, events);
    trySpawnEnemyEnergyPickup(session, enemy, events);
  }
}

function getEnemyDeathEntity(enemy, elapsed) {
  const entity = { ...enemy };
  if (enemy.type === "raizFulgor") {
    entity.deathWasRooted = Boolean(enemy.rooted);
    return entity;
  }
  if (enemy.type !== "derivante") return entity;
  const progress = clamp(Number(enemy.jumpProgress) || 0, 0, 1);
  const usesJumpArc = enemy.chapterFourState === "jumping"
    && !(enemy.windMotion && enemy.windMotion.endsAt > elapsed);
  entity.deathVisualY = enemy.y - (usesJumpArc
    ? ENEMIES.derivante.jumpArcHeight * 4 * progress * (1 - progress)
    : 0);
  return entity;
}

export function stunEnemy(session, enemy, durationMs) {
  if (!enemy || enemy.dead || durationMs <= 0 || ENEMIES[enemy.type]?.controlImmune) return;
  const wasStunned = session.elapsed < (Number(enemy.stunnedUntil) || 0);
  const previousUntil = Math.max(session.elapsed, Number(enemy.stunnedUntil) || 0);
  const nextUntil = Math.max(previousUntil, session.elapsed + durationMs);
  const pausedFor = nextUntil - previousUntil;
  enemy.stunnedUntil = nextUntil;
  if (!wasStunned) enemy.stunnedStartedAt = session.elapsed;
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
  if (
    enemy.type === "derivante"
    && ["jumpPrepare", "jumpTakeoff", "jumping", "landing", "windGlide"].includes(enemy.chapterFourState)
  ) {
    const nearestRow = clamp(Math.round((enemy.y - CELL.height / 2) / CELL.height), 0, FIELD.rows - 1);
    enemy.jumping = false;
    enemy.jumpProgress = 0;
    enemy.row = nearestRow;
    enemy.y = getRowCenter(nearestRow);
    enemy.previousRenderY = enemy.y;
    enemy.jumpSourceRow = null;
    enemy.jumpSourceY = null;
    enemy.jumpTargetRow = null;
    enemy.jumpTargetY = null;
    enemy.windMotion = null;
    enemy.nextSpecialAt = session.elapsed + ENEMIES.derivante.interruptedJumpCooldownMs;
    setChapterFourState(session, enemy, "walking");
  }
  for (const field of [
    "attackReadyAt", "castReadyAt", "meleeImpactAt", "ramStateEndsAt", "ramAttackImpactAt",
    "duneStateEndsAt", "duneAttackImpactAt",
    "chapterFourStateEndsAt",
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
  for (const field of [
    "predatorStateStartedAt", "predatorStateEndsAt",
    "devoradorStateStartedAt", "devoradorStateEndsAt",
    "incubatorStateStartedAt", "incubatorStateEndsAt",
    "cuspidorStateStartedAt", "cuspidorStateEndsAt",
  ]) {
    if (Number.isFinite(enemy[field])
      && (field.endsWith("StartedAt") || enemy[field] >= session.elapsed)) enemy[field] += pausedFor;
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
      const targets = session.enemies.filter((enemy) => !enemy.dead
        && enemy.row === row && config.shieldTargetTypes.includes(enemy.type));
      for (const target of targets) {
        const value = Math.min(config.shieldCap, config.shieldBase + target.maxHp * config.shieldMaxHpFactor);
        target.shield = value;
        target.shieldMax = value;
        target.lastShieldPulseAt = pulseAt;
      }
      source.lastShieldPulseAt = pulseAt;
      state.lastPulseAt = pulseAt;
      state.nextPulseAt += config.shieldPulseEveryMs;
      events.push({
        type: "prismaticPulse", sourceId: source.id, x: source.x, y: source.y - 34 * source.scale,
        row, targetIds: targets.map((target) => target.id), color: config.color, seed: nextEffectSeed(session),
      });
    }
  }
}

export function eliminateTroop(session, troop, events, reason = "enemy", options = {}) {
  if (!troop || troop.dead) return false;
  for (const enemy of session.enemies) {
    if (enemy.type === "enguiaRasgamar" && enemy.rasgamarTargetId === troop.id) {
      clearRasgamarCoil(session, enemy);
      enemy.rasgamarState = "surfaceRecovery";
      enemy.rasgamarStateStartedAt = session.elapsed;
      enemy.rasgamarStateEndsAt = session.elapsed + ENEMIES.enguiaRasgamar.coilRecoveryMs;
      enemy.rasgamarSubmerged = false;
    }
  }
  if (troop.type === "droneSentinela") troop.droneDeathLevel = Number(troop.droneCount || 1);
  troop.hp = options.preserveHp ? troop.hp : 0;
  troop.dead = true;
  troop.removedByWind = reason === "wind";
  troop.defenseActive = false;
  troop.pendingRepulsorShot = null;
  recordTroopLoss(session, troop, reason);
  recordTideTroopElimination(session, troop, reason);
  releaseParasiteFromTroop(session, troop);
  refreshSwarmDoctrine(session);
  if (!options.suppressEvent) {
    events.push({
      type: options.eventType ?? "troopDeath",
      entity: { ...troop },
      x: troop.x,
      y: troop.y,
    });
  }
  return true;
}

export function damageTroop(session, troop, amount, events, context = {}) {
  if (!troop || troop.dead) return 0;
  const config = TROOPS[troop.type];
  const defenseFactor = isLumiUrsa7(config) && troop.defenseActive ? config.defenseDamageFactor : 1;
  const lastLineFactor = troop.col <= 1 ? session.modifiers.lastLineDamageTaken : 1;
  const advancedFormationFactor = session.modifiers.advancedFormation
    && session.advancedFormationColumns.includes(troop.col) ? 1.1 : 1;
  const finalFortressFactor = session.activeTemporaryDecisions.includes("final_fortress") ? 0.75 : 1;
  const flooded = isTideCellFlooded(session, troop.row, troop.col);
  const bastiaoFactor = config.id === "bastiaoMare"
    ? getBastiaoFloodedDamageFactor(config, flooded)
    : 1;
  const damageType = context.damageType || DAMAGE_TYPES.PHYSICAL;
  const typeFactor = damageType === DAMAGE_TYPES.FIRE
    ? (config.fireDamageTakenFactor ?? 1)
    : damageType === DAMAGE_TYPES.THERMAL
      ? (config.thermalDamageTakenFactor ?? 1)
      : 1;
  let incoming = amount * typeFactor * defenseFactor * lastLineFactor * advancedFormationFactor
    * finalFortressFactor * bastiaoFactor
    * electricDamageTakenFactor(troop, session.elapsed)
    * (session.sandboxSettings?.enemyDamageMultiplier ?? 1);
  if ([DAMAGE_TYPES.FIRE, DAMAGE_TYPES.THERMAL].includes(damageType)
    && config.thermalShield && troop.thermalShieldHp > 0) {
    const absorbed = Math.min(troop.thermalShieldHp, incoming);
    troop.thermalShieldHp -= absorbed;
    incoming -= absorbed;
    session.thermalMetrics.aresShieldAbsorbed += absorbed;
    events.push({ type: "aresThermalShieldAbsorb", targetId: troop.id, amount: absorbed, current: troop.thermalShieldHp, max: config.thermalShield.maxHp, x: troop.x, y: troop.y - 54, damageType });
  }
  if (troop.reactiveShield > 0 && session.elapsed < troop.reactiveShieldUntil) {
    const absorbed = Math.min(troop.reactiveShield, incoming);
    troop.reactiveShield -= absorbed;
    incoming -= absorbed;
  }
  const hpBefore = Math.max(0, troop.hp);
  const actualHpDamage = Math.min(hpBefore, Math.max(0, incoming));
  troop.hp = hpBefore - actualHpDamage;
  if (session.modifiers.reactiveBarrier && troop.hp > 0 && troop.hp / troop.maxHp < 0.3
    && !session.reactiveBarrierRows.includes(troop.row)) {
    session.reactiveBarrierRows.push(troop.row);
    troop.reactiveShield = troop.maxHp * 0.25;
    troop.reactiveShieldUntil = session.elapsed + 6000;
    events.push({ type: "shieldHit", targetId: troop.id, x: troop.x, y: troop.y, reactive: true });
  }
  if (defenseFactor < 1 || bastiaoFactor < 1) {
    events.push({
      type: "shieldHit",
      targetId: troop.id,
      x: troop.x,
      y: troop.y - 46,
      color: config.color,
      seed: nextEffectSeed(session),
    });
  }
  events.push({
    type: "troopHit", targetId: troop.id, x: troop.x, y: troop.y,
    amount: Math.round(actualHpDamage),
  });
  if (config.id === "bastiaoMare" && context.generateEnergy !== false && actualHpDamage > 0) {
    recordBastiaoDamage(session, troop, actualHpDamage, events, {
      config,
      flooded,
      spawnEnergyPickup: (...args) => isSystemEnabledForPhase(session.phase, "enemyEnergyPickups")
        ? spawnEnergyPickup(...args)
        : null,
      enemies: session.enemies,
      isEnemyTargetable,
      isEnemySubmerged: isRasgamarSubmerged,
      damageEnemy: (enemy, damage, damageContext) =>
        damageEnemy(session, enemy, damage, events, damageContext),
      configForEnemy: (enemy) => ENEMIES[enemy.type],
      nextEffectSeed: () => nextEffectSeed(session),
      cellWidth: CELL.width,
      cellHeight: CELL.height,
    });
  }
  if (troop.hp <= 0) {
    eliminateTroop(session, troop, events, session.sandbox ? "sandbox" : "enemy");
  }
  return actualHpDamage;
}

function stunTroop(session, troop, durationMs, events) {
  if (!troop || troop.dead || durationMs <= 0) return false;
  const start = Math.max(session.elapsed, troop.controlStunnedUntil || 0);
  const end = Math.max(start, session.elapsed + durationMs);
  const extension = end - (troop.controlStunnedUntil || session.elapsed);
  troop.controlStunnedUntil = end;
  for (const key of ["attackReadyAt", "attackBusyUntil", "attackReleaseAt", "stateEndsAt", "mineReadyAt", "gunReadyAt"]) {
    if (Number.isFinite(troop[key]) && troop[key] > session.elapsed) troop[key] += extension;
  }
  events.push({ type: "physicalStun", targetId: troop.id, durationMs: end - session.elapsed, x: troop.x, y: troop.y });
  return true;
}

function updateFlameChannel(session, troop, config, events, dt) {
  const resolve = () => resolveTroopTarget(session, troop, config);
  const firstTarget = resolve();
  const attackTargets = firstTarget?.kind === "forestObstacle"
    ? [firstTarget.entity]
    : session.enemies.filter((enemy) => !enemy.dead && enemyOccupiesTargetRow(enemy, troop.row)
      && enemy.x >= troop.x && enemy.x - troop.x <= config.range * CELL.width)
      .sort((left, right) => left.x - right.x).slice(0, config.flameMaxTargets ?? 4);

  if (!attackTargets.length) {
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
    const activeTarget = resolve();
    const activeTargets = activeTarget?.kind === "forestObstacle"
      ? [activeTarget.entity]
      : session.enemies.filter((enemy) => !enemy.dead && enemyOccupiesTargetRow(enemy, troop.row)
        && enemy.x >= troop.x && enemy.x - troop.x <= config.range * CELL.width)
        .sort((left, right) => left.x - right.x).slice(0, config.flameMaxTargets ?? 4);
    if (!activeTargets.length) break;
    const frameCount = config.attackVisual?.frameMuzzles?.length || 1;
    const animation = getTroopAnimation(troop, config, session.elapsed, { attack: frameCount });
    const origin = getMuzzleWorldPosition(troop, config, 0, animation.frame);
    activeTargets.forEach((enemy) => {
      const damage = config.damage * attackDamageMultiplier(session, troop, { target: enemy?.kind === "forestObstacle" ? null : enemy });
      if (enemy?.kind === "forestObstacle") damageForestObstacle(session, enemy, damage, events, stunEnemy);
      else damageEnemy(session, enemy, damage, events, { direct: true, sourceX: troop.x, sourceTroopType: troop.type, sourceTroopId: troop.id });
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
  if (!target) return;
  const targetKind = target.kind || "enemy";
  const entity = target.entity || target;
  const targetPoint = targetKind === "forestObstacle"
    ? getForestObstacleHitPoint(entity)
    : enemyHitPointForRow(entity, troop.row, session.elapsed);
  if (targetKind === "forestObstacle" && ["laser", "shotgun", "melee"].includes(config.attack)) {
    const damage = config.damage * attackDamageMultiplier(session, troop, { target: null });
    damageForestObstacle(session, entity, damage, events, stunEnemy);
    events.push({ type: "forestObstacleShot", sourceTroopId: troop.id, targetId: entity.id, x: targetPoint.x, y: targetPoint.y, color: config.color });
    return;
  }
  const enemy = target?.entity || target;
  const damage = config.damage * attackDamageMultiplier(session, troop, {
    explosive: config.attack === "missile" || config.attack === "mortar",
    target: targetKind === "enemy" ? enemy : null,
  });
  const muzzleFrame = troop.type === "operadorJano"
    ? config.attackVisual?.shots?.[0]?.frame ?? null
    : null;
  const origin = getMuzzleWorldPosition(troop, config, 0, muzzleFrame);
  const effectSeed = nextEffectSeed(session);
  if (config.attack === "melee") {
    damageEnemy(session, enemy, damage, events, { direct: true, sourceX: troop.x, sourceTroopType: troop.type, sourceTroopId: troop.id });
    events.push({ type: "melee", x: enemy.x, y: enemy.y });
  } else if (config.attack === "laser") {
    damageEnemy(session, enemy, damage, events, { direct: true, sourceX: troop.x, sourceTroopId: troop.id, sourceTroopType: troop.type });
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
      .filter((enemy) => !enemy.dead && enemyOccupiesTargetRow(enemy, troop.row) && enemy.x >= troop.x && enemy.x - troop.x <= config.range * CELL.width
        && (!getForestObstacleAt(session, troop.row, Math.floor(enemy.x / CELL.width)) || enemy.x < (session.forestObstacles.find((tree) => tree.alive && tree.row === troop.row && tree.x > troop.x && tree.x - troop.x <= config.range * CELL.width)?.x ?? Infinity)))
      .sort((left, right) => left.x - right.x)
      .slice(0, maxTargets);
    targets.forEach((enemy, index) => damageEnemy(
      session,
      enemy,
      damage * config.pellets * (damageFactors[index] ?? 0),
      events,
        { direct: true, sourceX: troop.x, sourceTroopType: troop.type, sourceTroopId: troop.id },
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
      const straightLane = Boolean(config.straightLaneProjectile);
      session.projectiles.push({
        id: id("projectile"), kind: config.attack, troopType: troop.type,
        sourceTroopId: troop.id, shotIndex: shot, row: troop.row, straightLane,
        x: shotOrigin.x, y: shotOrigin.y, previousX: shotOrigin.x, previousY: shotOrigin.y,
        origin: { ...shotOrigin }, ageMs: 0, trail: createProjectileTrail(16, shotOrigin.x, shotOrigin.y),
        vx: straightLane ? speed : dx / distance * speed,
        vy: straightLane ? 0 : dy / distance * speed,
        damage, targetKind, targetId: entity.id, targetX: targetPoint.x, targetY: targetPoint.y, radius: (config.radius || 0) * session.modifiers.explosiveRadius,
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
      const createdProjectile = session.projectiles[session.projectiles.length - 1];
      if (troop.type === "cryo7" && targetKind === "enemy") {
        createdProjectile.cryoThermalTarget = isCryoThermalTarget(ENEMIES[enemy.type]);
        createdProjectile.cryoFireTarget = ENEMIES[enemy.type]?.enemyTags?.includes("fire") || false;
        createdProjectile.cryoShockDurationMs = getCryoShockDuration(ENEMIES[enemy.type], config);
        troop.cryoShotCount = (troop.cryoShotCount || 0) + 1;
      }
    }
  }
}

function fireOperadorJano(session, troop, config, target, events) {
  if (target) {
    fireTroop(session, troop, config, target, events);
    troop.state = "attack";
    troop.stateStartedAt = session.elapsed;
    troop.stateEndsAt = session.elapsed + (config.attackVisual?.durationMs || 640);
  }
  const droneCandidates = session.enemies
    .filter((enemy) => !enemy.dead && enemyOccupiesTargetRow(enemy, troop.row)
      && (enemy.x < troop.x || enemy.x - troop.x <= config.range * CELL.width));
  const droneTarget = droneCandidates
    .filter((enemy) => enemy.x < troop.x)
    .sort((left, right) => right.x - left.x)[0]
    || droneCandidates.sort((left, right) => right.x - left.x)[0]
    || target;
  if (!droneTarget) return;
  const origin = { x: troop.x + (config.droneOffset?.x || 42), y: troop.y + (config.droneOffset?.y || -76) };
  const targetPoint = enemyHitPointForRow(droneTarget, troop.row, session.elapsed);
  const dx = targetPoint.x - origin.x;
  const dy = targetPoint.y - origin.y;
  const distance = Math.max(1, Math.hypot(dx, dy));
  const damage = (config.droneDamage || config.damage * 0.6)
    * attackDamageMultiplier(session, troop, { target: droneTarget });
  session.projectiles.push({
    id: id("projectile"), kind: "bullet", troopType: troop.type,
    sourceTroopId: troop.id, shotIndex: 1, droneIndex: 0, row: troop.row, targetKind: "enemy",
    x: origin.x, y: origin.y, previousX: origin.x, previousY: origin.y,
    origin: { ...origin }, ageMs: 0, trail: createProjectileTrail(4, origin.x, origin.y),
    vx: dx / distance * (config.projectileSpeed || 390),
    vy: dy / distance * (config.projectileSpeed || 390),
    damage, targetId: droneTarget.id, radius: 0, color: config.color,
    visualKind: "sentinelBolt", visualCount: 1, active: true, launched: false,
    seed: nextEffectSeed(session), launchAt: session.elapsed + 180,
  });
  troop.droneState = droneTarget && droneTarget.x >= troop.x ? "attackFront" : "attackRear";
  troop.droneStateStartedAt = session.elapsed;
}

export function fireDroneSentinela(session, troop, config, target, events = []) {
  const level = clamp(Number(troop.droneCount || 1), 1, config.maxDronesPerTile);
  const visual = config.attackVisual;
  const targetPoint = enemyHitPointForRow(target, troop.row, session.elapsed);
  const damage = config.damage * attackDamageMultiplier(session, troop, { target });
  for (let shotIndex = 0; shotIndex < level; shotIndex += 1) {
    const shotDefinition = visual.shots[shotIndex];
    const origin = getMuzzleWorldPosition(troop, config, shotIndex);
    const dx = targetPoint.x - origin.x;
    const dy = targetPoint.y - origin.y;
    const distance = Math.max(1, Math.hypot(dx, dy));
    session.projectiles.push({
      id: id("projectile"), kind: "bullet", troopType: troop.type,
      sourceTroopId: troop.id, shotIndex, droneIndex: shotIndex, row: troop.row, targetKind: "enemy",
      x: origin.x, y: origin.y, previousX: origin.x, previousY: origin.y,
      origin: { ...origin }, ageMs: 0, trail: createProjectileTrail(4, origin.x, origin.y),
      vx: dx / distance * config.projectileSpeed,
      vy: dy / distance * config.projectileSpeed,
      damage, targetId: target.id, radius: 0,
      color: config.color, visualKind: "sentinelBolt",
      active: true, launched: false,
      launchAt: session.elapsed + Number(config.droneShotTimings[level]?.[shotIndex] ?? shotDefinition?.atMs ?? 0),
      seed: nextEffectSeed(session) + shotIndex,
    });
  }
  troop.droneVolleyTargetId = target.id;
  troop.droneVolleyStartedAt = session.elapsed;
  troop.lastAttackAt = session.elapsed;
  troop.attackReadyAt = session.elapsed + attackIntervalFor(session, troop, config, config.attackEveryMs);
  troop.state = "attack";
  troop.stateStartedAt = session.elapsed;
  troop.stateEndsAt = session.elapsed + visual.durationMs;
  events.push({
    type: "droneVolley", sourceTroopId: troop.id, targetId: target.id,
    droneCount: level, shots: level, x: troop.x, y: troop.y,
  });
}

function fireMortar(session, troop, config, group) {
  const origin = getMuzzleWorldPosition(troop, config, 0);
  const launchDelayMs = config.attackVisual.shots?.[0]?.atMs || 0;
  const predictionMs = launchDelayMs + config.projectileFlightMs;
  const minimumTargetX = troop.x + config.minRange * CELL.width;
  const maximumTargetX = Math.min(FIELD.width, troop.x + config.range * CELL.width);
  const targetX = clamp(
    group.targetX - group.targetSpeed * predictionMs / 1000,
    Math.max(0, minimumTargetX),
    maximumTargetX,
  );
  const targetY = group.row * CELL.height + CELL.height * 0.85;
  session.projectiles.push({
    id: id("projectile"), kind: "mortar", visualKind: config.attackVisual.effect,
    troopType: troop.type, sourceTroopId: troop.id, shotIndex: 0,
    row: troop.row, targetRow: group.row, targetCol: group.col, targetId: group.target.id,
    x: origin.x, y: origin.y, previousX: origin.x, previousY: origin.y,
    origin: { ...origin }, targetX, targetY, ageMs: 0,
    flightMs: config.projectileFlightMs, arcHeight: config.projectileArcHeight,
    rotation: -0.8, trail: createProjectileTrail(12, origin.x, origin.y),
    damage: config.damage * attackDamageMultiplier(session, troop, { explosive: true, target: group.target }),
    collateralMultiplier: config.collateralMultiplier,
    radiusFactor: session.modifiers.explosiveRadius,
    color: config.color, active: true, launched: false, seed: nextEffectSeed(session),
    launchAt: session.elapsed + (config.attackVisual.shots?.[0]?.atMs || 0),
  });
}

function mineCellIsFree(session, row, col) {
  if (!isCombatRow(session.phase, row)) return false;
  if (getTidePlacementBlockReason(session, row, col)) return false;
  const troopOccupied = session.troops.some((troop) => !troop.dead && troop.row === row && troop.col === col);
  const enemyOccupied = session.enemies.some((enemy) => !enemy.dead
    && enemyOccupiesTargetRow(enemy, row)
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
    origin: { ...origin }, ageMs: 0, trail: createProjectileTrail(4, origin.x, origin.y),
    vx: 390, vy: 0, damage: config.closeDamage * attackDamageMultiplier(session, troop, { target }), targetId: target.id, radius: 0,
    color: config.color, active: true, launched: false, seed: nextEffectSeed(session), maxDistance: config.closeRange * CELL.width,
    launchAt: session.elapsed + (config.attackVisuals.gun.shots?.[0]?.atMs || 0),
  });
  troop.gunReadyAt = session.elapsed + attackIntervalFor(session, troop, config, config.closeAttackEveryMs);
}

function updateDemolidora(session, troop, config, events) {
  const closeTarget = session.enemies
    .filter((enemy) => !enemy.dead && enemyOccupiesTargetRow(enemy, troop.row) && enemy.x >= troop.x && enemy.x - troop.x <= config.closeRange * CELL.width)
    .sort((left, right) => left.x - right.x)[0] || null;
  if (closeTarget) {
    if (session.elapsed >= troop.gunReadyAt) fireCloseGun(session, troop, config, closeTarget);
    return;
  }
  if (session.elapsed >= troop.mineReadyAt) launchMine(session, troop, config, events);
}

function enemiesInTroopTile(session, troop) {
  return session.enemies.filter((enemy) => !enemy.dead
    && enemyOccupiesTargetRow(enemy, troop.row)
    && enemyColumn(enemy) === troop.col);
}

function enemiesInTileMeleeRange(session, troop, config) {
  const rearOverlap = CELL.width / 2;
  const forwardRange = Math.max(0, Number(config.range) || 0) * CELL.width;
  return session.enemies.filter((enemy) => !enemy.dead
    && enemyOccupiesTargetRow(enemy, troop.row)
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
      && enemyOccupiesTargetRow(enemy, medic.row)
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
      && enemyOccupiesTargetRow(enemy, troop.row)
      && !ENEMIES[enemy.type]?.airborne
      && enemyColumn(enemy) === frontCol)
    .sort((left, right) => left.x - right.x)[0] || null;
}

export function findRepulsorTarget(session, troop, config = TROOPS.lumiUrsa7) {
  const target = resolveForestCombatTarget(session, troop, {
    ...config,
    range: config.repulsorRangeTiles,
    enemyTargetable: (enemy) => !ENEMIES[enemy.type]?.airborne,
  });
  return target?.entity || null;
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

function startRepulsorAttack(session, troop, config, target, events = []) {
  const enemy = target.entity || target;
  const targetKind = target.kind || "enemy";
  const targetPoint = targetKind === "forestObstacle" ? getForestObstacleHitPoint(enemy) : getEnemyHitPoint(enemy, ENEMIES[enemy.type]);
  const origin = getMuzzleWorldPosition(troop, config, 0);
  const projectileId = id("projectile");
  session.projectiles.push({
    id: projectileId, kind: "repulsorFist", visualKind: "repulsorFist",
    troopType: troop.type, sourceTroopId: troop.id, targetKind, targetId: enemy.id, targetX: targetPoint.x, targetY: targetPoint.y, row: troop.row,
    x: origin.x, y: origin.y, previousX: origin.x, previousY: origin.y,
    origin: { ...origin }, ageMs: 0, trail: createProjectileTrail(8, origin.x, origin.y),
    vx: config.projectileSpeed, vy: 0, damage: config.damage * attackDamageMultiplier(session, troop, { target: targetKind === "enemy" ? enemy : null }),
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
  troop.attackTargetId = enemy.id;
  troop.lastAttackAt = session.elapsed;
  troop.lastRepulsorAt = session.elapsed;
  troop.attackReadyAt = session.elapsed + attackIntervalFor(session, troop, config, config.attackEveryMs);
  troop.attackBusyUntil = session.elapsed + config.attackVisual.durationMs;
  setLumiState(troop, "attack", session.elapsed, config.attackVisual.durationMs);
}

function updateLumiUrsa7(session, troop, config, events = []) {
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
  const target = resolveForestCombatTarget(session, troop, {
    ...config,
    range: config.repulsorRangeTiles,
    enemyTargetable: (enemy) => !ENEMIES[enemy.type]?.airborne,
  });
  if (target && session.elapsed >= troop.attackReadyAt) {
    startRepulsorAttack(session, troop, config, target, events);
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
      damageEnemy(session, enemy, impact.damage, events, { direct: true, sourceX: troop.x, sourceTroopType: troop.type, sourceTroopId: troop.id });
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
    trail: createProjectileTrail(8, origin.x, origin.y),
    vx: config.rangedProjectileSpeed, vy: 0, visualArcHeight: 18,
    damage: config.rangedDamage * attackDamageMultiplier(session, troop, { target }),
    color: config.color, active: true, launched: false, phase: "flying",
    seed: nextEffectSeed(session), launchAt: session.elapsed + visual.releaseMs,
  });
}

export function isHeavyEnemy(enemy) {
  const config = ENEMIES[enemy?.type];
  return Boolean(config?.armorClass === "heavy" || config?.boss || enemy?.variant === "alpha");
}

export function selectLeviathanTarget(session, troop, config = TROOPS.cacadorLeviatas) {
  const minimumX = troop.x + config.minRange * CELL.width;
  const maximumX = troop.x + config.range * CELL.width;
  return session.enemies
    .filter((enemy) => (
      !enemy.dead
      && enemy.hp > 0
      && enemyOccupiesTargetRow(enemy, troop.row)
      && enemy.x >= minimumX
      && enemy.x <= maximumX
      && !ENEMIES[enemy.type]?.airborne
    ))
    .sort((left, right) => (
      right.hp - left.hp
      || right.maxHp - left.maxHp
      || Number(isHeavyEnemy(right)) - Number(isHeavyEnemy(left))
      || left.x - right.x
    ))[0] || null;
}

function startLeviathanCharge(session, troop, target, config, events) {
  troop.state = "charging";
  troop.stateStartedAt = session.elapsed;
  troop.stateEndsAt = session.elapsed + config.chargeMs;
  troop.attackTargetId = target.id;
  events.push({
    type: "leviathanChargeStarted",
    sourceTroopId: troop.id,
    targetId: target.id,
    x: troop.x,
    y: troop.y,
    color: config.color,
    seed: nextEffectSeed(session),
  });
}

function startLeviathanCooldown(session, troop, config, durationMs, events, cancelled = false) {
  troop.state = "cooldown";
  troop.stateStartedAt = session.elapsed;
  troop.stateEndsAt = session.elapsed + durationMs;
  troop.cooldownStartedAt = session.elapsed;
  troop.cooldownEndsAt = troop.stateEndsAt;
  troop.attackTargetId = null;
  troop.attackReleased = false;
  troop.attackReleaseAt = Infinity;
  events.push({
    type: cancelled ? "leviathanChargeCancelled" : "leviathanCooldownStarted",
    sourceTroopId: troop.id,
    x: troop.x,
    y: troop.y,
    durationMs,
    color: config.color,
    seed: nextEffectSeed(session),
  });
}

function finishLeviathanCooldown(session, troop) {
  troop.state = "idle";
  troop.stateStartedAt = session.elapsed;
  troop.stateEndsAt = Infinity;
  troop.cooldownStartedAt = null;
  troop.cooldownEndsAt = null;
  troop.attackTargetId = null;
  troop.attackReleased = false;
  troop.attackReleaseAt = Infinity;
}

function beginLeviathanAttack(session, troop, config) {
  troop.state = "attack";
  troop.stateStartedAt = session.elapsed;
  troop.stateEndsAt = session.elapsed + config.attackDurationMs;
  troop.attackReleased = false;
  troop.attackReleaseAt = session.elapsed + config.attackReleaseMs;
}

function fireLeviathanProjectile(session, troop, config, events) {
  const muzzle = getMuzzleWorldPosition(troop, config, 0, 4);
  session.projectiles.push({
    id: id("projectile"),
    kind: "leviathanRound",
    visualKind: "leviathanRound",
    sourceTroopId: troop.id,
    troopType: troop.type,
    row: troop.row,
    x: muzzle.x,
    y: muzzle.y,
    previousX: muzzle.x,
    previousY: muzzle.y,
    previousRenderX: muzzle.x,
    previousRenderY: muzzle.y,
    origin: { ...muzzle },
    vx: config.projectileSpeed,
    vy: 0,
    damage: config.damage * attackDamageMultiplier(session, troop),
    hitIds: [],
    maximumTargets: config.maximumTargets,
    damageFactors: [1, config.secondTargetDamageFactor],
    lightTargetDamageFactor: config.lightTargetDamageFactor,
    shieldIgnoreFactor: config.shieldIgnoreFactor,
    armorPierceFactor: config.armorPierceFactor,
    nimbarcaShieldIgnoreFactor: config.nimbarcaShieldIgnoreFactor,
    ruptureRequiredHits: config.ruptureRequiredHits,
    ruptureDamageTakenFactor: config.ruptureDamageTakenFactor,
    maxDistance: config.range * CELL.width,
    color: config.color,
    ageMs: 0,
    trail: createProjectileTrail(12, muzzle.x, muzzle.y),
    active: true,
    launched: true,
    launchAt: session.elapsed,
    seed: nextEffectSeed(session),
  });
  events.push({
    type: "leviathanFire",
    sourceTroopId: troop.id,
    targetId: troop.attackTargetId,
    x: muzzle.x,
    y: muzzle.y,
    color: config.color,
    seed: nextEffectSeed(session),
  });
}

export function applyStructuralRupture(session, enemy, config = TROOPS.cacadorLeviatas, events = []) {
  if (!isHeavyEnemy(enemy) || enemy.structuralRuptured) return false;
  enemy.structuralRuptureHits = Math.min(
    config.ruptureRequiredHits,
    Number(enemy.structuralRuptureHits || 0) + 1,
  );
  events.push({
    type: "structuralRuptureStack",
    targetId: enemy.id,
    stacks: enemy.structuralRuptureHits,
    required: config.ruptureRequiredHits,
    x: enemy.x,
    y: enemy.y,
    color: config.color,
    seed: nextEffectSeed(session),
  });
  if (enemy.structuralRuptureHits < config.ruptureRequiredHits) return false;
  enemy.structuralRuptured = true;
  enemy.structuralRuptureAppliedAt = session.elapsed;
  enemy.structuralRuptureDamageTakenFactor = config.ruptureDamageTakenFactor;
  events.push({
    type: "structuralRuptureApplied",
    targetId: enemy.id,
    x: enemy.x,
    y: enemy.y,
    color: config.color,
    seed: nextEffectSeed(session),
  });
  return true;
}

function updateLeviathanHunter(session, troop, config, events) {
  if (troop.state === "charging") {
    const target = indexedEnemyById(session, troop.attackTargetId);
    const targetTooClose = target && target.row === troop.row
      && target.x < troop.x + config.minRange * CELL.width;
    if (!target || targetTooClose) {
      startLeviathanCooldown(session, troop, config, config.failedChargeCooldownMs, events, true);
      return;
    }
    if (session.elapsed >= troop.stateEndsAt) beginLeviathanAttack(session, troop, config);
    return;
  }
  if (troop.state === "attack") {
    if (!troop.attackReleased && session.elapsed >= troop.attackReleaseAt) {
      fireLeviathanProjectile(session, troop, config, events);
      troop.attackReleased = true;
    }
    if (session.elapsed >= troop.stateEndsAt) {
      startLeviathanCooldown(session, troop, config, config.cooldownMs, events);
    }
    return;
  }
  if (troop.state === "cooldown") {
    if (session.elapsed >= troop.cooldownEndsAt) finishLeviathanCooldown(session, troop);
    return;
  }
  const target = selectLeviathanTarget(session, troop, config);
  if (target) startLeviathanCharge(session, troop, target, config, events);
}

function updateTroops(session, events, dt) {
  for (const troop of session.troops) {
    if (troop.dead || troop.windRecovery) continue;
    if (session.elapsed < (troop.controlStunnedUntil || 0) || session.elapsed < (troop.sporeConfusedUntil || 0)) {
      troop.defenseActive = false;
      continue;
    }
    if (troop.rasgamarCoiledBy) {
      troop.defenseActive = false;
      continue;
    }
    if (troop.type === "droneSentinela" && troop.state === "attack" && session.elapsed >= troop.stateEndsAt) {
      troop.state = "idle";
      troop.stateStartedAt = troop.stateEndsAt;
      troop.stateEndsAt = Infinity;
    }
    if (troop.type === "operadorJano" && ["attackRear", "attackFront"].includes(troop.droneState)
      && session.elapsed - Number(troop.droneStateStartedAt || 0) >= 480) {
      troop.droneState = "idle";
      troop.droneStateStartedAt = session.elapsed;
    }
    if (troop.type === "operadorJano" && troop.state === "attack"
      && session.elapsed >= troop.stateEndsAt) {
      troop.state = "idle";
      troop.stateStartedAt = session.elapsed;
      troop.stateEndsAt = Infinity;
      troop.lastAttackAt = -Infinity;
    }
    expireElectricState(troop, session.elapsed);
    if (isElectricParalyzed(troop, session.elapsed)) {
      troop.defenseActive = false;
      continue;
    }
    refreshTroopAttackSpeedFactor(session, troop);
    if (isSandBuried(session, troop)) {
      troop.defenseActive = false;
      continue;
    }
    const baseConfig = TROOPS[troop.type];
    const config = effectiveCombatConfig(session, troop, baseConfig);
    if (troop.type === "aresT") {
      if (troop.pendingAresImpact && session.elapsed >= troop.pendingAresImpact.at) {
        const lockedTarget = session.enemies.find((enemy) => enemy.id === troop.pendingAresImpact.targetId);
        const lockedObstacle = session.forestObstacles.find((tree) => tree.id === troop.pendingAresImpact.targetId);
        if (lockedObstacle?.alive) {
          const damage = config.damage * attackDamageMultiplier(session, troop, { target: null });
          damageForestObstacle(session, lockedObstacle, damage, events, stunEnemy);
          events.push({ type: "forestObstacleShot", sourceTroopId: troop.id, targetId: lockedObstacle.id, x: lockedObstacle.x, y: lockedObstacle.y, color: config.color });
        } else if (lockedTarget && !lockedTarget.dead && enemyOccupiesTargetRow(lockedTarget, troop.row)) {
          const damage = config.damage * attackDamageMultiplier(session, troop, { target: lockedTarget });
          damageEnemy(session, lockedTarget, damage, events, { direct: true, sourceX: troop.x, sourceTroopType: troop.type, sourceTroopId: troop.id });
          events.push({ type: "aresHydraulicPunch", sourceTroopId: troop.id, targetId: lockedTarget.id, x: lockedTarget.x, y: lockedTarget.y, color: config.color, seed: nextEffectSeed(session) });
        }
        troop.pendingAresImpact = null;
      }
      if (troop.state === "attack" && session.elapsed >= troop.stateEndsAt) {
        troop.state = "idle";
        troop.stateStartedAt = session.elapsed;
        troop.stateEndsAt = Infinity;
      }
      if (session.elapsed < troop.attackReadyAt) continue;
      const target = resolveTroopTarget(session, troop, config);
      if (!target) continue;
      const targetEntity = target.entity;
      troop.state = "attack";
      troop.stateStartedAt = session.elapsed;
      troop.stateEndsAt = session.elapsed + (config.attackVisual?.durationMs || 720);
      troop.lastAttackAt = session.elapsed;
      troop.attackTargetId = targetEntity.id;
      troop.pendingAresImpact = { targetId: targetEntity.id, at: session.elapsed + (config.attackVisual?.impactMs || 470) };
      troop.attackReadyAt = session.elapsed + attackIntervalFor(session, troop, config, config.attackEveryMs);
      continue;
    }
    if (config.attack === "leviathanCannon") {
      updateLeviathanHunter(session, troop, config, events);
      continue;
    }
    if (config.attack === "energy") {
      if (isTideReactorPaused(session, troop)) continue;
      if (session.elapsed < Number(troop.electricReactorPausedUntil || 0)) continue;
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
        damageEnemy: (target, amount) => damageEnemy(session, target, amount, events, { direct: true, sourceX: troop.x, sourceTroopType: troop.type, sourceTroopId: troop.id }),
        damageMultiplier: (target) => attackDamageMultiplier(session, troop, { target }),
        nextEffectSeed: () => nextEffectSeed(session),
        recoveryFor: (milliseconds) => attackIntervalFor(session, troop, config, milliseconds),
        launchRangedSlash: (source, target, visual) =>
          launchExecutorArcSlash(session, source, config, target, visual),
      });
      continue;
    }
    if (config.id === "interceptadorIcaro") {
      updateInterceptadorIcaro(session, troop, config, events, {
        createId: id,
        getMuzzleWorldPosition,
        nextEffectSeed: () => nextEffectSeed(session),
        recoveryFor: (milliseconds) => attackIntervalFor(session, troop, config, milliseconds),
      });
      continue;
    }
    if (config.id === "mantis") {
      const forestTarget = resolveTroopTarget(session, troop, config);
      if (forestTarget?.kind === "forestObstacle") {
        damageForestObstacle(session, forestTarget.entity, config.damage * attackDamageMultiplier(session, troop, { target: null }), events, stunEnemy);
        troop.attackReadyAt = session.elapsed + attackIntervalFor(session, troop, config, config.attackEveryMs);
        continue;
      }
      updateMantis(session, troop, config, events, {
        id,
        createProjectileTrail,
        getMuzzleWorldPosition,
        nextEffectSeed: () => nextEffectSeed(session),
        impactDamageMultiplier: (target) => attackDamageMultiplier(session, troop, { target }),
        detonationDamageMultiplier: (target) => attackDamageMultiplier(session, troop, { explosive: true, target }),
        detonationRadiusMultiplier: session.modifiers.explosiveRadius,
        recoveryFor: (milliseconds) => attackIntervalFor(session, troop, config, milliseconds),
        enemyOccupiesTargetRow,
        isEnemyTargetable,
        cellWidth: CELL.width,
        forestObstacleX: session.forestObstacles?.filter((tree) => tree.alive && tree.row === troop.row
          && tree.x > troop.x && tree.x - troop.x <= config.range * CELL.width)
          .sort((left, right) => left.x - right.x)[0]?.x ?? Infinity,
      });
      continue;
    }
    if (config.id === "fuzileiroVoltaico") {
      const forestTarget = resolveTroopTarget(session, troop, config);
      if (forestTarget?.kind === "forestObstacle") {
        damageForestObstacle(session, forestTarget.entity, config.damage * attackDamageMultiplier(session, troop, { target: null }), events, stunEnemy);
        troop.attackReadyAt = session.elapsed + attackIntervalFor(session, troop, config, config.attackEveryMs);
        continue;
      }
      updateFuzileiroVoltaico(session, troop, config, events, {
        occupiesTargetRow: enemyOccupiesTargetRow,
        damageEnemy: (target, amount, context) =>
          damageEnemy(session, target, amount, events, context),
        damageMultiplier: (target) => attackDamageMultiplier(session, troop, { target }),
        getMuzzlePosition: (frame) => getMuzzleWorldPosition(troop, config, 0, frame),
        getTargetPoint: (target, targetRow) =>
          enemyHitPointForRow(target, targetRow, session.elapsed),
        nextEffectSeed: () => nextEffectSeed(session),
        recoveryFor: (milliseconds) => attackIntervalFor(session, troop, config, milliseconds),
      });
      continue;
    }
    if (config.id === "bastiaoMare") {
      updateBastiaoMare(session, troop, config, events, {
        cellWidth: CELL.width,
        enemiesForRow: (row) => enemiesForRow(session, row),
        occupiesTargetRow: enemyOccupiesTargetRow,
        damageEnemy: (target, damage, context) =>
          damageEnemy(session, target, damage, events, context),
        damageMultiplier: (target) => attackDamageMultiplier(session, troop, { target }),
        recoveryFor: (milliseconds) => attackIntervalFor(session, troop, config, milliseconds),
        nextEffectSeed: () => nextEffectSeed(session),
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
    if (config.attack === "droneVolley") {
      const target = resolveTroopTarget(session, troop, config);
      if (!target) continue;
      if (target.kind === "forestObstacle") {
        fireTroop(session, troop, { ...config, attack: "bullet", burst: 1 }, target, events);
      } else fireDroneSentinela(session, troop, config, target.entity, events);
      continue;
    }
    if (config.attack === "janoDual") {
      const target = resolveTroopTarget(session, troop, config);
      const hasDroneTarget = session.enemies.some((enemy) => !enemy.dead && enemyOccupiesTargetRow(enemy, troop.row)
        && (enemy.x < troop.x || enemy.x - troop.x <= config.range * CELL.width));
      if (!target && !hasDroneTarget) continue;
      if (target?.kind === "forestObstacle") {
        fireTroop(session, troop, { ...config, attack: "bullet", burst: 1 }, target, events);
        troop.attackReadyAt = session.elapsed + attackIntervalFor(session, troop, config, config.attackEveryMs);
        troop.lastAttackAt = session.elapsed;
        continue;
      }
      fireOperadorJano(session, troop, config, target?.kind === "enemy" ? target.entity : null, events);
      troop.attackReadyAt = session.elapsed + attackIntervalFor(session, troop, config, config.attackEveryMs);
      troop.lastAttackAt = session.elapsed;
      continue;
    }
    if (config.attack === "mortar") {
      const group = mortarTargetGroup(session, troop, config);
      if (!group) continue;
      fireMortar(session, troop, config, group);
    } else {
      const target = resolveTroopTarget(session, troop, config);
      if (!target) continue;
      fireTroop(session, troop, config, target, events);
    }
    troop.attackReadyAt = session.elapsed + attackIntervalFor(session, troop, config, config.attackEveryMs);
    troop.lastAttackAt = session.elapsed;
  }
}

function applyCryoShock(session, projectile, target, events) {
  if (!target || target.dead) return;
  const targetConfig = ENEMIES[target.type] || {};
  const tags = targetConfig.enemyTags || targetConfig.traits || [];
  const thermalTarget = tags.includes("thermalAdapted");
  const fireTarget = tags.includes("fire");
  session.metrics.cryo7Hits += 1;
  if (thermalTarget) session.metrics.cryo7ThermalHits += 1;
  if (fireTarget) session.metrics.cryo7FireHits += 1;
  if (projectile.cryoThermalTarget) session.metrics.cryo7BonusDamage += Math.max(0, projectile.damage - TROOPS.cryo7.damage);
  if (targetConfig.controlImmune) {
    session.metrics.cryo7ShockImmuneTargets += 1;
    return;
  }
  if (session.elapsed < (target.cryoShockRecoveryUntil || 0)) {
    session.metrics.cryo7ShockBlockedByRecovery += 1;
    return;
  }
  const durationMs = fireTarget ? TROOPS.cryo7.fireCryoShockMs : TROOPS.cryo7.cryoShockMs;
  stunEnemy(session, target, durationMs);
  target.cryoFrozenUntil = Math.max(target.cryoFrozenUntil || 0, session.elapsed + durationMs);
  target.cryoShockRecoveryUntil = session.elapsed + TROOPS.cryo7.cryoShockRecoveryMs;
  session.metrics.cryo7ShockApplications += 1;
  if (fireTarget) session.metrics.cryo7FireFreezeMs += durationMs;
  else session.metrics.cryo7NormalFreezeMs += durationMs;
  events.push({
    type: "cryoShock", targetId: target.id, sourceTroopId: projectile.sourceTroopId,
    durationMs, fireTarget, x: target.x, y: target.y - 32, color: TROOPS.cryo7.color, seed: projectile.seed,
  });
}

function updateProjectiles(session, dt, events) {
  for (const projectile of session.projectiles) {
    if (!projectile.active) continue;
    if (session.elapsed < projectile.launchAt) continue;
    if (!projectile.launched) {
      if (projectile.kind === "cryoJet") {
        const lockedTarget = projectile.targetKind === "forestObstacle"
          ? null
          : indexedEnemyById(session, projectile.targetId);
        if (projectile.targetKind !== "forestObstacle" && !isEnemyTargetable(lockedTarget)) {
          projectile.active = false;
          continue;
        }
        const sourceTroop = indexedTroopById(session, projectile.sourceTroopId);
        if (sourceTroop) {
          const removed = coolThermalPlatform(
            session, sourceTroop.row, sourceTroop.col,
            TROOPS.cryo7.platformCoolingPercentPerShot,
            sourceTroop.id, events,
          );
          session.metrics.cryo7PlatformHeatRemoved += removed;
        }
      }
      projectile.launched = true;
      if (projectile.kind === "cryoJet") session.metrics.cryo7Shots += 1;
      if (projectile.kind !== "mantisSpike") {
        events.push({
          type: projectile.kind === "mine" ? "mineLaunch" : "shoot", weapon: projectile.visualKind, troopType: projectile.troopType,
          sourceTroopId: projectile.sourceTroopId, shotIndex: projectile.shotIndex,
          x: projectile.x, y: projectile.y, color: projectile.color, seed: projectile.seed,
        });
      }
    }
    projectile.ageMs += dt;
    if (projectile.kind === "leviathanRound") {
      projectile.previousX = projectile.x;
      projectile.previousY = projectile.y;
      projectile.previousRenderX = projectile.x;
      projectile.previousRenderY = projectile.y;
      projectile.x += projectile.vx * dt / 1000;
      projectile.y += projectile.vy * dt / 1000;
      pushProjectileTrail(projectile.trail, projectile.x, projectile.y);
      const crossed = session.enemies
        .filter((enemy) => (
          !enemy.dead
          && enemy.hp > 0
          && enemyOccupiesTargetRow(enemy, projectile.row)
          && !ENEMIES[enemy.type]?.airborne
          && !projectile.hitIds.includes(enemy.id)
          && enemy.x >= Math.min(projectile.previousX, projectile.x)
          && enemy.x <= Math.max(projectile.previousX, projectile.x)
        ))
        .sort((left, right) => left.x - right.x);
      for (const enemy of crossed) {
        if (projectile.hitIds.length >= projectile.maximumTargets) break;
        const hitIndex = projectile.hitIds.length;
        const damageFactor = projectile.damageFactors[hitIndex] ?? 0;
        const targetClassFactor = ENEMIES[enemy.type]?.armorClass === "light"
          ? projectile.lightTargetDamageFactor
          : 1;
        projectile.hitIds.push(enemy.id);
        damageEnemy(
          session,
          enemy,
          projectile.damage * damageFactor * targetClassFactor,
          events,
          {
            direct: true,
            ranged: true,
            sourceX: projectile.origin.x,
            sourceTroopId: projectile.sourceTroopId,
            sourceTroopType: projectile.troopType,
            shieldIgnoreFactor: projectile.shieldIgnoreFactor,
            armorPierceFactor: projectile.armorPierceFactor,
            nimbarcaShieldIgnoreFactor: projectile.nimbarcaShieldIgnoreFactor,
          },
        );
        applyStructuralRupture(session, enemy, {
          ruptureRequiredHits: projectile.ruptureRequiredHits,
          ruptureDamageTakenFactor: projectile.ruptureDamageTakenFactor,
          color: projectile.color,
        }, events);
        const hitPoint = getEnemyHitPoint(enemy, ENEMIES[enemy.type]);
        events.push({
          type: hitIndex === 0 ? "leviathanImpact" : "leviathanSecondImpact",
          weapon: projectile.visualKind,
          sourceTroopId: projectile.sourceTroopId,
          targetId: enemy.id,
          x: hitPoint.x,
          y: hitPoint.y,
          color: projectile.color,
          seed: projectile.seed + hitIndex,
        });
      }
      const distanceTravelled = projectile.x - projectile.origin.x;
      if (projectile.hitIds.length >= projectile.maximumTargets
        || distanceTravelled >= projectile.maxDistance
        || projectile.x > FIELD.width + 80) {
        projectile.active = false;
      }
      continue;
    }
    if (projectile.kind === "icaroBullet" || projectile.kind === "icaroInterceptionShot") {
      const config = TROOPS.interceptadorIcaro;
      const source = indexedTroopById(session, projectile.sourceTroopId);
      let target = indexedEnemyById(session, projectile.targetId);
      if (!isEnemyTargetable(target)) target = null;
      if (!target && !projectile.special) {
        target = selectIcaroBurstRetarget(session, projectile, config);
        projectile.targetId = target?.id || null;
      }
      if (!target || (projectile.special && !isIcaroAirTarget(target))) {
        projectile.active = false;
        continue;
      }
      const targetPoint = getEnemyHitPoint(target, ENEMIES[target.type]);
      const angle = Math.atan2(targetPoint.y - projectile.y, targetPoint.x - projectile.x);
      projectile.vx = Math.cos(angle) * projectile.speed;
      projectile.vy = Math.sin(angle) * projectile.speed;
      projectile.previousX = projectile.x;
      projectile.previousY = projectile.y;
      projectile.previousRenderX = projectile.x;
      projectile.previousRenderY = projectile.y;
      projectile.x += projectile.vx * dt / 1000;
      projectile.y += projectile.vy * dt / 1000;
      pushProjectileTrail(projectile.trail, projectile.x, projectile.y);
      const hit = Math.hypot(targetPoint.x - projectile.x, targetPoint.y - projectile.y)
        <= Math.max(32, projectile.speed * dt / 1000);
      if (!hit) {
        if (projectile.ageMs <= 3000) continue;
        projectile.active = false;
        continue;
      }
      const targetFactor = projectile.special
        ? 1
        : isIcaroAirTarget(target) ? config.airborneDamageFactor : config.groundDamageFactor;
      const decisionFactor = source
        ? attackDamageMultiplier(session, source, { target })
        : session.modifiers.troopDamage;
      damageEnemy(session, target, projectile.baseDamage * targetFactor * decisionFactor, events, {
        direct: true,
        ranged: true,
        sourceX: projectile.origin.x,
        sourceTroopType: projectile.troopType,
        sourceTroopId: projectile.sourceTroopId,
        nimbarcaShieldIgnoreFactor: config.nimbarcaShieldIgnoreFactor,
      });
      events.push({
        type: projectile.special ? "icaroInterceptionImpact" : "icaroBulletImpact",
        weapon: projectile.visualKind,
        sourceTroopId: projectile.sourceTroopId,
        targetId: target.id,
        x: targetPoint.x,
        y: targetPoint.y,
        color: projectile.color,
        seed: projectile.seed,
      });
      projectile.active = false;
      continue;
    }
    if (projectile.kind === "mantisSpike") {
      if (projectile.phase === "pending") {
        if (session.elapsed < projectile.launchAt) continue;
        let target = indexedEnemyById(session, projectile.targetId);
        if (!isEnemyTargetable(target) || !enemyOccupiesTargetRow(target, projectile.targetRow)) {
          target = session.enemies
            .filter((enemy) => isEnemyTargetable(enemy) && enemyOccupiesTargetRow(enemy, projectile.targetRow)
              && enemy.x >= projectile.origin.x && enemy.x - projectile.origin.x <= TROOPS.mantis.range * CELL.width)
            .sort((left, right) => right.x - left.x)[0] || null;
          projectile.targetId = target?.id || null;
        }
        if (!target) { projectile.active = false; continue; }
        initializeMantisFlightPath(projectile, getEnemyHitPoint(target, ENEMIES[target.type]));
        projectile.phase = "flight";
        projectile.flightStartedAt = session.elapsed;
        projectile.launched = true;
        session.metrics.mantisSpikesLaunched = (session.metrics.mantisSpikesLaunched || 0) + 1;
        events.push({ type: "shoot", weapon: "mantisSpike", troopType: projectile.troopType, sourceTroopId: projectile.sourceTroopId, shotIndex: projectile.shotIndex, x: projectile.x, y: projectile.y, color: projectile.color, seed: projectile.seed });
      }
      if (projectile.phase === "flight") {
        let target = indexedEnemyById(session, projectile.targetId);
        if (!isEnemyTargetable(target) || !enemyOccupiesTargetRow(target, projectile.targetRow)) {
          target = session.enemies
            .filter((enemy) => isEnemyTargetable(enemy) && enemyOccupiesTargetRow(enemy, projectile.targetRow)
              && enemy.x >= projectile.x && enemy.x - projectile.x <= TROOPS.mantis.range * CELL.width)
            .sort((left, right) => right.x - left.x)[0] || null;
          if (target) projectile.targetId = target.id;
        }
        const targetPoint = target && isEnemyTargetable(target)
          ? getEnemyHitPoint(target, ENEMIES[target.type])
          : { x: projectile.attachedX ?? projectile.x + 80, y: projectile.attachedY ?? projectile.y };
        const progress = Math.max(0, Math.min(1, (session.elapsed - projectile.flightStartedAt) / projectile.flightMs));
        const nextPoint = sampleMantisArc(projectile, targetPoint, progress);
        const nextX = nextPoint.x;
        const nextY = nextPoint.y;
        projectile.previousX = projectile.x; projectile.previousY = projectile.y;
        projectile.previousRenderX = projectile.x; projectile.previousRenderY = projectile.y;
        projectile.x = nextX; projectile.y = nextY;
        projectile.vx = (nextX - projectile.previousX) * 1000 / Math.max(1, dt);
        projectile.vy = (nextY - projectile.previousY) * 1000 / Math.max(1, dt);
        pushProjectileTrail(projectile.trail, projectile.x, projectile.y);
        if (progress < 1) continue;
        projectile.attachedX = targetPoint.x; projectile.attachedY = targetPoint.y;
        projectile.x = targetPoint.x; projectile.y = targetPoint.y;
        if (target && isEnemyTargetable(target)) {
          damageEnemy(session, target, projectile.impactDamage, events, {
            direct: true, ranged: true, sourceX: projectile.origin.x,
            sourceTroopType: projectile.troopType, sourceTroopId: projectile.sourceTroopId,
          });
          session.metrics.mantisSpikeImpacts = (session.metrics.mantisSpikeImpacts || 0) + 1;
          session.metrics.mantisDamageDealt = (session.metrics.mantisDamageDealt || 0) + projectile.impactDamage;
          events.push({ type: "mantisSpikeImpact", weapon: projectile.visualKind, sourceTroopId: projectile.sourceTroopId, targetId: target.id, x: targetPoint.x, y: targetPoint.y, color: projectile.color, seed: projectile.seed });
        }
        projectile.phase = "attached";
        projectile.attachedTargetId = target?.id || projectile.targetId;
        projectile.detonateAt = session.elapsed + projectile.detonationDelayMs;
        continue;
      }
      if (projectile.phase === "attached") {
        const attachedTarget = indexedEnemyById(session, projectile.attachedTargetId);
        if (attachedTarget && !attachedTarget.dead) {
          const point = getEnemyHitPoint(attachedTarget, ENEMIES[attachedTarget.type]);
          projectile.attachedX = point.x; projectile.attachedY = point.y;
          projectile.x = point.x; projectile.y = point.y;
        } else {
          projectile.x = projectile.attachedX; projectile.y = projectile.attachedY;
        }
        projectile.detonationProgress = Math.max(0, Math.min(1,
          1 - (projectile.detonateAt - session.elapsed) / Math.max(1, projectile.detonationDelayMs)));
        if (session.elapsed < projectile.detonateAt) continue;
        const affected = session.enemies.filter((enemy) => !enemy.dead && enemyOccupiesTargetRow(enemy, projectile.targetRow)
          && Math.hypot(enemy.x - projectile.attachedX, enemy.y - projectile.attachedY) <= projectile.detonationRadius);
        affected.forEach((enemy) => {
          damageEnemy(session, enemy, projectile.detonationDamage, events, {
            direct: true, ranged: true, sourceX: projectile.origin.x,
            sourceTroopType: projectile.troopType, sourceTroopId: projectile.sourceTroopId,
          });
          session.metrics.mantisExplosionHits = (session.metrics.mantisExplosionHits || 0) + 1;
          if (enemy.id !== projectile.attachedTargetId) session.metrics.mantisCollateralHits = (session.metrics.mantisCollateralHits || 0) + 1;
          session.metrics.mantisDamageDealt = (session.metrics.mantisDamageDealt || 0) + projectile.detonationDamage;
        });
        session.metrics.mantisSpikeDetonations = (session.metrics.mantisSpikeDetonations || 0) + 1;
        events.push({ type: "mantisSpikeDetonation", weapon: projectile.visualKind, sourceTroopId: projectile.sourceTroopId, targetId: projectile.attachedTargetId, targetIds: affected.map((enemy) => enemy.id), x: projectile.attachedX, y: projectile.attachedY, radius: projectile.detonationRadius, color: projectile.color, seed: projectile.seed });
        projectile.active = false;
      }
      continue;
    }
    if (projectile.kind === "executorArcSlash") {
      if (projectile.phase === "impact") {
        projectile.phaseAgeMs += dt;
        if (session.elapsed >= projectile.impactStartedAt + 360) projectile.active = false;
        continue;
      }
      const target = indexedEnemyById(session, projectile.targetId);
      if (!isEnemyTargetable(target)) { projectile.active = false; continue; }
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
      pushProjectileTrail(projectile.trail, projectile.x, projectile.y);
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
        sourceTroopId: projectile.sourceTroopId,
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
      const target = projectile.targetKind === "forestObstacle"
        ? session.forestObstacles?.find((tree) => tree.id === projectile.targetId) || null
        : indexedEnemyById(session, projectile.targetId);
      const source = indexedTroopById(session, projectile.sourceTroopId);
      if (!target && projectile.targetKind !== "forestObstacle") {
        projectile.active = false;
        if (source?.pendingRepulsorShot === projectile.id) source.pendingRepulsorShot = null;
        continue;
      }
      const targetPoint = projectile.targetKind === "forestObstacle"
        ? { x: projectile.targetX, y: projectile.targetY }
        : getEnemyHitPoint(target, ENEMIES[target.type]);
      projectile.previousX = projectile.x;
      projectile.previousY = projectile.y;
      projectile.previousRenderX = projectile.x;
      projectile.previousRenderY = projectile.y;
      projectile.x += projectile.vx * dt / 1000;
      projectile.y += projectile.vy * dt / 1000;
      pushProjectileTrail(projectile.trail, projectile.x, projectile.y);
      const crossedTarget = projectile.previousX <= targetPoint.x + 24 && projectile.x >= targetPoint.x - 24;
      const closeToTarget = Math.hypot(targetPoint.x - projectile.x, targetPoint.y - projectile.y) <= 32;
      if (!crossedTarget && !closeToTarget) {
        if (projectile.x <= FIELD.width + 80) continue;
        projectile.active = false;
        if (source?.pendingRepulsorShot === projectile.id) source.pendingRepulsorShot = null;
        continue;
      }

      if (projectile.targetKind === "forestObstacle") {
        if (target?.alive) damageForestObstacle(session, target, projectile.damage, events, stunEnemy);
        events.push({ type: "forestObstacleProjectileImpact", weapon: projectile.visualKind, targetId: projectile.targetId, x: targetPoint.x, y: targetPoint.y, color: projectile.color, seed: projectile.seed });
        projectile.active = false;
        if (source?.pendingRepulsorShot === projectile.id) source.pendingRepulsorShot = null;
        continue;
      }
      damageEnemy(session, target, projectile.damage, events, { direct: true, sourceX: source?.x ?? projectile.origin?.x, sourceTroopType: projectile.troopType, sourceTroopId: projectile.sourceTroopId });
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
      pushProjectileTrail(projectile.trail, projectile.x, projectile.y);
      if (progress >= 1) {
        const occupants = session.enemies.filter((enemy) => !enemy.dead
          && enemyOccupiesTargetRow(enemy, projectile.targetRow)
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
    if (projectile.kind === "cryoJet") {
      target = projectile.targetKind === "forestObstacle"
        ? session.forestObstacles?.find((tree) => tree.id === projectile.targetId)
          || { id: projectile.targetId, alive: false, x: projectile.targetX, y: projectile.targetY }
        : indexedEnemyById(session, projectile.targetId);
      if (!isEnemyTargetable(target) || !enemyOccupiesTargetRow(target, projectile.row)) target = null;
    } else if (projectile.straightLane) {
      target = null;
      for (const enemy of enemiesForRow(session, projectile.row)) {
        if (!enemyOccupiesTargetRow(enemy, projectile.row) || enemy.x < projectile.previousX - 24) continue;
        if (!target || enemy.x < target.x) target = enemy;
      }
    } else {
      target = indexedEnemyById(session, projectile.targetId);
      if (!isEnemyTargetable(target)) target = null;
      if (!target) {
        let closestDistanceSquared = Infinity;
        for (const enemy of session.enemies) {
          if (!isEnemyTargetable(enemy) || !enemyOccupiesTargetRow(enemy, projectile.row)) continue;
          const dx = enemy.x - projectile.x;
          const dy = enemy.y - projectile.y;
          const distanceSquared = dx * dx + dy * dy;
          if (distanceSquared < closestDistanceSquared) {
          target = enemy;
            closestDistanceSquared = distanceSquared;
          }
        }
      }
    }
    const targetPoint = target
      ? projectile.targetKind === "forestObstacle" ? getForestObstacleHitPoint(target) : getEnemyHitPoint(target, ENEMIES[target.type])
      : (projectile.targetKind === "forestObstacle" ? { x: projectile.targetX, y: projectile.targetY } : null);
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
    pushProjectileTrail(projectile.trail, projectile.x, projectile.y);
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
      if (projectile.targetKind === "forestObstacle") {
        if (target?.alive) damageForestObstacle(session, target, projectile.damage, events, stunEnemy);
        events.push({ type: "forestObstacleProjectileImpact", weapon: projectile.visualKind, targetId: projectile.targetId, x: targetPoint.x, y: targetPoint.y, color: projectile.color, seed: projectile.seed });
      } else if (projectile.kind === "missile") {
        const affected = session.enemies.filter((enemy) => !enemy.dead && Math.hypot(enemy.x - target.x, enemy.y - target.y) <= projectile.radius);
        affected.forEach((enemy) => damageEnemy(session, enemy, projectile.damage, events));
        affected.forEach((enemy) => applyConcussiveImpact(session, enemy));
        events.push({ type: "explosion", weapon: projectile.visualKind, x: targetPoint.x, y: targetPoint.y, color: projectile.color, seed: projectile.seed });
      } else {
        const derivanteDodging = target.type === "derivante"
          && ["jumpTakeoff", "jumping"].includes(target.chapterFourState);
        if (derivanteDodging) {
          events.push({
            type: "derivanteProjectileDodged",
            enemyId: target.id,
            projectileId: projectile.id,
            x: target.x,
            y: target.y,
          });
        } else {
          damageEnemy(session, target, projectile.damage, events, { direct: true, sourceX: projectile.origin.x });
          if (projectile.kind === "cryoJet" && !derivanteDodging) {
            applyCryoShock(session, projectile, target, events);
          }
        }
        events.push({
          type: projectile.kind === "ice" ? "iceImpact" : projectile.kind === "cryoJet" ? "cryoImpact" : projectile.kind === "fireball" ? "fireImpact" : "projectileImpact",
          weapon: projectile.visualKind, x: targetPoint.x, y: targetPoint.y,
          color: projectile.color, seed: projectile.seed,
        });
      }
      if (projectile.targetKind === "enemy" && projectile.kind === "ice" && !target.dead && !ENEMIES[target.type]?.controlImmune) {
        target.slowFactor = projectile.slowFactor;
        const controlFactor = (session.modifiers.supportDoctrine ? 1.1 : 1)
          * (session.modifiers.territorialControl ? 1.15 : 1);
        target.slowUntil = session.elapsed + projectile.slowMs * session.modifiers.slowDuration
          * session.modifiers.krioSlowDuration * controlFactor;
      }
      projectile.active = false;
    }
  }
  compactActive(session.projectiles, (projectile) => projectile.active);
}

function pulseForRow(session, row) {
  return session.dematerializationPulses?.find((pulse) => pulse.row === row) || null;
}

export function activateDematerializationPulse(session, row, options = {}) {
  if (!isSystemEnabledForPhase(session.phase, "dematerializationPulse")) {
    return { ok: false, reason: "Sistema indisponível nesta missão.", row, events: [] };
  }
  const source = options.source || "player";
  const targetRow = clamp(Math.floor(Number(row)), 0, FIELD.rows - 1);
  const externalEvents = Array.isArray(options.events) ? options.events : [];
  const before = externalEvents.length;
  const result = beginDematerializationPulse(session, targetRow, {
    source,
    reason: options.reason || null,
    events: externalEvents,
    requireTargets: options.requireTargets ?? source !== "automatic",
    hasTargets: getDematerializationPulseTargets(session, targetRow).length > 0,
  });
  return {
    ...result,
    row: targetRow,
    events: externalEvents.slice(before),
  };
}

function disintegrateEnemy(session, enemy, events) {
  if (!enemy || enemy.dead) return;
  if (enemy.type === "enguiaRasgamar" && enemy.rasgamarSubmerged) return;
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

function applyDematerializationPulseDamage(session, pulse, enemy, events) {
  if (!enemy || enemy.dead || enemy.hp <= 0 || !enemyOccupiesTargetRow(enemy, pulse.row)) return;
  const hpBefore = Math.max(0, Number(enemy.hp) || 0);
  const damage = Math.min(DEMATERIALIZATION_PULSE.damage, hpBefore);
  enemy.hp = Math.max(0, hpBefore - damage);
  const killed = enemy.hp <= 0;
  events.push({
    type: "pulseHit",
    row: pulse.row,
    cannonId: pulse.id,
    source: pulse.activationSource || "automatic",
    reason: pulse.activationReason || null,
    enemyId: enemy.id,
    targetId: enemy.id,
    damage,
    hpBefore,
    hpAfter: enemy.hp,
    killed,
    x: enemy.x,
    y: enemy.y,
    color: "#22d3ee",
  });
  if (killed) {
    events.push({
      type: "pulseKill", row: pulse.row, cannonId: pulse.id, enemyId: enemy.id, damage,
      source: pulse.activationSource || "automatic", reason: pulse.activationReason || null,
      x: enemy.x, y: enemy.y, color: "#22d3ee",
    });
    disintegrateEnemy(session, enemy, events);
  }
}

function updateDematerializationPulses(session, events) {
  for (const pulse of session.dematerializationPulses || []) {
    if (pulse.state !== "charging" || session.elapsed < pulse.fireAt) continue;
    pulse.state = "spent";
    const y = pulse.row * CELL.height + CELL.height / 2;
    const targets = getDematerializationPulseTargets(session, pulse.row);
    const hpBefore = targets.reduce((total, enemy) => total + Math.max(0, Number(enemy.hp) || 0), 0);
    events.push({
      type: "pulseFired",
      row: pulse.row,
      cannonId: pulse.id,
      source: pulse.activationSource || "automatic",
      reason: pulse.activationReason || null,
      damagePerTarget: DEMATERIALIZATION_PULSE.damage,
      targetCount: targets.length,
      x0: FIELD.combatOffsetX - 4,
      y0: y,
      x1: FIELD.width + 24,
      y1: y,
      bornAt: session.elapsed,
      color: "#22d3ee",
      seed: nextEffectSeed(session),
    });
    targets.forEach((enemy) => applyDematerializationPulseDamage(session, pulse, enemy, events));
    const hpAfter = targets.reduce((total, enemy) => total + Math.max(0, Number(enemy.hp) || 0), 0);
    events.push({
      type: "pulseResolved",
      row: pulse.row,
      cannonId: pulse.id,
      source: pulse.activationSource || "automatic",
      reason: pulse.activationReason || null,
      damage: Math.max(0, hpBefore - hpAfter),
      kills: targets.filter((enemy) => enemy.dead).length,
      targetCount: targets.length,
    });
  }
  compactActive(session.enemies, (enemy) => !enemy.dead);
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

function resolveEnemyBreach(session, enemy, events) {
  const pulse = pulseForRow(session, enemy.row);
  if (pulse?.state === "ready") {
    const activation = activateDematerializationPulse(session, enemy.row, {
      source: "automatic",
      reason: "barrierBreach",
      requireTargets: false,
      events,
    });
    if (activation.ok) {
      enemy.x = FIELD.baseX;
      enemy.moving = false;
      return false;
    }
  }
  if (pulse?.state === "charging") {
    enemy.x = FIELD.baseX;
    enemy.moving = false;
    return false;
  }
  enemy.dead = true;
  const shielded = !session.sandbox && session.shieldCharges > 0 && !ENEMIES[enemy.type]?.boss;
  if (shielded) session.shieldCharges -= 1;
  const breachDamage = shielded ? 0 : enemy.baseDamage * session.currentWaveBaseDamageFactor * (session.sandboxSettings?.enemyDamageMultiplier ?? 1);
  if (!session.sandboxSettings?.invulnerableBase) session.integrity = Math.max(0, session.integrity - breachDamage);
  if (shielded) events.push({ type: "shieldBlock", x: FIELD.baseX, y: enemy.y, remaining: session.shieldCharges });
  events.push({ type: "breach", damage: breachDamage, x: FIELD.baseX, y: enemy.y });
  return true;
}

function moveEnemy(session, enemy, dt, events) {
  enemy.moving = true;
  const baseSlow = session.elapsed < enemy.slowUntil ? enemy.slowFactor : 1;
  const slow = getTideAdjustedEnemySlowFactor(session, enemy, baseSlow);
  const swarmSpeed = getSilicaDiggerSwarmSpeedFactor(session, enemy);
  const tideSpeed = getTideEnemySpeedFactor(session, enemy);
  const leviathanVortexSpeed = session.elapsed < (enemy.leviathanVortexSpeedUntil || 0)
    ? enemy.leviathanVortexSpeedFactor || 1
    : 1;
  enemy.x -= enemy.speed * swarmSpeed * tideSpeed * session.modifiers.enemySpeed
    * leviathanVortexSpeed * (session.sandboxSettings?.enemySpeedMultiplier ?? 1) * slow * dt / 1000;
  if (enemy.x > FIELD.baseX) return;

  resolveEnemyBreach(session, enemy, events);
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
  let count = 0;
  const diggers = getBattleIndex(session)?.enemiesByType.get("silicaDigger") || session.enemies;
  for (const candidate of diggers) {
    if (!candidate.dead && candidate.type === "silicaDigger"
      && candidate.summonerId === queen.id) count += 1;
  }
  return count;
}

function workerQueenHasForwardDigger(session, queen) {
  for (const candidate of enemiesForRow(session, queen.row)) {
    if (!candidate.dead && candidate.type === "silicaDigger"
      && candidate.row === queen.row && candidate.x < queen.x) return true;
  }
  return false;
}

function countWorkerQueenForwardTroops(session, queen) {
  let count = 0;
  for (const troop of troopsForRow(session, queen.row)) {
    if (!troop.dead && troop.row === queen.row && troop.x < queen.x) count += 1;
  }
  return count;
}

function countWorkerQueenGuards(session, queen) {
  let count = 0;
  const diggers = getBattleIndex(session)?.enemiesByType.get("silicaDigger") || session.enemies;
  for (const candidate of diggers) {
    if (!candidate.dead && candidate.type === "silicaDigger"
      && candidate.queenGuardOwnerId === queen.id) count += 1;
  }
  return count;
}

function workerQueenGuardTier(enemy, config) {
  const distanceTiles = Math.max(0, (enemy.x - FIELD.baseX) / CELL.width);
  const tier = config.guardDistanceTiers.find((entry) => distanceTiles >= entry.minDistanceTiles)
    || config.guardDistanceTiers.at(-1);
  return { distanceTiles, tier };
}

function maintainWorkerQueenGuard(session, enemy, config, events) {
  if (countWorkerQueenForwardTroops(session, enemy) < 3
    || session.elapsed < enemy.queenGuardReadyAt
    || workerQueenHasForwardDigger(session, enemy)) return;
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
    trail: createProjectileTrail(14, origin.x, origin.y),
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
  let closest = null;
  for (const troop of troopsForRow(session, enemy.row)) {
    if (troop.dead || troop.row !== enemy.row || troop.x > enemy.x
      || enemy.x - troop.x > range * CELL.width) continue;
    if (!closest || troop.x > closest.x) closest = troop;
  }
  return closest;
}

function troopBlockDistance(troop) {
  return Number(troop?.blockDistancePx || TROOPS[troop?.type]?.blockDistancePx)
    || (troop?.type === "colossoImpacto" ? 48 : 54);
}

function gorjalContactDistance(troop, config) {
  return Math.max(troopBlockDistance(troop), config.meleeContactDistancePx || 115);
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
    trail: createProjectileTrail(14, origin.x, origin.y), ageMs: 0, seed,
  });
  events.push({
    type: "shoot", weapon: visualKind, faction: "enemy", sourceEnemyId: enemy.id,
    x: origin.x, y: origin.y, color: config.color, seed,
  });
}

function applyEnemyElectricCharge(session, enemy, target, events, options = {}) {
  const result = applyElectricCharge(target, session.elapsed, {
    stacks: options.stacks || 1,
    troopType: target.type,
    paralysisDurationMs: options.paralysisDurationMs,
  });
  if (result.ignored) return result;
  events.push({
    type: "electricCharge",
    sourceEnemyId: enemy.id,
    targetTroopId: target.id,
    x: target.x,
    y: target.y - 24,
    stacks: result.stacks,
    appliedStacks: result.appliedStacks,
    paralyzed: result.paralyzed,
    color: ENEMIES[enemy.type].color,
    seed: nextEffectSeed(session),
  });
  if (enemy.type === "voltriz" && result.paralyzed) {
    enemy.voltrizTargetId = null;
    enemy.moving = true;
    setChapterFourState(session, enemy, "flying");
  }
  return result;
}

function launchElectricProjectile(session, enemy, config, target, events) {
  const origin = getEnemyMuzzleWorldPosition(enemy, config);
  const flightSeconds = Math.max(0.1, (origin.x - target.x) / config.projectileSpeed);
  const seed = nextEffectSeed(session);
  session.enemyProjectiles.push({
    id: id("enemy_projectile"), kind: "electric",
    visualKind: config.attackVisual?.effect || "ionicSpine",
    sourceEnemyId: enemy.id, targetTroopId: target.id, row: enemy.row,
    x: origin.x, y: origin.y,
    previousX: origin.x, previousY: origin.y,
    previousRenderX: origin.x, previousRenderY: origin.y,
    vx: -config.projectileSpeed,
    vy: (target.y - 18 - origin.y) / flightSeconds,
    damage: enemy.damage, color: config.color, active: true, launched: true,
    targetingVoltriz: enemy.type === "voltriz",
    trail: createProjectileTrail(14, origin.x, origin.y), ageMs: 0, seed,
  });
  events.push({
    type: "shoot", weapon: config.attackVisual?.effect || "ionicSpine",
    faction: "enemy", sourceEnemyId: enemy.id,
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

function applyCuspidorEmberBurn(session, troop, projectile, events) {
  if (!troop || troop.dead) return;
  if (TROOPS[troop.type]?.emberBurnImmune) {
    events.push({ type: "emberBurnImmune", sourceEnemyId: projectile.sourceEnemyId, targetTroopId: troop.id, x: troop.x, y: troop.y - 42, color: "#67e8f9", seed: projectile.seed });
    return;
  }
  const durationMs = projectile.burnDurationMs * (TROOPS[troop.type]?.emberBurnDurationFactor ?? 1);
  const wasBurning = Number(troop.emberBurnUntil || 0) > session.elapsed;
  troop.emberBurnUntil = Math.max(Number(troop.emberBurnUntil || 0), session.elapsed + durationMs);
  if (!wasBurning || !Number.isFinite(troop.emberBurnNextTickAt) || troop.emberBurnNextTickAt <= 0) {
    troop.emberBurnNextTickAt = session.elapsed + projectile.burnTickEveryMs;
    troop.emberBurnStartedAt = session.elapsed;
  }
  troop.emberBurnSourceEnemyId = projectile.sourceEnemyId;
  troop.emberBurnTickEveryMs = projectile.burnTickEveryMs;
  events.push({
    type: wasBurning ? "emberBurnRenewed" : "emberBurnStarted",
    sourceEnemyId: projectile.sourceEnemyId, targetTroopId: troop.id,
    durationMs, damagePerSecond: projectile.burnDamagePerSecond,
    x: troop.x, y: troop.y, color: projectile.color, seed: projectile.seed,
  });
}

function resolveCuspidorEmberGlobImpact(session, projectile, events) {
  const directTarget = indexedTroopById(session, projectile.targetTroopId);
  if (directTarget && !directTarget.dead) {
    damageTroop(session, directTarget, projectile.damage, events, { sourceEnemyId: projectile.sourceEnemyId, damageType: DAMAGE_TYPES.FIRE });
    applyCuspidorEmberBurn(session, directTarget, projectile, events);
  }
  const splashTargets = session.troops.filter((troop) => (
    !troop.dead
    && troop.id !== projectile.targetTroopId
    && (!projectile.splashSameRowOnly || troop.row === projectile.targetRow)
    && Math.abs(troop.x - projectile.targetX) <= projectile.splashRadiusPx
  ));
  for (const troop of splashTargets) {
    damageTroop(session, troop, projectile.splashDamage, events, { sourceEnemyId: projectile.sourceEnemyId, damageType: DAMAGE_TYPES.FIRE });
  }
  events.push({
    type: "emberGlobImpact", weapon: projectile.visualKind,
    sourceEnemyId: projectile.sourceEnemyId, targetTroopId: projectile.targetTroopId,
    x: projectile.targetX, y: projectile.targetY, color: projectile.color, seed: projectile.seed,
    directDamage: projectile.damage, splashDamage: projectile.splashDamage,
  });
}

function updateEmberBurns(session, events) {
  for (const troop of session.troops) {
    if (troop.dead) continue;
    const until = Number(troop.emberBurnUntil || 0);
    if (until <= 0) continue;
    while (troop.emberBurnNextTickAt <= session.elapsed && troop.emberBurnNextTickAt <= until) {
      const sourceEnemyId = troop.emberBurnSourceEnemyId;
      damageTroop(session, troop, 0.75, events, { sourceEnemyId, generateEnergy: false });
      events.push({
        type: "emberBurnTick", sourceEnemyId, targetTroopId: troop.id,
        damage: 0.75, x: troop.x, y: troop.y, color: "#f97316",
      });
      troop.emberBurnNextTickAt += Number(troop.emberBurnTickEveryMs) || 500;
      if (troop.dead) break;
    }
    if (!troop.dead && session.elapsed >= until) {
      troop.emberBurnEndedAt = session.elapsed;
      troop.emberBurnUntil = 0;
      troop.emberBurnNextTickAt = 0;
      troop.emberBurnSourceEnemyId = null;
      troop.emberBurnTickEveryMs = 500;
    }
  }
}

function updateEnemyProjectiles(session, dt, events) {
  for (const projectile of session.enemyProjectiles) {
    if (!projectile.active) continue;
    projectile.ageMs += dt;
    projectile.previousX = projectile.x;
    projectile.previousY = projectile.y;
    projectile.previousRenderX = projectile.x;
    projectile.previousRenderY = projectile.y;

    if (projectile.kind === "dardifagoDart") {
      projectile.x += projectile.vx * dt / 1000;
      projectile.y += projectile.vy * dt / 1000;
      projectile.rotation = Math.atan2(projectile.vy, projectile.vx);
      pushProjectileTrail(projectile.trail, projectile.x, projectile.y);
      const target = projectile.targetType === "troop"
        ? indexedTroopById(session, projectile.targetId)
        : session.convoy;
      const targetPoint = target && !target.dead
        ? { x: target.x, y: projectile.targetType === "troop" ? target.y - 18 : target.y }
        : { x: projectile.lastKnownTargetX, y: projectile.lastKnownTargetY };
      const impact = Math.hypot(targetPoint.x - projectile.x, targetPoint.y - projectile.y) <= Math.max(28, projectile.speed * dt / 1000);
      if (impact) {
        if (projectile.targetType === "troop" && target && !target.dead && Math.hypot(target.x - projectile.x, target.y - projectile.y) < 64) {
          const dealt = damageTroop(session, target, projectile.damage, events, { sourceEnemyId: projectile.sourceEnemyId });
          const metrics = session.chapterSevenMetrics;
          metrics.dardifagoTroopHits += 1; metrics.dardifagoTroopDamage += dealt;
          if (projectile.toxic && !target.dead) {
            const active = (target.vertebralToxinUntil || 0) > session.elapsed;
            target.vertebralToxinUntil = Math.max(target.vertebralToxinUntil || 0, session.elapsed + 3000);
            target.vertebralToxinFactor = .70;
            refreshTroopAttackSpeedFactor(session, target);
            metrics[active ? "dardifagoToxinRefreshes" : "dardifagoToxinApplications"] += 1;
            events.push({ type: "dardifagoToxinApplied", sourceEnemyId: projectile.sourceEnemyId, targetTroopId: target.id, durationMs: 3000, attackSpeedFactor: .70, refreshed: active, x: target.x, y: target.y - 18 });
          }
        } else if (projectile.targetType === "convoy" && session.convoy && session.convoy.hp > 0) {
          const dealt = damageConvoy(session, projectile.damage, events, { attackerId: projectile.sourceEnemyId, enemyType: "dardifago", underAttackHoldMs: 2200 });
          session.chapterSevenMetrics.dardifagoConvoyHits += 1; session.chapterSevenMetrics.dardifagoConvoyDamage += dealt;
          events.push({ type: "dardifagoConvoyHit", sourceEnemyId: projectile.sourceEnemyId, damage: dealt, x: session.convoy.x, y: session.convoy.y });
        }
        events.push({ type: "dardifagoDartImpact", sourceEnemyId: projectile.sourceEnemyId, projectileId: projectile.id, targetId: projectile.targetId, toxic: projectile.toxic, x: projectile.x, y: projectile.y });
        projectile.active = false;
      } else if (projectile.ageMs > 3000 || projectile.x < -100 || projectile.x > FIELD.width + 100) projectile.active = false;
      continue;
    }

    if (projectile.kind === "emberGlob") {
      const progress = Math.min(1, projectile.ageMs / projectile.flightMs);
      projectile.x = projectile.startX + (projectile.targetX - projectile.startX) * progress;
      projectile.y = projectile.startY + (projectile.targetY - projectile.startY) * progress
        - projectile.arcHeight * 4 * progress * (1 - progress);
      projectile.rotation = Math.atan2(projectile.y - projectile.previousY, projectile.x - projectile.previousX);
      pushProjectileTrail(projectile.trail, projectile.x, projectile.y);
      if (progress >= 1) {
        resolveCuspidorEmberGlobImpact(session, projectile, events);
        projectile.active = false;
      }
      continue;
    }

    projectile.x += projectile.vx * dt / 1000;
    projectile.y += projectile.vy * dt / 1000;
    pushProjectileTrail(projectile.trail, projectile.x, projectile.y);

    if (projectile.kind === "rasgamarBaseOrb") {
      if (projectile.x <= FIELD.baseX) {
        resolveRasgamarBaseOrbImpact(session, projectile, events);
        projectile.active = false;
      }
      continue;
    }

    const intendedTarget = projectile.targetTroopId
      ? indexedTroopById(session, projectile.targetTroopId)
      : null;
    if (["inhibitorWeb", "veuSalinoMucus"].includes(projectile.kind) && projectile.targetLocked) {
      if (!intendedTarget) {
        projectile.active = false;
        continue;
      }
      if (projectile.x <= intendedTarget.x + 20) {
        if (projectile.kind === "inhibitorWeb") {
          resolveInhibitorWebImpact(session, projectile, intendedTarget, events);
        } else {
          damageTroop(session, intendedTarget, projectile.damage, events);
          intendedTarget.veuSalinoAttackSlowFactor = projectile.attackSpeedDebuffFactor;
          intendedTarget.veuSalinoAttackSlowUntil = session.elapsed + projectile.attackSpeedDebuffDurationMs;
          refreshTroopAttackSpeedFactor(session, intendedTarget);
          events.push({ type: "veuSalinoAttackSpeedDebuff", sourceEnemyId: projectile.sourceEnemyId, targetTroopId: intendedTarget.id, x: intendedTarget.x, y: intendedTarget.y - 18, attackSpeedFactor: projectile.attackSpeedDebuffFactor, durationMs: projectile.attackSpeedDebuffDurationMs, color: projectile.color, seed: projectile.seed });
        }
        projectile.active = false;
      } else if (projectile.x <= FIELD.baseX || projectile.y < -80 || projectile.y > FIELD.height + 80) {
        projectile.active = false;
      }
      continue;
    }
    const sourceEnemy = projectile.kind === "electric"
      ? indexedEnemyById(session, projectile.sourceEnemyId)
      : null;
    const crossesTroop = (troop) => troop && !troop.dead
      && troop.row === projectile.row
      && troop.x <= projectile.previousX + 24
      && troop.x >= projectile.x - 24;
    let target = projectile.targetingVoltriz && crossesTroop(intendedTarget) ? intendedTarget : null;
    if (!projectile.targetingVoltriz) {
      for (const troop of troopsForRow(session, projectile.row)) {
        if (crossesTroop(troop) && (!target || troop.x > target.x)) target = troop;
      }
    }
    if (target) {
      damageTroop(session, target, projectile.damage, events);
      if (projectile.kind === "rasgamarDart" && !target.dead) {
        target.rasgamarAttackSlowFactor = projectile.rasgamarSlowFactor;
        target.rasgamarAttackSlowUntil = session.elapsed + projectile.rasgamarSlowMs;
        events.push({ type: "rasgamarDartImpact", sourceEnemyId: projectile.sourceEnemyId, targetTroopId: target.id, x: target.x, y: target.y - 18, color: projectile.color, seed: projectile.seed });
      }
      if (projectile.kind === "electric") {
        if (sourceEnemy) applyEnemyElectricCharge(session, sourceEnemy, target, events);
      }
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
  compactActive(session.enemyProjectiles, (projectile) => projectile.active);
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

function setChapterFourState(session, enemy, state, durationMs = Infinity) {
  if (enemy.chapterFourState !== state) enemy.chapterFourStateStartedAt = session.elapsed;
  enemy.chapterFourState = state;
  enemy.chapterFourStateEndsAt = Number.isFinite(durationMs) ? session.elapsed + durationMs : Infinity;
  enemy.chapterFourActionApplied = false;
}

function chapterFourRangedTarget(session, enemy, rangeTiles) {
  return closestTroopForEnemy(session, enemy, rangeTiles);
}

function isVoltrizBypassTarget(session, enemy, troop) {
  if (!troop || troop.dead || troop.row !== enemy.row) return true;
  if (troop.x >= enemy.x) return true;
  return isElectricParalyzed(troop, session.elapsed);
}

function findVoltrizTarget(session, enemy, config) {
  const maxDistance = config.range * CELL.width;
  let selected = null;
  for (const troop of session.troops) {
    if (isVoltrizBypassTarget(session, enemy, troop)) continue;
    const distance = enemy.x - troop.x;
    if (distance > maxDistance) continue;
    if (!selected || troop.x > selected.x) selected = troop;
  }
  return selected;
}

function updateVoltriz(session, enemy, config, dt, events) {
  const target = findVoltrizTarget(session, enemy, config);
  if (enemy.voltrizTargetId && (!target || target.id !== enemy.voltrizTargetId)) {
    enemy.voltrizTargetId = null;
    if (enemy.chapterFourState === "attack") setChapterFourState(session, enemy, "flying");
  }
  let packetWing = 0;
  const packetEnemies = getBattleIndex(session)?.enemiesByPacket.get(enemy.packetId) || session.enemies;
  for (const candidate of packetEnemies) {
    if (!candidate.dead && candidate.type === "voltriz" && candidate.packetId === enemy.packetId
      && candidate.row === enemy.row) packetWing += 1;
  }
  const interval = config.attackEveryMs
    * (packetWing >= config.resonanceMinimum ? config.resonanceAttackSpeedFactor : 1);
  if (target && session.elapsed >= enemy.attackReadyAt) {
    launchElectricProjectile(session, enemy, config, target, events);
    enemy.voltrizTargetId = target.id;
    enemy.attackReadyAt = session.elapsed + interval;
    enemy.lastAttackAt = session.elapsed;
    setChapterFourState(session, enemy, "attack", config.attackVisual.durationMs);
  } else if (session.elapsed >= enemy.chapterFourStateEndsAt && enemy.chapterFourState !== "flying") {
    setChapterFourState(session, enemy, "flying");
  }
  if (!target || enemy.x - target.x > troopBlockDistance(target)) {
    const originalSpeed = enemy.speed;
    if (target) enemy.speed *= config.movingAttackFactor;
    moveEnemy(session, enemy, dt, events);
    enemy.speed = originalSpeed;
  } else {
    enemy.moving = false;
  }
}

function findNimbarcaEscortTarget(session, enemy) {
  let escort = null;
  const packetEnemies = getBattleIndex(session)?.enemiesByPacket.get(enemy.packetId) || session.enemies;
  for (const candidate of packetEnemies) {
    if (candidate.dead || candidate.type !== "voltriz"
      || candidate.packetId !== enemy.packetId || candidate.row !== enemy.row
      || candidate.x >= enemy.x) continue;
    if (!escort || candidate.x < escort.x) escort = candidate;
  }
  return escort;
}

function moveNimbarca(session, enemy, config, dt, events) {
  const escort = findNimbarcaEscortTarget(session, enemy);
  const originalSpeed = enemy.speed;
  if (escort && enemy.x - escort.x > config.maximumEscortDistanceTiles * CELL.width) {
    enemy.speed = config.escortSpeed;
  }
  moveEnemy(session, enemy, dt, events);
  enemy.speed = originalSpeed;
}

function updateNimbarca(session, enemy, config, dt, events) {
  if (enemy.chapterFourState === "shieldPulse") {
    enemy.moving = false;
    if (session.elapsed < enemy.chapterFourStateEndsAt) return;
    setChapterFourState(session, enemy, "flying");
  }

  if (enemy.chapterFourState === "attack") {
    const releaseAt = enemy.chapterFourStateStartedAt + config.attackVisual.releaseMs;
    if (!enemy.chapterFourActionApplied && session.elapsed >= releaseAt) {
      const target = session.troops.find((troop) => (
        !troop.dead && troop.id === enemy.nimbarcaAttackTargetId
      ));
      if (target) launchElectricProjectile(session, enemy, config, target, events);
      enemy.chapterFourActionApplied = true;
    }
    const originalSpeed = enemy.speed;
    enemy.speed *= config.movingAttackFactor;
    moveEnemy(session, enemy, dt, events);
    enemy.speed = originalSpeed;
    if (session.elapsed < enemy.chapterFourStateEndsAt) return;
    enemy.nimbarcaAttackTargetId = null;
    setChapterFourState(session, enemy, "flying");
  }

  if (session.elapsed >= enemy.nextSpecialAt) {
    const pulseEvery = enemy.variant === "alpha" ? 7000 : config.resonancePulseEveryMs;
    const allies = [];
    const packetEnemies = getBattleIndex(session)?.enemiesByPacket.get(enemy.packetId) || session.enemies;
    for (const candidate of packetEnemies) {
      if (!candidate.dead && candidate.type === "voltriz" && candidate.packetId === enemy.packetId
        && candidate.row === enemy.row
        && Math.abs(candidate.x - enemy.x) <= config.shieldRadiusTiles * CELL.width) allies.push(candidate);
    }
    allies.forEach((ally) => {
      const remaining = Math.max(0, ally.attackReadyAt - session.elapsed);
      ally.attackReadyAt = session.elapsed + remaining * config.resonanceCooldownFactor;
    });
    enemy.nextSpecialAt = session.elapsed + pulseEvery;
    if (allies.length > 0) {
      setChapterFourState(session, enemy, "shieldPulse", 700);
      events.push({
        type: "stormShieldPulse", sourceEnemyId: enemy.id,
        targetIds: allies.map((ally) => ally.id), x: enemy.x, y: enemy.y,
        color: config.color, seed: nextEffectSeed(session),
      });
      enemy.chapterFourActionApplied = true;
      enemy.moving = false;
      return;
    }
  }

  const target = chapterFourRangedTarget(session, enemy, config.range);
  const hasLiveTarget = session.troops.some((troop) => !troop.dead && troop.row === enemy.row
    && troop.x <= enemy.x && enemy.x - troop.x <= config.range * CELL.width);
  const distance = target ? enemy.x - target.x : Infinity;
  if (target && distance <= config.range * CELL.width && session.elapsed >= enemy.attackReadyAt) {
    enemy.attackReadyAt = session.elapsed + config.attackEveryMs;
    enemy.lastAttackAt = session.elapsed;
    enemy.nimbarcaAttackTargetId = target.id;
    setChapterFourState(session, enemy, "attack", config.attackVisual.durationMs);
    enemy.moving = false;
    return;
  }
  if (!target || distance > config.preferredRange * CELL.width) {
    moveNimbarca(session, enemy, config, dt, events);
  } else {
    enemy.moving = false;
  }
}

const GORJAL_ANCHORS = new Set(["colossoImpacto", "lumiUrsa7", "muralhaReforcada"]);

function findGorjalChargeTarget(session, enemy, config) {
  if (session.elapsed < enemy.nextSpecialAt) return null;
  const target = closestTroopForEnemy(session, enemy, config.chargeTriggerRangeTiles);
  if (!target) return null;
  const distance = enemy.x - target.x;
  const contactDistance = gorjalContactDistance(target, config);
  const distanceToContact = distance - contactDistance;
  if (distanceToContact <= 0) return null;
  if (distanceToContact > config.chargeTriggerRangeTiles * CELL.width) return null;
  if (target.id === enemy.gorjalLastChargedTroopId) return null;
  return target;
}

export function tryGorjalFormationPush(session, enemy, events = []) {
  const rowTroops = session.troops
    .filter((troop) => !troop.dead && !troop.windRecovery && troop.row === enemy.row)
    .sort((left, right) => left.col - right.col);
  if (!rowTroops.length) return false;
  const blocked = rowTroops.some((troop) => GORJAL_ANCHORS.has(troop.type)
      || (troop.anchoredWhenFlooded && isTideCellFlooded(session, troop.row, troop.col)))
    || rowTroops.some((troop) => troop.col - 1 < FIELD.firstTroopCol)
    || rowTroops.some((troop) => session.troops.some((other) => (
      !other.dead && other.row === troop.row && other.col === troop.col - 1
      && !rowTroops.includes(other)
    )));
  if (blocked) return false;
  const moves = rowTroops.map((troop) => ({ troop, fromCol: troop.col, toCol: troop.col - 1 }));
  moves.forEach(({ troop, fromCol, toCol }) => {
    troop.col = toCol;
    troop.x = toCol * CELL.width + CELL.width / 2;
    troop.previousRenderX = troop.x;
    events.push({
      type: "gorjalFormationPushed", sourceEnemyId: enemy.id, troopId: troop.id,
      row: troop.row, fromCol, toCol, x: troop.x, y: troop.y,
    });
  });
  return true;
}

function findGorjalChargeCollision(session, enemy, previousX, nextX, config) {
  return session.troops
    .filter((troop) => !troop.dead && troop.row === enemy.row && troop.x <= previousX)
    .map((troop) => ({ troop, boundary: troop.x + gorjalContactDistance(troop, config) }))
    .filter(({ boundary }) => boundary <= previousX && boundary >= nextX)
    .sort((left, right) => right.boundary - left.boundary)[0] || null;
}

function resolveGorjalChargeImpact(session, enemy, target, config, events, options = {}) {
  const contactDistance = gorjalContactDistance(target, config);
  enemy.x = target.x + contactDistance;
  enemy.previousRenderX = enemy.x;
  const damage = enemy.variant === "alpha" ? 50 : config.chargeDamage;
  damageTroop(session, target, damage, events);
  const survived = !target.dead && target.hp > 0;
  let pushed = false;
  if (survived) {
    target.electricParalyzedUntil = Math.max(
      Number(target.electricParalyzedUntil || 0),
      session.elapsed + config.chargeParalysisMs,
    );
    pushed = tryGorjalFormationPush(session, enemy, events);
  }
  enemy.gorjalLastChargedTroopId = target.id;
  enemy.gorjalChargeTargetId = null;
  enemy.gorjalChargeEndX = null;
  if (options.initialCharge) {
    enemy.gorjalInitialCharge = false;
    enemy.gorjalInitialChargeCompleted = true;
  }
  enemy.nextSpecialAt = session.elapsed + config.chargeEveryMs;
  enemy.gorjalChargeCooldownStartedAt = session.elapsed;
  setChapterFourState(session, enemy, "chargeImpact", 260);
  events.push({
    type: "gorjalChargeImpact", sourceEnemyId: enemy.id, targetTroopId: target.id,
    initialCharge: Boolean(options.initialCharge), damage, pushed,
    x: target.x, y: target.y, color: config.color, seed: nextEffectSeed(session),
  });
}

function updateGorjalInitialCharge(session, enemy, config, dt, events) {
  if (!enemy.gorjalInitialChargeStartedEventSent) {
    enemy.gorjalInitialChargeStartedEventSent = true;
    events.push({
      type: "gorjalInitialChargeStarted", sourceEnemyId: enemy.id,
      row: enemy.row, x: enemy.x, y: enemy.y, color: config.color, seed: nextEffectSeed(session),
    });
  }
  enemy.moving = true;
  const previousX = enemy.x;
  const slowFactor = session.elapsed < enemy.slowUntil ? enemy.slowFactor : 1;
  const distance = config.chargeSpeed * session.modifiers.enemySpeed
    * (session.sandboxSettings?.enemySpeedMultiplier ?? 1) * slowFactor * dt / 1000;
  const nextX = Math.max(FIELD.baseX, previousX - distance);
  const collision = findGorjalChargeCollision(session, enemy, previousX, nextX, config);
  if (collision) {
    resolveGorjalChargeImpact(session, enemy, collision.troop, config, events, { initialCharge: true });
    return;
  }
  enemy.x = nextX;
  if (enemy.x <= enemy.gorjalChargeEndX) {
    enemy.gorjalInitialCharge = false;
    enemy.gorjalInitialChargeCompleted = true;
    enemy.nextSpecialAt = session.elapsed + config.chargeEveryMs;
    enemy.gorjalChargeEndX = null;
    setChapterFourState(session, enemy, "walking");
  }
}

function updateGorjal(session, enemy, config, dt, events) {
  if (enemy.gorjalInitialCharge && enemy.chapterFourState === "charge") {
    updateGorjalInitialCharge(session, enemy, config, dt, events);
    return;
  }
  const state = enemy.chapterFourState;
  if (state === "chargePrep") {
    enemy.moving = false;
    const target = session.troops.find((troop) => (
      troop.id === enemy.gorjalChargeTargetId
      && !troop.dead
      && troop.row === enemy.row
      && troop.x < enemy.x
    ));
    if (!target || !hasLiveTarget) {
      enemy.gorjalChargeTargetId = null;
      setChapterFourState(session, enemy, "walking");
      return;
    }
    if (session.elapsed < enemy.chapterFourStateEndsAt) return;
    enemy.gorjalChargeEndX = Math.max(
      FIELD.baseX,
      target.x + gorjalContactDistance(target, config),
    );
    setChapterFourState(session, enemy, "charge");
  }
  if (enemy.chapterFourState === "charge") {
    enemy.moving = true;
    enemy.x = Math.max(enemy.gorjalChargeEndX, enemy.x - config.chargeSpeed * dt / 1000);
    const target = session.troops.find((troop) => (
      troop.id === enemy.gorjalChargeTargetId
      && !troop.dead
      && troop.row === enemy.row
    ));
    if (target && enemy.x <= enemy.gorjalChargeEndX) {
      resolveGorjalChargeImpact(session, enemy, target, config, events);
      return;
    }
    if (enemy.x <= enemy.gorjalChargeEndX) {
      enemy.gorjalChargeTargetId = null;
      enemy.gorjalChargeEndX = null;
      setChapterFourState(session, enemy, "walking");
    }
    return;
  }
  if (state === "chargeImpact" && session.elapsed >= enemy.chapterFourStateEndsAt) {
    setChapterFourState(session, enemy, "recover", config.recoverMs);
  }
  if (enemy.chapterFourState === "recover") {
    enemy.moving = false;
    if (session.elapsed < enemy.chapterFourStateEndsAt) return;
    const target = closestTroopForEnemy(session, enemy);
    if (target && enemy.x - target.x <= gorjalContactDistance(target, config)) {
      setChapterFourState(session, enemy, "idle");
      enemy.moving = false;
      return;
    }
    setChapterFourState(session, enemy, "walking");
  }
  if (enemy.chapterFourState === "attack") {
    enemy.moving = false;
    const impactAt = enemy.chapterFourStateStartedAt + config.attackVisual.impactMs;
    if (!enemy.chapterFourActionApplied && session.elapsed >= impactAt) {
      const attackTarget = session.troops.find((troop) => (
        !troop.dead && troop.id === enemy.gorjalAttackTargetId
      ));
      if (attackTarget && attackTarget.row === enemy.row
        && enemy.x - attackTarget.x <= gorjalContactDistance(attackTarget, config)) {
        enemy.x = Math.max(enemy.x, attackTarget.x + gorjalContactDistance(attackTarget, config));
        enemy.previousRenderX = enemy.x;
        damageTroop(session, attackTarget, enemy.damage, events);
        applyConductivity(attackTarget, session.elapsed);
      }
      enemy.chapterFourActionApplied = true;
    }
    if (session.elapsed < enemy.chapterFourStateEndsAt) return;
    enemy.gorjalAttackTargetId = null;
    const currentTarget = closestTroopForEnemy(session, enemy);
    if (currentTarget && enemy.x - currentTarget.x <= gorjalContactDistance(currentTarget, config)) {
      setChapterFourState(session, enemy, "idle");
      enemy.moving = false;
      return;
    }
    setChapterFourState(session, enemy, "walking");
    moveEnemy(session, enemy, dt, events);
    return;
  }
  const target = closestTroopForEnemy(session, enemy);
  if (target && enemy.x - target.x <= gorjalContactDistance(target, config)) {
    enemy.moving = false;
    if (session.elapsed >= enemy.attackReadyAt) {
      const contactDistance = gorjalContactDistance(target, config);
      enemy.x = Math.max(enemy.x, target.x + contactDistance);
      enemy.previousRenderX = enemy.x;
      enemy.attackReadyAt = session.elapsed + config.attackEveryMs;
      enemy.lastAttackAt = session.elapsed;
      enemy.gorjalAttackTargetId = target.id;
      setChapterFourState(session, enemy, "attack", config.attackVisual.durationMs);
    } else if (enemy.chapterFourState !== "idle") {
      setChapterFourState(session, enemy, "idle");
    }
  } else {
    const chargeTarget = findGorjalChargeTarget(session, enemy, config);
    if (chargeTarget) {
      enemy.gorjalChargeTargetId = chargeTarget.id;
      setChapterFourState(
        session,
        enemy,
        "chargePrep",
        enemy.variant === "alpha" ? 700 : config.chargePrepMs,
      );
      events.push({
        type: "gorjalChargePrep", sourceEnemyId: enemy.id, targetTroopId: chargeTarget.id,
        x: enemy.x, y: enemy.y, color: config.color, seed: nextEffectSeed(session),
      });
      return;
    }
    if (enemy.chapterFourState !== "walking") setChapterFourState(session, enemy, "walking");
    moveEnemy(session, enemy, dt, events);
  }
}

function findDerivanteCoverCandidates(session, enemy, row = enemy.row) {
  return session.enemies.filter((candidate) => (
    !candidate.dead
    && candidate.id !== enemy.id
    && candidate.row === row
    && candidate.x < enemy.x
    && candidate.hp > enemy.hp
    && !ENEMIES[candidate.type]?.airborne
    && candidate.type !== "workerQueenEgg"
    && candidate.type !== "derivante"
    && ["walking", "idle", "attack", "recover", "rooting", "rootedIdle", "attackCharge", "attackRelease"].includes(candidate.chapterFourState)
  ));
}

function derivanteCoverScore(candidate) {
  if (candidate.type === "gorjal") return 10000;
  if (candidate.type === "raizFulgor") return 7000;
  if (candidate.hp > 100) return 5000;
  if (candidate.hp > 50) return 3000;
  return 1000;
}

function derivanteRowScore(session, enemy, row) {
  const troops = session.troops.filter((troop) => (
    !troop.dead && troop.row === row && troop.x < enemy.x
  ));
  if (!troops.length) return -10000;
  const covers = findDerivanteCoverCandidates(session, enemy, row);
  const nearestTroop = [...troops].sort((left, right) => right.x - left.x)[0];
  let score = 8000 + troops.length * 3000;
  if (covers.length) score += 4000 + Math.max(...covers.map(derivanteCoverScore));
  if (troops.some((troop) => isElectricParalyzed(troop, session.elapsed))) score += 3000;
  if (troops.some((troop) => troop.hp / troop.maxHp < 0.4)) score += 2000;
  if (nearestTroop) score += Math.max(0, 1500 - (enemy.x - nearestTroop.x));
  return score;
}

function getRowCenter(row) {
  return row * CELL.height + CELL.height / 2;
}

function startDerivanteJump(session, enemy, targetRow, config, reason = "routeChange") {
  enemy.jumpSourceRow = enemy.row;
  enemy.jumpSourceY = enemy.y;
  enemy.jumpTargetRow = targetRow;
  enemy.jumpTargetY = getRowCenter(targetRow);
  enemy.derivanteJumpSourceX = enemy.x;
  enemy.derivanteJumpTargetX = Math.max(FIELD.baseX, enemy.x - config.jumpForwardTiles * CELL.width);
  enemy.derivanteJumpReason = reason;
  enemy.derivanteBehavior = "hunting";
  enemy.jumping = true;
  enemy.jumpProgress = 0;
  enemy.windMotion = null;
  setChapterFourState(session, enemy, "jumpPrepare", config.jumpPrepareMs);
  enemy.moving = false;
}

function selectDerivanteCover(session, enemy, row = enemy.row, events = []) {
  const cover = findDerivanteCoverCandidates(session, enemy, row)
    .sort((left, right) => derivanteCoverScore(right) - derivanteCoverScore(left))[0] || null;
  if (cover && enemy.derivanteCoverEnemyId !== cover.id) {
    enemy.derivanteCoverEnemyId = cover.id;
    enemy.derivanteCoverTargetDistance = cover.x - enemy.x;
    events.push({ type: "derivanteCoverSelected", enemyId: enemy.id, coverEnemyId: cover.id, row: enemy.row, x: enemy.x, y: enemy.y });
  }
  return cover;
}

function updateDerivanteCoverMovement(session, enemy, cover, config, dt, events) {
  const desiredX = cover.x + config.coverDistanceTiles * CELL.width;
  const delta = enemy.x - desiredX;
  if (delta > 8) {
    enemy.moving = false;
    return;
  }
  const originalSpeed = enemy.speed;
  enemy.speed = delta < -20 ? originalSpeed * 1.35 : originalSpeed * 0.35;
  moveEnemy(session, enemy, dt, events);
  enemy.speed = originalSpeed;
}

function updateDerivante(session, enemy, config, dt, events) {
  const state = enemy.chapterFourState;
  const jumpStates = ["jumpPrepare", "jumpTakeoff", "jumping", "landing", "windGlide"];
  if (jumpStates.includes(state)) {
    enemy.moving = false;
    if (state === "jumping") {
      const progress = clamp(
        (session.elapsed - enemy.chapterFourStateStartedAt) / config.jumpingMs,
        0,
        1,
      );
      enemy.jumpProgress = progress;
      const eased = progress * progress * (3 - 2 * progress);
      const sourceY = Number.isFinite(enemy.jumpSourceY) ? enemy.jumpSourceY : enemy.y;
      const targetY = Number.isFinite(enemy.jumpTargetY)
        ? enemy.jumpTargetY
        : getRowCenter(enemy.jumpTargetRow ?? enemy.row);
      enemy.y = sourceY + (targetY - sourceY) * eased;
      const sourceX = Number.isFinite(enemy.derivanteJumpSourceX) ? enemy.derivanteJumpSourceX : enemy.x;
      const targetX = Number.isFinite(enemy.derivanteJumpTargetX) ? enemy.derivanteJumpTargetX : sourceX;
      enemy.x = sourceX + (targetX - sourceX) * eased;
    } else if (state === "windGlide" && enemy.windMotion) {
      const duration = Math.max(1, enemy.windMotion.endsAt - enemy.windMotion.startedAt);
      const progress = clamp((session.elapsed - enemy.windMotion.startedAt) / duration, 0, 1);
      const eased = 1 - ((1 - progress) ** 3);
      enemy.jumpProgress = 0;
      enemy.y = enemy.windMotion.fromY + (enemy.windMotion.toY - enemy.windMotion.fromY) * eased;
    }
    if (session.elapsed < enemy.chapterFourStateEndsAt) return;
    if (state === "jumpPrepare") setChapterFourState(session, enemy, "jumpTakeoff", config.jumpTakeoffMs);
    else if (state === "jumpTakeoff") setChapterFourState(session, enemy, "jumping", config.jumpingMs);
    else if (state === "jumping" || state === "windGlide") {
      if (Number.isInteger(enemy.jumpTargetRow)) {
        enemy.row = clamp(enemy.jumpTargetRow, 0, FIELD.rows - 1);
        enemy.y = Number.isFinite(enemy.jumpTargetY)
          ? enemy.jumpTargetY
          : getRowCenter(enemy.row);
        enemy.previousRenderY = enemy.y;
      }
      enemy.windMotion = null;
      enemy.previousRenderX = enemy.x;
      setChapterFourState(session, enemy, "landing", config.landingMs);
    } else {
      enemy.nextSpecialAt = session.elapsed + config.breachCooldownMs;
      enemy.jumpSourceRow = null;
      enemy.jumpSourceY = null;
      enemy.jumpTargetRow = null;
      enemy.jumpTargetY = null;
      enemy.jumping = false;
      enemy.jumpProgress = 0;
      enemy.derivanteJumpSourceX = null;
      enemy.derivanteJumpTargetX = null;
      enemy.derivanteJumpReason = null;
      setChapterFourState(session, enemy, "walking");
    }
    return;
  }
  if (state === "attack") {
    enemy.moving = false;
    const impactAt = enemy.chapterFourStateStartedAt + config.attackVisual.impactMs;
    if (!enemy.derivanteAttackApplied && session.elapsed >= impactAt) {
      const storedTarget = session.troops.find((troop) => (
        troop.id === enemy.derivanteAttackTargetId
        && !troop.dead
        && troop.row === enemy.row
        && enemy.x - troop.x <= troopBlockDistance(troop)
      ));
      if (storedTarget) damageTroop(session, storedTarget, enemy.damage, events);
      enemy.derivanteAttackApplied = true;
    }
    if (session.elapsed < enemy.chapterFourStateEndsAt) return;
    enemy.derivanteAttackTargetId = null;
    enemy.derivanteAttackApplied = false;
    const currentTarget = closestTroopForEnemy(session, enemy);
    if (currentTarget && enemy.x - currentTarget.x <= troopBlockDistance(currentTarget)) {
      setChapterFourState(session, enemy, "idle");
      return;
    }
    setChapterFourState(session, enemy, "walking");
    moveEnemy(session, enemy, dt, events);
    return;
  }
  const cover = selectDerivanteCover(session, enemy, enemy.row, events);
  if (enemy.derivanteCoverEnemyId && !cover) {
    events.push({ type: "derivanteCoverLost", enemyId: enemy.id, coverEnemyId: enemy.derivanteCoverEnemyId, x: enemy.x, y: enemy.y });
    enemy.derivanteCoverEnemyId = null;
    enemy.derivanteCoverLostAt = session.elapsed;
  }
  if (cover && enemy.x >= cover.x && enemy.x - cover.x <= CELL.width * 1.5) {
    enemy.derivanteBehavior = "covered";
    updateDerivanteCoverMovement(session, enemy, cover, config, dt, events);
  } else {
    enemy.derivanteBehavior = cover ? "seekingCover" : "exposed";
  }
  const target = closestTroopForEnemy(session, enemy);
  enemy.blockedSince = target && enemy.x - target.x <= troopBlockDistance(target)
    ? (enemy.blockedSince ?? session.elapsed)
    : null;
  if (session.elapsed >= enemy.nextSpecialAt) {
    const candidateRows = [enemy.row - 1, enemy.row + 1]
      .filter((row) => row >= 0 && row < FIELD.rows);
    const currentScore = derivanteRowScore(session, enemy, enemy.row);
    const best = candidateRows.sort((a, b) => derivanteRowScore(session, enemy, b) - derivanteRowScore(session, enemy, a))[0];
    const recentWind = session.windCurrent?.state === "active"
      && session.windCurrent.selectedRows?.includes(enemy.row);
    const shouldJump = best != null && (
      (enemy.blockedSince != null && session.elapsed - enemy.blockedSince >= config.blockedThresholdMs)
      || derivanteRowScore(session, enemy, best) > currentScore + config.minimumRowScoreImprovement || recentWind
    );
    if (shouldJump) {
      startDerivanteJump(session, enemy, best, config);
      return;
    }
    enemy.nextSpecialAt = session.elapsed + config.breachCheckEveryMs;
  }
  if (target && enemy.x - target.x <= troopBlockDistance(target)) {
    enemy.moving = false;
    if (session.elapsed >= enemy.attackReadyAt) {
      enemy.attackReadyAt = session.elapsed + config.attackEveryMs;
      enemy.lastAttackAt = session.elapsed;
      enemy.derivanteAttackTargetId = target.id;
      enemy.derivanteAttackApplied = false;
      setChapterFourState(session, enemy, "attack", config.attackVisual.durationMs);
    } else if (enemy.chapterFourState !== "idle") {
      setChapterFourState(session, enemy, "idle");
    }
  } else {
    if (enemy.chapterFourState !== "walking") setChapterFourState(session, enemy, "walking");
    moveEnemy(session, enemy, dt, events);
  }
}

function updateRaizFulgor(session, enemy, config, dt, events) {
  const target = chapterFourRangedTarget(session, enemy, config.range);
  const isValidLockedTarget = (candidate) => (
    candidate
    && !candidate.dead
    && candidate.row === enemy.row
    && enemy.x - candidate.x >= 0
    && enemy.x - candidate.x <= config.range * CELL.width
  );

  if (enemy.chapterFourState === "rooting") {
    enemy.moving = false;
    if (session.elapsed >= enemy.chapterFourStateEndsAt) setChapterFourState(session, enemy, "rootedIdle");
    return;
  }

  if (enemy.chapterFourState === "unrooting") {
    enemy.moving = false;
    if (target) {
      enemy.rooted = true;
      setChapterFourState(session, enemy, "rootedIdle");
      return;
    }
    if (session.elapsed < enemy.chapterFourStateEndsAt) return;
    enemy.rooted = false;
    setChapterFourState(session, enemy, "walking");
    return;
  }

  if (enemy.chapterFourState === "attackCharge") {
    enemy.moving = false;
    if (session.elapsed < enemy.chapterFourStateEndsAt) return;
    if (enemy.chapterFourActionApplied) return;
    enemy.chapterFourActionApplied = true;
    const lockedTarget = session.troops.find(
      (troop) => troop.id === enemy.electricAttackTargetId,
    );
    const releasedTarget = isValidLockedTarget(lockedTarget) ? lockedTarget : null;
    enemy.electricAttackTargetId = null;
    enemy.lastAttackAt = session.elapsed;
    enemy.attackReadyAt = session.elapsed + config.attackEveryMs;
    setChapterFourState(
      session,
      enemy,
      "attackRelease",
      config.attackVisual.releaseDurationMs,
    );
    if (releasedTarget) {
      damageTroop(session, releasedTarget, enemy.damage, events);
      const hadTwoStacks = !isElectricParalyzed(releasedTarget, session.elapsed)
        && Number(releasedTarget.electricStacks || 0) >= 2;
      if (hadTwoStacks) {
        releasedTarget.electricStacks = 0;
        releasedTarget.electricStacksExpireAt = 0;
        applyEnemyElectricCharge(session, enemy, releasedTarget, events, {
          stacks: 3,
          paralysisDurationMs: config.chargedParalysisMs,
        });
      } else {
        applyEnemyElectricCharge(session, enemy, releasedTarget, events);
      }
      const secondary = session.troops.find((troop) => (
        !troop.dead && troop.id !== releasedTarget.id
        && Math.hypot(troop.x - releasedTarget.x, troop.y - releasedTarget.y)
          <= config.chainRadiusTiles * CELL.width
      ));
      if (secondary) damageTroop(session, secondary, enemy.damage * config.chainDamageFactor, events);
      const origin = getEnemyMuzzleWorldPosition(enemy, config, "attackRelease", 0);
      events.push({
        type: "groundingBeam", sourceEnemyId: enemy.id, targetTroopId: releasedTarget.id,
        secondaryTargetId: secondary?.id || null, x: releasedTarget.x, y: releasedTarget.y,
        x0: origin.x, y0: origin.y, x1: releasedTarget.x, y1: releasedTarget.y - 24,
        color: config.color, seed: nextEffectSeed(session),
      });
    }
    return;
  }

  if (enemy.chapterFourState === "attackRelease") {
    enemy.moving = false;
    if (session.elapsed >= enemy.chapterFourStateEndsAt) {
      setChapterFourState(session, enemy, "rootedIdle");
    }
    return;
  }

  if (!enemy.rooted && target
    && enemy.x - target.x <= config.preferredRange * CELL.width) {
    enemy.moving = false;
    enemy.rooted = true;
    setChapterFourState(session, enemy, "rooting", config.rootingMs);
    return;
  }

  if (enemy.rooted) {
    enemy.moving = false;
    // Recompute from the authoritative troop list: the battle index may still
    // contain a troop that was marked dead earlier in this tick.
    const liveTarget = session.troops
      .filter((troop) => !troop.dead && troop.row === enemy.row
        && troop.x <= enemy.x
        && enemy.x - troop.x <= config.range * CELL.width)
      .sort((left, right) => right.x - left.x)[0] || null;
    if (!liveTarget) {
      enemy.raizTargetLostAt ??= session.elapsed;
      if (session.elapsed - enemy.raizTargetLostAt >= (config.targetLostGraceMs ?? 0)) {
        setChapterFourState(session, enemy, "unrooting", config.unrootingMs);
      }
      return;
    }
    enemy.raizTargetLostAt = null;
    if (enemy.chapterFourState !== "rootedIdle") {
      setChapterFourState(session, enemy, "rootedIdle");
      return;
    }
    if (session.elapsed >= enemy.attackReadyAt) {
      enemy.electricAttackTargetId = liveTarget.id;
      setChapterFourState(session, enemy, "attackCharge", config.chargeMs);
    }
    return;
  }

  if (enemy.chapterFourState !== "walking") setChapterFourState(session, enemy, "walking");
  const escort = session.enemies
    .filter((candidate) => (
      !candidate.dead
      && candidate.packetId === enemy.packetId
      && candidate.row === enemy.row
      && ["gorjal", "nimbarca"].includes(candidate.type)
      && candidate.x < enemy.x
    ))
    .sort((left, right) => left.x - right.x)[0] || null;
  const originalSpeed = enemy.speed;
  if (escort && enemy.x - escort.x > config.maximumPacketDistanceTiles * CELL.width) {
    enemy.speed = config.catchUpSpeed;
  }
  moveEnemy(session, enemy, dt, events);
  enemy.speed = originalSpeed;
}

function updateChapterFourEnemy(session, enemy, config, dt, events) {
  if (config.chapterId !== "chapter_04") return false;
  if (enemy.type === "voltriz") updateVoltriz(session, enemy, config, dt, events);
  else if (enemy.type === "nimbarca") updateNimbarca(session, enemy, config, dt, events);
  else if (enemy.type === "gorjal") updateGorjal(session, enemy, config, dt, events);
  else if (enemy.type === "derivante") updateDerivante(session, enemy, config, dt, events);
  else if (enemy.type === "raizFulgor") updateRaizFulgor(session, enemy, config, dt, events);
  return true;
}

function setNereidaState(session, enemy, state, durationMs = Infinity) {
  const sameState = enemy.nereidaState === state;
  if (sameState && !Number.isFinite(durationMs)) {
    enemy.moving = state === "moveLand" || state === "moveWater";
    return;
  }
  const previousState = enemy.nereidaState;
  enemy.nereidaState = state;
  enemy.nereidaStateStartedAt = session.elapsed;
  enemy.nereidaStateEndsAt = Number.isFinite(durationMs) ? session.elapsed + durationMs : Infinity;
  if (previousState !== state && (state === "moveLand" || state === "moveWater")) {
    enemy.nereidaMovementDistance = 0;
  }
  enemy.moving = state === "moveLand" || state === "moveWater";
}

function nereidaProtectsAlly(session, enemy, config) {
  return session.enemies.some((ally) => !ally.dead && ally.id !== enemy.id
    && ally.type !== "carapacaNereida" && !ENEMIES[ally.type]?.boss && ally.row === enemy.row
    && ally.x > enemy.x && ally.x - enemy.x <= config.escortRangeTiles * CELL.width);
}

function updateCarapacaNereida(session, enemy, config, dt, events) {
  if (enemy.nereidaState === "spawnEmerge") {
    enemy.moving = false;
    if (session.elapsed < enemy.nereidaStateEndsAt) return;
    const flooded = isTideCellFlooded(session, enemy.row, clamp(Math.floor(enemy.x / CELL.width), 0, FIELD.cols - 1));
    setNereidaState(session, enemy, flooded ? "moveWater" : "moveLand");
  }
  if (enemy.nereidaState === "attackClaw") {
    enemy.moving = false;
    if (!enemy.nereidaAttackApplied && session.elapsed >= enemy.nereidaStateStartedAt + config.attackVisual.impactMs) {
      const target = session.troops.find((troop) => troop.id === enemy.nereidaAttackTargetId && !troop.dead
        && troop.row === enemy.row && enemy.x - troop.x <= config.attackRangeTiles * CELL.width);
      if (target) {
        damageTroop(session, target, enemy.damage, events);
        events.push({ type: "nereidaClawImpact", sourceEnemyId: enemy.id, targetTroopId: target.id, x: target.x, y: target.y, color: config.color, seed: nextEffectSeed(session) });
      }
      enemy.nereidaAttackApplied = true;
    }
    if (session.elapsed >= enemy.nereidaStateEndsAt) setNereidaState(session, enemy, "shellGuard");
    return;
  }
  const target = closestTroopForEnemy(session, enemy);
  if (target && enemy.x - target.x <= config.attackRangeTiles * CELL.width) {
    enemy.moving = false;
    if (session.elapsed >= enemy.attackReadyAt) {
      enemy.nereidaAttackTargetId = target.id;
      enemy.nereidaAttackApplied = false;
      enemy.attackReadyAt = session.elapsed + config.attackEveryMs;
      enemy.lastAttackAt = session.elapsed;
      setNereidaState(session, enemy, "attackClaw", config.attackVisual.durationMs);
    } else if (enemy.nereidaState !== "shellGuard") setNereidaState(session, enemy, "shellGuard");
    return;
  }
  const flooded = isTideCellFlooded(session, enemy.row, clamp(Math.floor(enemy.x / CELL.width), 0, FIELD.cols - 1));
  setNereidaState(session, enemy, flooded ? "moveWater" : "moveLand");
  const previousX = enemy.x;
  moveEnemy(session, enemy, dt, events);
  enemy.nereidaMovementDistance += Math.abs(previousX - enemy.x);
}

function setVeuSalinoState(session, enemy, state, durationMs = Infinity) {
  if (enemy.veuSalinoState === state && !Number.isFinite(durationMs)
    && !Number.isFinite(enemy.veuSalinoStateEndsAt)) {
    enemy.moving = state === "moveFloat" || state === "retreat";
    return;
  }
  enemy.veuSalinoState = state;
  enemy.veuSalinoStateStartedAt = session.elapsed;
  enemy.veuSalinoStateEndsAt = Number.isFinite(durationMs) ? session.elapsed + durationMs : Infinity;
  enemy.moving = state === "moveFloat" || state === "retreat";
}

function veuSalinoFlooded(session, enemy) {
  return isTideCellFlooded(session, enemy.row, clamp(Math.floor(enemy.x / CELL.width), 0, FIELD.cols - 1));
}

function selectVeuSalinoHealTargets(session, enemy, config) {
  const range = config.healRangeTiles * (veuSalinoFlooded(session, enemy) ? config.floodedRangeFactor : 1) * CELL.width;
  return session.enemies
    .filter((ally) => !ally.dead && ally.hp > 0 && ally.id !== enemy.id
      && Math.abs(ally.row - enemy.row) <= config.healAdjacentRows
      && Math.abs(ally.x - enemy.x) <= range
      && ally.hp / Math.max(1, ally.maxHp) < 1 - config.healMinimumMissingHpFactor)
    .sort((left, right) => {
      const leftPreferred = config.healPriorityTypes?.includes(left.type) ? 0 : 1;
      const rightPreferred = config.healPriorityTypes?.includes(right.type) ? 0 : 1;
      return leftPreferred - rightPreferred
        || left.hp / left.maxHp - right.hp / right.maxHp
        || Math.abs(left.x - enemy.x) - Math.abs(right.x - enemy.x)
        || left.id.localeCompare(right.id);
    })
    .slice(0, config.healTargetLimit);
}

function shouldVeuSalinoHeal(session, enemy, config) {
  return session.elapsed >= enemy.veuSalinoNextHealAt
    && session.elapsed >= (session.veuSalinoHealPulseLockedUntil || 0)
    && selectVeuSalinoHealTargets(session, enemy, config).length > 0;
}

function applyVeuSalinoHeal(session, enemy, config, events) {
  const flooded = veuSalinoFlooded(session, enemy);
  const factor = flooded ? config.floodedHealFactor : config.healFactor;
  const targets = (enemy.veuSalinoHealTargetIds || []).map((targetId) => indexedEnemyById(session, targetId))
    .filter((ally) => ally && !ally.dead && ally.hp > 0);
  const healedTargets = targets.map((ally) => {
    const previousHp = ally.hp;
    ally.hp = Math.min(ally.maxHp, ally.hp + ally.maxHp * factor);
    return { id: ally.id, x: ally.x, y: ally.y, row: ally.row, healedAmount: ally.hp - previousHp };
  });
  const previousSelfHp = enemy.hp;
  if (enemy.hp > 0 && enemy.hp < enemy.maxHp) enemy.hp = Math.min(enemy.maxHp, enemy.hp + enemy.maxHp * config.selfHealFactor);
  session.veuSalinoHealPulseLockedUntil = session.elapsed + config.healPulseLockMs;
  enemy.veuSalinoNextHealAt = session.elapsed + config.healEveryMs;
  enemy.veuSalinoHealApplied = true;
  events.push({ type: "veuSalinoHealPulse", sourceEnemyId: enemy.id, x: enemy.x, y: enemy.y, color: config.color,
    flooded, selfHealAmount: enemy.hp - previousSelfHp, targets: healedTargets,
    startedAt: enemy.veuSalinoStateStartedAt, applyAt: session.elapsed, endsAt: enemy.veuSalinoStateEndsAt,
    seed: nextEffectSeed(session) });
}

function selectVeuSalinoFrontTroop(session, enemy) {
  return session.troops.filter((troop) => !troop.dead && troop.row === enemy.row && troop.x < enemy.x)
    .sort((left, right) => right.x - left.x || left.id.localeCompare(right.id))[0] || null;
}

function selectVeuSalinoDebuffTarget(session, enemy, config, frontTroop = selectVeuSalinoFrontTroop(session, enemy)) {
  const inRange = frontTroop && enemy.x - frontTroop.x <= config.attackRangeTiles * CELL.width + 1;
  return inRange ? frontTroop : null;
}

function selectVeuSalinoCover(session, enemy, config) {
  return session.enemies.filter((ally) => !ally.dead && ally.id !== enemy.id && ally.row === enemy.row
    && ally.x < enemy.x && enemy.x - ally.x <= config.coverSearchRangeTiles * CELL.width)
    .sort((left, right) => Number(right.type === "carapacaNereida") - Number(left.type === "carapacaNereida") || right.x - left.x)[0] || null;
}

function updateVeuSalinoCover(session, enemy, config) {
  const cached = indexedEnemyById(session, enemy.veuSalinoCoverTargetId);
  const cacheValid = cached && !cached.dead && cached.row === enemy.row && cached.x < enemy.x;
  if (cacheValid && session.elapsed < enemy.veuSalinoCoverCheckedAt + config.coverMinimumHoldMs) return cached;
  const cover = selectVeuSalinoCover(session, enemy, config);
  enemy.veuSalinoCoverTargetId = cover?.id || null;
  enemy.veuSalinoCoverCheckedAt = session.elapsed;
  return cover;
}

function shouldVeuSalinoRetreat(enemy, config, troop, cover) {
  return Boolean(troop && cover) && troop.x < cover.x && cover.x < enemy.x
    && enemy.x - troop.x < config.minimumSafeDistanceTiles * CELL.width;
}

function getEffectiveEnemyMoveSpeed(session, enemy) {
  const baseSlow = session.elapsed < enemy.slowUntil ? enemy.slowFactor : 1;
  const tideSlow = getTideAdjustedEnemySlowFactor(session, enemy, baseSlow);
  const tideSpeed = getTideEnemySpeedFactor(session, enemy);
  const vortexSpeed = session.elapsed < (enemy.leviathanVortexSpeedUntil || 0) ? enemy.leviathanVortexSpeedFactor || 1 : 1;
  return enemy.speed * getSilicaDiggerSwarmSpeedFactor(session, enemy) * tideSlow * tideSpeed * vortexSpeed
    * session.modifiers.enemySpeed * (session.sandboxSettings?.enemySpeedMultiplier ?? 1);
}

function moveEnemyTowardX(session, enemy, targetX, dt, events, speedFactor = 1) {
  const distance = getEffectiveEnemyMoveSpeed(session, enemy) * speedFactor * dt / 1000;
  enemy.x = targetX < enemy.x ? Math.max(targetX, enemy.x - distance) : Math.min(targetX, enemy.x + distance);
  enemy.moving = true;
  if (enemy.x <= FIELD.baseX) resolveEnemyBreach(session, enemy, events);
}

function updateVeuSalinoMovement(session, enemy, config, troop, cover, dt, events) {
  if (!troop) {
    enemy.veuSalinoMovementMode = "advance";
    enemy.veuSalinoMovementTargetX = FIELD.baseX;
    setVeuSalinoState(session, enemy, "moveFloat");
    moveEnemy(session, enemy, dt, events);
    return;
  }
  const preferredCombatX = troop.x + config.preferredDistanceTiles * CELL.width;
  const coverFollowX = cover ? cover.x + config.retreatBehindAllyTiles * CELL.width : -Infinity;
  const desiredX = cover ? Math.max(preferredCombatX, coverFollowX) : preferredCombatX;
  enemy.veuSalinoMovementTargetX = desiredX;
  enemy.veuSalinoHasAttackPosition = enemy.x - troop.x <= config.attackRangeTiles * CELL.width + 1;
  if (enemy.x > desiredX + 1) {
    enemy.veuSalinoMovementMode = cover ? "followCover" : "approachTarget";
    setVeuSalinoState(session, enemy, "moveFloat");
    moveEnemyTowardX(session, enemy, desiredX, dt, events);
    return;
  }
  enemy.veuSalinoMovementMode = "holdRange";
  enemy.moving = false;
  setVeuSalinoState(session, enemy, "idle");
}

function startVeuSalinoRetreat(session, enemy, config, troop, cover, events) {
  const safeX = Math.min(troop.x + config.maximumSafeDistanceTiles * CELL.width,
    Math.max(cover.x + config.retreatBehindAllyTiles * CELL.width, troop.x + config.preferredDistanceTiles * CELL.width));
  enemy.veuSalinoRetreatTargetX = Math.max(enemy.x, safeX);
  enemy.veuSalinoMovementMode = "retreat";
  enemy.veuSalinoRetreatStartedAt = session.elapsed;
  setVeuSalinoState(session, enemy, "retreat");
  events.push({ type: "veuSalinoRetreat", sourceEnemyId: enemy.id, x: enemy.x, y: enemy.y, color: config.color, seed: nextEffectSeed(session) });
}

function updateMedusaVeuSalino(session, enemy, config, dt, events) {
  if (enemy.veuSalinoState === "spawnRise") {
    enemy.moving = false;
    if (session.elapsed >= enemy.veuSalinoStateEndsAt) setVeuSalinoState(session, enemy, "idle");
    return;
  }
  if (enemy.veuSalinoState === "healPulse") {
    enemy.moving = false;
    if (!enemy.veuSalinoHealApplied && session.elapsed >= enemy.veuSalinoStateStartedAt + config.healVisual.applyAtMs) applyVeuSalinoHeal(session, enemy, config, events);
    if (session.elapsed >= enemy.veuSalinoStateEndsAt) { enemy.veuSalinoHealTargetIds = []; setVeuSalinoState(session, enemy, "idle"); }
    return;
  }
  if (enemy.veuSalinoState === "attackCast") {
    enemy.moving = false;
    if (session.elapsed >= enemy.veuSalinoStateEndsAt) setVeuSalinoState(session, enemy, "attackRelease", config.attackReleaseVisual.durationMs);
    return;
  }
  if (enemy.veuSalinoState === "attackRelease") {
    enemy.moving = false;
    if (!enemy.veuSalinoProjectileReleased && session.elapsed >= enemy.veuSalinoStateStartedAt + config.attackReleaseVisual.projectileAtMs) {
      const target = indexedTroopById(session, enemy.veuSalinoAttackTargetId);
      enemy.veuSalinoProjectileReleased = true;
      if (target) launchVeuSalinoProjectile(session, enemy, target, config, events);
    }
    if (session.elapsed >= enemy.veuSalinoStateEndsAt) { enemy.veuSalinoAttackTargetId = null; setVeuSalinoState(session, enemy, "idle"); }
    return;
  }
  if (enemy.veuSalinoState === "retreat") {
    const troop = selectVeuSalinoFrontTroop(session, enemy);
    const cover = updateVeuSalinoCover(session, enemy, config);
    if (!cover || !troop || enemy.x >= enemy.veuSalinoRetreatTargetX - 2
      || enemy.x - troop.x >= config.retreatExitDistanceTiles * CELL.width) {
      enemy.veuSalinoRetreatCompletedAt = session.elapsed;
      enemy.veuSalinoMovementMode = cover ? "followCover" : "holdRange";
      setVeuSalinoState(session, enemy, "idle");
      return;
    }
    moveEnemyTowardX(session, enemy, enemy.veuSalinoRetreatTargetX, dt, events, config.retreatSpeedFactor);
    return;
  }
  const troop = selectVeuSalinoFrontTroop(session, enemy);
  const cover = updateVeuSalinoCover(session, enemy, config);
  if (shouldVeuSalinoRetreat(enemy, config, troop, cover)) { startVeuSalinoRetreat(session, enemy, config, troop, cover, events); return; }
  if (shouldVeuSalinoHeal(session, enemy, config)) {
    enemy.veuSalinoHealApplied = false;
    enemy.veuSalinoHealTargetIds = selectVeuSalinoHealTargets(session, enemy, config).map((target) => target.id);
    session.veuSalinoHealPulseLockedUntil = session.elapsed + config.healVisual.durationMs;
    setVeuSalinoState(session, enemy, "healPulse", config.healVisual.durationMs);
    return;
  }
  const target = selectVeuSalinoDebuffTarget(session, enemy, config, troop);
  if (target && session.elapsed >= enemy.veuSalinoNextAttackAt) {
    enemy.veuSalinoAttackTargetId = target.id; enemy.veuSalinoProjectileReleased = false;
    enemy.veuSalinoNextAttackAt = session.elapsed + config.attackEveryMs;
    setVeuSalinoState(session, enemy, "attackCast", config.attackCastVisual.durationMs);
    return;
  }
  updateVeuSalinoMovement(session, enemy, config, troop, cover, dt, events);
}

function setMordelumeState(session, enemy, state, durationMs = Infinity) {
  if (enemy.mordelumeState === state && !Number.isFinite(durationMs)
    && !Number.isFinite(enemy.mordelumeStateEndsAt)) {
    enemy.moving = ["moveLand", "moveWater", "sprintWater"].includes(state);
    return;
  }
  enemy.mordelumeState = state;
  enemy.mordelumeStateStartedAt = session.elapsed;
  enemy.mordelumeStateEndsAt = Number.isFinite(durationMs) ? session.elapsed + durationMs : Infinity;
  enemy.moving = ["moveLand", "moveWater", "sprintWater"].includes(state);
}

function mordelumeCell(session, enemy) {
  const col = clamp(Math.floor(enemy.x / CELL.width), 0, FIELD.cols - 1);
  return { row: enemy.row, col, flooded: isTideCellFlooded(session, enemy.row, col) };
}

function moveMordelume(session, enemy, config, dt, events, flooded) {
  const baseSlow = session.elapsed < enemy.slowUntil ? enemy.slowFactor : 1;
  const slow = getTideAdjustedEnemySlowFactor(session, enemy, baseSlow);
  const tideSpeed = getTideEnemySpeedFactor(session, enemy);
  const waterSpeed = flooded ? config.waterSpeedFactor : 1;
  const sprintSpeed = session.elapsed < enemy.sprintUntil ? config.sprintSpeedFactor : 1;
  const cappedSpeed = Math.min(enemy.speed * tideSpeed * waterSpeed * sprintSpeed,
    enemy.speed * config.maximumSpeedFactor);
  enemy.moving = true;
  enemy.x -= cappedSpeed * session.modifiers.enemySpeed
    * (session.sandboxSettings?.enemySpeedMultiplier ?? 1) * slow * dt / 1000;
  if (enemy.x <= FIELD.baseX) resolveEnemyBreach(session, enemy, events);
}

function updateMordelume(session, enemy, config, dt, events) {
  if (enemy.mordelumeState === "spawnEmerge") {
    enemy.moving = false;
    if (session.elapsed < enemy.mordelumeStateEndsAt) return;
    setMordelumeState(session, enemy, "idle");
  }
  if (enemy.mordelumeState === "attackBite") {
    enemy.moving = false;
    const target = session.troops.find((troop) => troop.id === enemy.mordelumeAttackTargetId && !troop.dead
      && troop.row === enemy.row && enemy.x - troop.x <= config.attackRangeTiles * CELL.width);
    for (const frame of config.attackVisual.damageFrames) {
      const impactAt = enemy.mordelumeStateStartedAt + frame * config.animationFrameMs.attackBite;
      if (!enemy.mordelumeDamageFramesApplied.includes(frame) && session.elapsed >= impactAt) {
        if (target) {
          damageTroop(session, target, enemy.damage, events);
          events.push({ type: "melee", x: target.x, y: target.y, sourceEnemyId: enemy.id });
        }
        enemy.mordelumeDamageFramesApplied.push(frame);
      }
    }
    if (session.elapsed >= enemy.mordelumeStateEndsAt) setMordelumeState(session, enemy, "idle");
    return;
  }

  const target = closestTroopForEnemy(session, enemy);
  if (target && enemy.x - target.x <= config.attackRangeTiles * CELL.width) {
    enemy.moving = false;
    if (session.elapsed >= enemy.attackReadyAt) {
      enemy.mordelumeAttackTargetId = target.id;
      enemy.mordelumeDamageFramesApplied = [];
      enemy.attackReadyAt = session.elapsed + config.attackEveryMs;
      enemy.lastAttackAt = session.elapsed;
      setMordelumeState(session, enemy, "attackBite", config.attackVisual.durationMs);
    } else {
      setMordelumeState(session, enemy, "idle");
    }
    return;
  }

  const cell = mordelumeCell(session, enemy);
  const cellKey = `${cell.row}:${cell.col}`;
  if (cell.flooded && cellKey !== enemy.lastSprintCellKey && session.elapsed >= enemy.sprintCooldownUntil) {
    enemy.lastSprintCellKey = cellKey;
    enemy.sprintUntil = session.elapsed + config.sprintDurationMs;
    enemy.sprintCooldownUntil = session.elapsed + config.sprintCooldownMs;
  }
  const sprinting = cell.flooded && session.elapsed < enemy.sprintUntil;
  setMordelumeState(session, enemy, sprinting ? "sprintWater" : cell.flooded ? "moveWater" : "moveLand");
  moveMordelume(session, enemy, config, dt, events, cell.flooded);
}

function setRasgamarState(session, enemy, state, durationMs = Infinity) {
  enemy.rasgamarState = state;
  enemy.rasgamarStateStartedAt = session.elapsed;
  enemy.rasgamarStateEndsAt = Number.isFinite(durationMs) ? session.elapsed + durationMs : Infinity;
  enemy.rasgamarSubmerged = RASGAMAR_SUBMERGED_STATES.has(state);
  enemy.moving = ["submergedPatrol", "submergedApproach", "rangedPositioning", "tideEscape", "dive", "laneRelocation"].includes(state);
}

function rasgamarFloodedColumns(session, row) {
  const columns = [];
  for (let col = FIELD.firstTroopCol; col <= FIELD.enemyEntryCol; col += 1) {
    if (isTideCellFlooded(session, row, col)) columns.push(col);
  }
  return columns;
}

function rasgamarColumn(enemy) {
  return clamp(Math.floor(enemy.x / CELL.width), FIELD.firstTroopCol, FIELD.enemyEntryCol);
}

function moveRasgamarTo(session, enemy, targetX, dt, speedFactor = 1) {
  const distance = targetX - enemy.x;
  if (Math.abs(distance) <= 2) {
    enemy.x = targetX;
    enemy.moving = false;
    return true;
  }
  enemy.x += Math.sign(distance) * enemy.speed * speedFactor * dt / 1000;
  enemy.moving = true;
  return false;
}

function clearRasgamarTarget(enemy) {
  enemy.rasgamarTargetId = null;
  enemy.rasgamarTargetX = null;
  enemy.rasgamarPatrolCol = null;
}

function startRasgamarRelocation(session, enemy, config, targetRow, events) {
  clearRasgamarCoil(session, enemy);
  clearRasgamarTarget(enemy);
  enemy.rasgamarBaseAssault = false;
  enemy.rasgamarTargetRow = targetRow;
  enemy.rasgamarRelocationSourceRow = enemy.row;
  enemy.rasgamarRelocationSourceY = enemy.y;
  enemy.rasgamarRelocationDurationMs = getRasgamarRelocationDuration(config, enemy.row, targetRow);
  enemy.rasgamarNextRelocationAt = session.elapsed
    + config.laneRetargetDiveMs
    + enemy.rasgamarRelocationDurationMs
    + config.laneRelocationCooldownMs;
  setRasgamarState(session, enemy, "dive", config.laneRetargetDiveMs);
  events.push({
    type: "rasgamarRelocationStarted",
    enemyId: enemy.id,
    fromRow: enemy.row,
    toRow: targetRow,
    troopCountAtDestination: session.troops.filter((troop) => !troop.dead && troop.row === targetRow).length,
    x: enemy.x,
    y: enemy.y,
    color: config.color,
    seed: nextEffectSeed(session),
  });
}

function updateRasgamarLaneRelocation(session, enemy, dt, events) {
  const targetRow = enemy.rasgamarTargetRow;
  if (!Number.isInteger(targetRow)) {
    setRasgamarState(session, enemy, "submergedPatrol");
    return true;
  }
  const duration = Math.max(1, Number(enemy.rasgamarRelocationDurationMs) || 1);
  const progress = clamp((session.elapsed - enemy.rasgamarStateStartedAt) / duration, 0, 1);
  const eased = progress * progress * (3 - 2 * progress);
  const fromY = Number.isFinite(enemy.rasgamarRelocationSourceY)
    ? enemy.rasgamarRelocationSourceY
    : enemy.y;
  const targetY = targetRow * CELL.height + CELL.height / 2;
  enemy.y = fromY + (targetY - fromY) * eased;
  enemy.moving = true;
  if (progress < 1) return true;

  const fromRow = enemy.rasgamarRelocationSourceRow;
  enemy.row = targetRow;
  enemy.y = targetY;
  enemy.rasgamarTargetRow = null;
  enemy.rasgamarRelocationSourceRow = null;
  enemy.rasgamarRelocationSourceY = null;
  enemy.rasgamarRelocationDurationMs = 0;
  rebuildBattleIndex(session);
  setRasgamarState(session, enemy, "submergedPatrol");
  events.push({
    type: "rasgamarRelocationCompleted",
    enemyId: enemy.id,
    fromRow,
    toRow: enemy.row,
    x: enemy.x,
    y: enemy.y,
  });
  return true;
}

function startRasgamarBaseAssault(session, enemy, config, events) {
  const columns = rasgamarFloodedColumns(session, enemy.row).sort((left, right) => left - right);
  if (!columns.length) return false;
  clearRasgamarCoil(session, enemy);
  clearRasgamarTarget(enemy);
  enemy.rasgamarBaseAssault = true;
  enemy.rasgamarTargetX = columns[0] * CELL.width + CELL.width / 2;
  setRasgamarState(session, enemy, "rangedPositioning");
  events.push({
    type: "rasgamarBaseAssaultStarted",
    enemyId: enemy.id,
    row: enemy.row,
    x: enemy.x,
    y: enemy.y,
    color: config.color,
    seed: nextEffectSeed(session),
  });
  return true;
}

function applyRasgamarBaseAttack(session, enemy, config, events) {
  const origin = getEnemyMuzzleWorldPosition(enemy, { ...config, attackVisual: { muzzle: { x: .11, y: .48 } } });
  const targetY = enemy.y;
  const seconds = Math.max(.1, (origin.x - FIELD.baseX) / config.projectileSpeed);
  session.enemyProjectiles.push({
    id: id("enemy_projectile"), kind: "rasgamarBaseOrb", visualKind: "rasgamarOrb", sourceEnemyId: enemy.id,
    row: enemy.row, x: origin.x, y: origin.y, previousX: origin.x, previousY: origin.y,
    previousRenderX: origin.x, previousRenderY: origin.y, vx: -config.projectileSpeed, vy: (targetY - origin.y) / seconds,
    baseDamage: config.baseAttackDamage, color: config.color, active: true, launched: true,
    trail: createProjectileTrail(16, origin.x, origin.y), ageMs: 0, seed: nextEffectSeed(session),
  });
  enemy.rasgamarBaseAttackCount = Number(enemy.rasgamarBaseAttackCount || 0) + 1;
  enemy.rasgamarNextBaseAttackAt = session.elapsed + config.baseAttackCooldownMs;
  events.push({
    type: "rasgamarBaseOrbLaunched",
    enemyId: enemy.id,
    row: enemy.row,
    x: origin.x,
    y: origin.y,
    color: config.color,
    seed: nextEffectSeed(session),
  });
}

function resolveRasgamarBaseOrbImpact(session, projectile, events) {
  const integrityBefore = session.integrity;
  const invulnerable = Boolean(session.sandboxSettings?.invulnerableBase);
  const shielded = !session.sandbox && session.shieldCharges > 0;
  if (shielded) session.shieldCharges -= 1;
  const requestedDamage = Math.max(1, Math.round(projectile.baseDamage * (Number(session.currentWaveBaseDamageFactor) || 1) * (session.sandboxSettings?.enemyDamageMultiplier ?? 1)));
  const damage = shielded || invulnerable ? 0 : requestedDamage;
  if (damage > 0) session.integrity = Math.max(0, session.integrity - damage);
  if (shielded) events.push({ type: "shieldBlock", x: FIELD.baseX, y: projectile.y, remaining: session.shieldCharges });
  if (damage > 0) events.push({ type: "breach", damage, x: FIELD.baseX, y: projectile.y });
  events.push({ type: "rasgamarBaseAttack", enemyId: projectile.sourceEnemyId, row: projectile.row, damage, requestedDamage, shielded, integrityBefore, integrityAfter: session.integrity, x: FIELD.baseX, y: projectile.y, color: projectile.color, seed: projectile.seed });
}

function selectRasgamarAmbushTarget(session, enemy) {
  const rank = (troop) => [
    troop.type === "reator" ? 0 : 1,
    /suporte/i.test(TROOPS[troop.type]?.role || "") ? 0 : 1,
    (TROOPS[troop.type]?.range || 0) > 1 ? 0 : 1,
    troop.hp / Math.max(1, troop.maxHp),
    -troop.col,
    troop.id,
  ];
  return session.troops
    .filter((troop) => !troop.dead && troop.row === enemy.row && isTideCellFlooded(session, troop.row, troop.col))
    .sort((left, right) => {
      const a = rank(left); const b = rank(right);
      for (let index = 0; index < a.length; index += 1) if (a[index] !== b[index]) return a[index] < b[index] ? -1 : 1;
      return 0;
    })[0] || null;
}

function selectRasgamarRangedPlan(session, enemy, config) {
  const targets = getLivingRasgamarTroopsInRow(session, enemy.row)
    .filter((troop) => !isTideCellFlooded(session, troop.row, troop.col));
  if (!targets.length) return null;

  const maximumRangePx = config.fullLaneRangedAttack
    ? FIELD.width
    : config.rangedRange * CELL.width;
  const legacyRangePx = config.rangedRange * CELL.width;
  const currentCol = rasgamarColumn(enemy);
  const remainingTargets = [...targets];

  while (remainingTargets.length) {
    const troop = selectRasgamarRangedTarget(remainingTargets);
    if (!troop) return null;
    const targetIndex = remainingTargets.findIndex((candidate) => candidate.id === troop.id);
    if (targetIndex >= 0) remainingTargets.splice(targetIndex, 1);

    const positions = rasgamarFloodedColumns(session, enemy.row)
      .map((col) => ({ col, x: col * CELL.width + CELL.width / 2 }))
      .filter((position) => (
        position.x > troop.x
        && position.x - troop.x <= maximumRangePx
      ))
      .sort((left, right) => (
        Math.abs(left.col - currentCol) - Math.abs(right.col - currentCol)
        || right.col - left.col
      ));

    const position = positions[0];
    if (!position) continue;
    const distancePx = position.x - troop.x;
    return {
      troop,
      ...position,
      distancePx,
      fullLaneAttack: Boolean(config.fullLaneRangedAttack && distancePx > legacyRangePx),
    };
  }

  return null;
}

function launchRasgamarDart(session, enemy, config, troop, events) {
  const origin = getEnemyMuzzleWorldPosition(enemy, { ...config, attackVisual: { muzzle: { x: 0.11, y: 0.48 } } });
  const seconds = Math.max(0.1, (origin.x - troop.x) / config.projectileSpeed);
  session.enemyProjectiles.push({
    id: id("enemy_projectile"), kind: "rasgamarDart", visualKind: "rasgamarOrb", sourceEnemyId: enemy.id,
    targetTroopId: troop.id, row: enemy.row, x: origin.x, y: origin.y, previousX: origin.x, previousY: origin.y,
    previousRenderX: origin.x, previousRenderY: origin.y, vx: -config.projectileSpeed, vy: (troop.y - 18 - origin.y) / seconds,
    damage: enemy.damage, color: config.color, active: true, launched: true, trail: createProjectileTrail(14, origin.x, origin.y), ageMs: 0,
    rasgamarSlowFactor: config.rangedAttackSlowFactor, rasgamarSlowMs: config.rangedAttackSlowMs, seed: nextEffectSeed(session),
  });
  events.push({ type: "rasgamarDart", sourceEnemyId: enemy.id, x: origin.x, y: origin.y, color: config.color, seed: nextEffectSeed(session) });
}

function launchVeuSalinoProjectile(session, enemy, troop, config, events) {
  const origin = getEnemyMuzzleWorldPosition(
    enemy,
    config,
    "attackRelease",
    config.attackReleaseVisual.projectileFrame,
  );
  const seconds = Math.max(0.1, (origin.x - troop.x) / config.projectileSpeed);
  session.enemyProjectiles.push({
    id: id("enemy_projectile"), kind: "veuSalinoMucus", visualKind: "veuSalinoMucus", sourceEnemyId: enemy.id,
    targetTroopId: troop.id, targetLocked: true, row: troop.row, x: origin.x, y: origin.y,
    previousX: origin.x, previousY: origin.y, previousRenderX: origin.x, previousRenderY: origin.y,
    vx: -config.projectileSpeed, vy: (troop.y - 18 - origin.y) / seconds, damage: enemy.damage,
    color: config.color, active: true, launched: true, trail: createProjectileTrail(14, origin.x, origin.y), ageMs: 0,
    attackSpeedDebuffFactor: config.attackSpeedDebuffFactor, attackSpeedDebuffDurationMs: config.attackSpeedDebuffDurationMs,
    seed: nextEffectSeed(session),
  });
  events.push({ type: "veuSalinoProjectile", sourceEnemyId: enemy.id, x: origin.x, y: origin.y, color: config.color, seed: nextEffectSeed(session) });
}

function updateRasgamar(session, enemy, config, dt, events) {
  if (enemy.rasgamarState === "laneRelocation") {
    return updateRasgamarLaneRelocation(session, enemy, dt, events);
  }
  if (enemy.rasgamarState === "dive" && Number.isInteger(enemy.rasgamarTargetRow)) {
    if (session.elapsed >= enemy.rasgamarStateEndsAt) {
      setRasgamarState(
        session,
        enemy,
        "laneRelocation",
        Math.max(1, Number(enemy.rasgamarRelocationDurationMs) || 1),
      );
    }
    return true;
  }
  const currentCellFlooded = isTideCellFlooded(session, enemy.row, rasgamarColumn(enemy));
  if (!currentCellFlooded) {
    clearRasgamarCoil(session, enemy);
    const safe = rasgamarFloodedColumns(session, enemy.row).sort((a, b) => Math.abs(a - rasgamarColumn(enemy)) - Math.abs(b - rasgamarColumn(enemy)))[0];
    if (safe == null) { enemy.dead = true; return true; }
    enemy.rasgamarTargetX = safe * CELL.width + CELL.width / 2;
    setRasgamarState(session, enemy, "tideEscape");
  }
  const target = indexedTroopById(session, enemy.rasgamarTargetId);
  const targetFlooded = target && isTideCellFlooded(session, target.row, target.col);
  if (["submergedApproach", "coilEmerge", "coilAttack"].includes(enemy.rasgamarState) && !targetFlooded) {
    clearRasgamarCoil(session, enemy);
    setRasgamarState(session, enemy, "submergedPatrol");
  }
  if (enemy.rasgamarState === "spawnSubmerged") {
    if (session.elapsed >= enemy.rasgamarStateEndsAt) setRasgamarState(session, enemy, "submergedPatrol");
    return true;
  }
  if (enemy.rasgamarState === "tideEscape") {
    if (moveRasgamarTo(session, enemy, enemy.rasgamarTargetX, dt, 1.7)) setRasgamarState(session, enemy, "submergedPatrol");
    return true;
  }
  if (enemy.rasgamarState === "submergedApproach") {
    if (moveRasgamarTo(session, enemy, target.x + 28, dt)) setRasgamarState(session, enemy, "coilEmerge", config.coilEmergeMs);
    return true;
  }
  if (enemy.rasgamarState === "coilEmerge") {
    if (session.elapsed >= enemy.rasgamarStateEndsAt) {
      enemy.rasgamarSubmerged = false;
      target.rasgamarCoiledBy = enemy.id;
      target.paralyzedUntil = Math.max(target.paralyzedUntil || 0, session.elapsed + config.coilDurationMs);
      damageTroop(session, target, config.coilInitialDamage, events);
      setRasgamarState(session, enemy, "coilAttack", config.coilDurationMs);
    }
    return true;
  }
  if (enemy.rasgamarState === "coilAttack") {
    for (let index = 0; index < config.coilPulseTimes.length; index += 1) {
      if (session.elapsed >= enemy.rasgamarStateStartedAt + config.coilPulseTimes[index] && !enemy.rasgamarPulseIndexes.includes(index)) {
        enemy.rasgamarPulseIndexes.push(index);
        damageTroop(session, target, config.coilPulseDamage, events);
        events.push({ type: "rasgamarElectricPulse", enemyId: enemy.id, troopId: target.id, pulseIndex: index, x: target.x, y: target.y, color: config.color });
      }
    }
    if (session.elapsed >= enemy.rasgamarStateEndsAt || target.dead) {
      clearRasgamarCoil(session, enemy, { applySlow: !target.dead });
      setRasgamarState(session, enemy, "coilRelease", 560);
    }
    return true;
  }
  if (enemy.rasgamarState === "coilRelease") {
    if (session.elapsed >= enemy.rasgamarStateEndsAt) setRasgamarState(session, enemy, "surfaceRecovery", config.coilRecoveryMs);
    return true;
  }
  if (enemy.rasgamarState === "rangedPositioning") {
    if (enemy.rasgamarBaseAssault) {
      if (hasLivingTroopsForRasgamar(session)) {
        enemy.rasgamarBaseAssault = false;
        clearRasgamarTarget(enemy);
        setRasgamarState(session, enemy, "dive", config.laneRetargetDiveMs);
        return true;
      }
      if (moveRasgamarTo(session, enemy, enemy.rasgamarTargetX, dt)) {
        setRasgamarState(session, enemy, "rangedEmerge", config.rangedEmergeMs);
      }
      return true;
    }
    if (!target || isTideCellFlooded(session, target.row, target.col)) {
      clearRasgamarTarget(enemy);
      setRasgamarState(session, enemy, "submergedPatrol");
      return true;
    }
    if (moveRasgamarTo(session, enemy, enemy.rasgamarTargetX, dt)) {
      setRasgamarState(session, enemy, "rangedEmerge", config.rangedEmergeMs);
    }
    return true;
  }
  if (enemy.rasgamarState === "rangedEmerge") {
    if (session.elapsed >= enemy.rasgamarStateEndsAt) setRasgamarState(session, enemy, "rangedCharge", config.rangedChargeMs);
    return true;
  }
  if (enemy.rasgamarState === "rangedCharge") {
    if (enemy.rasgamarBaseAssault && hasLivingTroopsForRasgamar(session)) {
      enemy.rasgamarBaseAssault = false;
      clearRasgamarTarget(enemy);
      setRasgamarState(session, enemy, "dive", config.laneRetargetDiveMs);
      return true;
    }
    if (session.elapsed >= enemy.rasgamarStateEndsAt) {
      if (enemy.rasgamarBaseAssault) {
        applyRasgamarBaseAttack(session, enemy, config, events);
      } else if (target) {
        launchRasgamarDart(session, enemy, config, target, events);
      } else {
        clearRasgamarTarget(enemy);
        setRasgamarState(session, enemy, "dive", config.laneRetargetDiveMs);
        return true;
      }
      setRasgamarState(session, enemy, "rangedAttack", config.rangedAttackMs);
    }
    return true;
  }
  if (enemy.rasgamarState === "rangedAttack") {
    if (session.elapsed >= enemy.rasgamarStateEndsAt) setRasgamarState(session, enemy, "surfaceRecovery", config.rangedRecoveryMs);
    return true;
  }
  if (enemy.rasgamarState === "surfaceRecovery") {
    if (session.elapsed >= enemy.rasgamarStateEndsAt) setRasgamarState(session, enemy, "dive", 480);
    return true;
  }
  if (enemy.rasgamarState === "dive") {
    if (session.elapsed >= enemy.rasgamarStateEndsAt) {
      enemy.rasgamarBaseAssault = false;
      clearRasgamarTarget(enemy);
      setRasgamarState(session, enemy, "submergedPatrol");
    }
    return true;
  }
  const ambush = selectRasgamarAmbushTarget(session, enemy);
  if (ambush) {
    enemy.rasgamarTargetId = ambush.id;
    setRasgamarState(session, enemy, "submergedApproach");
    return true;
  }
  const ranged = selectRasgamarRangedPlan(session, enemy, config);
  if (ambush || ranged) enemy.rasgamarNextExposureAt = session.elapsed + config.idleSurfaceExposureEveryMs;
  if (ranged && session.elapsed >= enemy.rasgamarNextActionAt) {
    enemy.rasgamarTargetId = ranged.troop.id;
    enemy.rasgamarTargetX = ranged.x;
    enemy.rasgamarNextActionAt = session.elapsed + config.rangedCooldownMs;
    if (ranged.fullLaneAttack) {
      events.push({
        type: "rasgamarFullLaneTargeted",
        enemyId: enemy.id,
        targetTroopId: ranged.troop.id,
        row: enemy.row,
        targetCol: ranged.troop.col,
        distanceTiles: ranged.distancePx / CELL.width,
        x: enemy.x,
        y: enemy.y,
      });
    }
    setRasgamarState(session, enemy, "rangedPositioning");
    return true;
  }
  const currentRowHasTroops = hasLivingTroopsInRasgamarRow(session, enemy.row);
  if (!currentRowHasTroops) {
    const hasAnyTroops = hasLivingTroopsForRasgamar(session);
    if (hasAnyTroops && session.elapsed >= Number(enemy.rasgamarNextRelocationAt || 0)) {
      const eligibleRows = Array.from({ length: FIELD.rows }, (_, row) => row)
        .filter((row) => row !== enemy.row && rasgamarFloodedColumns(session, row).length > 0);
      const relocationRow = selectRasgamarRelocationRow(session, enemy, eligibleRows);
      if (Number.isInteger(relocationRow)) {
        startRasgamarRelocation(session, enemy, config, relocationRow, events);
        return true;
      }
    }
    if (!hasAnyTroops && session.elapsed >= Number(enemy.rasgamarNextBaseAttackAt || 0)) {
      if (startRasgamarBaseAssault(session, enemy, config, events)) return true;
    }
  }
  if (session.elapsed >= enemy.rasgamarNextExposureAt) {
    enemy.rasgamarNextExposureAt = session.elapsed + config.idleSurfaceExposureEveryMs;
    setRasgamarState(session, enemy, "surfaceRecovery", config.rangedRecoveryMs);
    return true;
  }
  const columns = rasgamarFloodedColumns(session, enemy.row);
  if (!columns.length) return true;
  if (!Number.isInteger(enemy.rasgamarPatrolCol) || !columns.includes(enemy.rasgamarPatrolCol)) {
    enemy.rasgamarPatrolCol = columns[Math.floor(session.rng() * columns.length)];
  }
  if (moveRasgamarTo(session, enemy, enemy.rasgamarPatrolCol * CELL.width + CELL.width / 2, dt)) enemy.rasgamarPatrolCol = null;
  return true;
}

function updateEnemies(session, dt, events) {
  const enemyCountAtStart = session.enemies.length;
  const runtime = createEnemyRuntime(session, events);
  for (let enemyIndex = 0; enemyIndex < enemyCountAtStart; enemyIndex += 1) {
    const enemy = session.enemies[enemyIndex];
    if (enemy.dead) continue;
    enemy.previousRenderX = enemy.x;
    enemy.previousRenderY = enemy.y;
    const config = ENEMIES[enemy.type];
    const behavior = getEnemyBehavior(enemy.type);
    if (updateSilicaDiggerEmergence(session, enemy, config, events)) continue;
    if (enemy.type === "scarabEmperor") {
      behavior.update(runtime, enemy, config, dt, events);
      continue;
    }
    if (enemy.type === "leviathanNereida" || enemy.type === "colossoCaldeira") {
      behavior.update(runtime, enemy, config, dt, events);
      continue;
    }
    if (enemy.type === "saltadorAlado") {
      updateSaltadorAlado(runtime, enemy, config, dt, events);
      continue;
    }
    if (enemy.type === "macacoEsporos") {
      behavior.update(runtime, enemy, config, dt, events);
      continue;
    }
    if (enemy.type === "tartaragarra") {
      behavior.update(runtime, enemy, config, dt, events);
      continue;
    }
    if (enemy.type === "garravinha" || enemy.type === "dardifago") {
      behavior.update(runtime, enemy, config, dt, events);
      continue;
    }
    if (session.elapsed < (enemy.stunnedUntil || 0)) {
      enemy.moving = false;
      continue;
    }
    if (enemy.type === "enguiaRasgamar") {
      behavior.update(runtime, enemy, config, dt, events);
      continue;
    }
    if (config.chapterId === "chapter_04" && behavior.update(runtime, enemy, config, dt, events)) continue;
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

    if (behavior.update(runtime, enemy, config, dt, events)) continue;

    if (enemy.type === "duneRipper") {
      updateDuneRipper(session, enemy, config, dt, events);
      continue;
    }

    if (enemy.type === "ramBeetle") {
      updateRamBeetle(session, enemy, config, dt, events);
      continue;
    }

    if (enemy.type === "carapacaNereida") {
      updateCarapacaNereida(session, enemy, config, dt, events);
      continue;
    }

    if (enemy.type === "medusaVeuSalino") {
      updateMedusaVeuSalino(session, enemy, config, dt, events);
      continue;
    }

    if (enemy.type === "mordelume") {
      updateMordelume(session, enemy, config, dt, events);
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
          const biteConfig = config.persistentBite;
          const damage = biteConfig
            ? enemy.damage * getPersistentBiteMultiplier(enemy, target.id, biteConfig)
            : enemy.damage;
          damageTroop(session, target, damage, events, { sourceEnemyId: enemy.id });
          if (biteConfig) {
            if (enemy.persistentBiteTargetId && enemy.persistentBiteTargetId !== target.id) {
              resetPersistentBite(enemy);
              events.push({ type: "rastejanteFrenzyChanged", sourceEnemyId: enemy.id, frenzyLevel: 0 });
            }
            const previousFrenzy = enemy.frenzyLevel;
            commitPersistentBite(enemy, target.id, biteConfig);
            events.push({ type: "rastejanteBite", sourceEnemyId: enemy.id, targetTroopId: target.id,
              damage, multiplier: damage / enemy.damage, frenzyLevel: enemy.frenzyLevel });
            if (previousFrenzy !== enemy.frenzyLevel) events.push({ type: "rastejanteFrenzyChanged", sourceEnemyId: enemy.id, frenzyLevel: enemy.frenzyLevel });
          }
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
      enemy.targetKind = "troop";
      enemy.targetId = target.id;
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
          const biteConfig = config.persistentBite;
          const damage = biteConfig ? enemy.damage * getPersistentBiteMultiplier(enemy, target.id, biteConfig) : enemy.damage;
          damageTroop(session, target, damage, events, { sourceEnemyId: enemy.id });
          if (biteConfig) {
            if (enemy.persistentBiteTargetId && enemy.persistentBiteTargetId !== target.id) {
              resetPersistentBite(enemy);
              events.push({ type: "rastejanteFrenzyChanged", sourceEnemyId: enemy.id, frenzyLevel: 0 });
            }
            const previousFrenzy = enemy.frenzyLevel;
            commitPersistentBite(enemy, target.id, biteConfig);
            events.push({ type: "rastejanteBite", sourceEnemyId: enemy.id, targetTroopId: target.id, damage, multiplier: damage / enemy.damage, frenzyLevel: enemy.frenzyLevel });
            if (previousFrenzy !== enemy.frenzyLevel) events.push({ type: "rastejanteFrenzyChanged", sourceEnemyId: enemy.id, frenzyLevel: enemy.frenzyLevel });
          }
          enemy.attackReadyAt = session.elapsed + config.attackEveryMs;
          enemy.lastAttackAt = session.elapsed;
        }
      }
    } else if (canEnemyReachConvoy(session, enemy, config) && !hasBlockingTroop(session, enemy)) {
      enemy.targetKind = "convoy";
      enemy.targetId = session.convoy.id;
      enemy.moving = false;
      if (session.elapsed >= enemy.attackReadyAt) {
        const factor = Number(config.convoyDamageFactor) || 1;
        damageConvoy(session, enemy.damage * factor, events, { attackerId: enemy.id, enemyType: enemy.type });
        enemy.attackReadyAt = session.elapsed + config.attackEveryMs;
        enemy.lastAttackAt = session.elapsed;
      }
      if (config.persistentBite) resetPersistentBite(enemy);
    } else {
      enemy.targetKind = "base";
      enemy.targetId = null;
      if (config.persistentBite) resetPersistentBite(enemy);
      moveEnemy(session, enemy, dt, events);
    }
  }
  compactActive(session.troops, (troop) => !troop.dead);
  compactActive(session.enemies, (enemy) => !enemy.dead);
}

function updateMines(session, events) {
  for (const mine of session.mines) {
    if (!mine.active) continue;
    if (isTideMineDisabled(session, mine) || session.elapsed < (mine.leviathanDisabledUntil || 0)) continue;
    const cellLeft = mine.col * CELL.width;
    const cellRight = cellLeft + CELL.width;
    const trigger = session.enemies.find((enemy) => {
      if (!enemyOccupiesTargetRow(enemy, mine.row) || ENEMIES[enemy.type]?.triggersGroundTraps === false || !isGroundTrapEligible(enemy)) return false;
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
  compactActive(session.mines, (mine) => mine.active);
  compactActive(session.enemies, (enemy) => !enemy.dead);
}

function finish(session, outcome) {
  if (session.outcome) return;
  const convoyMission = session.phase?.progressionMode === "convoy" && session.convoy;
  const integrityPercent = convoyMission
    ? session.convoy.hp / Math.max(1, session.convoy.maxHp) * 100
    : session.integrityMax > 0 ? session.integrity / session.integrityMax * 100 : 0;
  session.outcome = outcome;
  session.pendingOutcome = null;
  session.waveActive = false;
  enterThermalIntermission(session);
  session.preparing = false;
  session.result = {
    phaseId: session.phase.id,
    outcome,
    stars: convoyMission
      ? calculateConvoyStars({ outcome, convoyHp: session.convoy.hp, convoyMaxHp: session.convoy.maxHp, durationMs: session.elapsed, targetDurationMs: session.phase.targetDurationMs })
      : calculateStars({ outcome, integrity: session.integrity, integrityMax: session.integrityMax, durationMs: session.elapsed, targetDurationMs: session.phase.targetDurationMs }),
    durationMs: Math.round(session.elapsed),
    integrity: Math.round(integrityPercent),
    integrityCurrent: Math.round(convoyMission ? session.convoy.hp : session.integrity),
    integrityMax: Math.round(convoyMission ? session.convoy.maxHp : session.integrityMax),
    baseIntegrity: Math.round(session.integrity / Math.max(1, session.integrityMax) * 100),
    convoyIntegrity: convoyMission ? Math.round(integrityPercent) : null,
    checkpointsReached: convoyMission ? session.convoyFlow.reachedCheckpointCount : null,
    reserveRemaining: convoyMission ? Math.round(session.convoy.reserve) : null,
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

export function repositionTroop(session, troopId, row, col) {
  return repositionConvoyTroop(session, troopId, row, col, rebuildBattleIndex);
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
  compactActive(session.enemies, (enemy) => !enemy.dead);
  return { ...result, events };
}

export function stepBattle(session, dt = 32) {
  if (session.outcome) return [];
  const events = [];
  const convoyMission = session.phase?.progressionMode === "convoy" && session.convoyFlow;
  if (convoyMission && session.convoyFlow.state === "sectorCountdown") return events;
  if (convoyMission && session.convoyFlow.state === "convoyEntry") {
    updateConvoyAnimation(session);
    return events;
  }
  if (convoyMission && session.convoyFlow.state === "convoyTransit") {
    session.elapsed += dt;
    const transitOutcome = advanceConvoyTransit(session, dt, events);
    updateConvoyAnimation(session);
    if (transitOutcome === "victory") finish(session, "victory");
    return events;
  }
  if (convoyMission && session.convoyFlow.state === "destroying") {
    session.elapsed += dt;
    updateConvoyAnimation(session);
    if (session.pendingOutcome === "defeat"
      && session.elapsed - session.convoyFlow.destroyingStartedAt >= CONVOY_DEFEAT_RESULT_DELAY_MS) {
      finish(session, "defeat");
    }
    return events;
  }
  if (convoyMission && session.convoyFlow.state === "checkpointPreparation") {
    updateEnergyPickups(session, dt, events, { freezeLifetime: true });
    return events;
  }
  if (convoyMission && session.convoyFlow.state === "initialPreparation") return events;
  session.elapsed += dt;
  if (convoyMission) {
    updateConvoyEnergy(session, events);
    updateConvoyThreat(session, ENEMIES, events);
    updateConvoyAnimation(session);
    updateConvoyReinforcements(session, events);
  }
  updateAdaptiveAidLifecycle(session, events);
  if (session.pendingOutcome && !isWaveOutroActive(session)
    && !adaptiveAidBlocksIntermission(session.adaptiveAid?.status)) {
    finish(session, session.pendingOutcome);
    return events;
  }
  if (isSystemEnabledForPhase(session.phase, "enemyEnergyPickups") || convoyMission) updateEnergyPickups(session, dt, events);
  updateTideCycle(session, events, { eliminateTroop });
  updateThermalTerrain(session, dt, events, { eliminateTroop, refreshTroop: refreshTroopAttackSpeedFactor });
  const alphaResult = evaluateAlphaPressure(session, session.phase?.alphaPressure, ENEMIES);
  if (alphaResult?.checked) {
    session.metrics.alphaPressure.checks += 1;
    if (alphaResult.triggered) {
      session.metrics.alphaPressure.triggers += 1;
      scheduleAlphaPressureSpawn(session, alphaResult, events);
    }
  }
  updateAresThermalShields(session, events);
  updateWindCurrent(session, events, {
    troops: TROOPS,
    enemies: ENEMIES,
    isCellReserved: capsuleReservesCell,
    damageTroop,
    eliminateTroop,
  });
  updateSandstorm(session, events);
  compactActive(session.troops, (troop) => !troop.dead);
  rebuildBattleIndex(session);
  const settlingWaveOutro = ["finalKill", "cleanup"].includes(session.waveOutro?.status);
  if (settlingWaveOutro && !session.waveActive && !session.sandbox) {
    updateProjectiles(session, dt, events);
  }
  if (session.waveActive || session.sandbox) {
    session.supplyAccumulator += dt;
    while (session.supplyAccumulator >= 1000) {
      session.supplyAccumulator -= 1000;
      session.supply = Math.min(session.supplyMax, session.supply + 1);
    }
    while (session.waveActive && session.queue.length && session.elapsed >= session.nextSpawnAt) {
      if (shouldDeferChapterFiveSpawn(session, session.queue[0])) {
        deferChapterFivePacket(session, session.queue[0].packetId);
        break;
      }
      const queued = session.queue.shift();
      const enemy = createEnemy(session, queued);
      session.nextSpawnAt = session.queue.length
        ? session.waveStartedAt + session.queue[0].spawnAtMs
        : Infinity;
      if (!enemy) continue;
      markBossEncounterSpawned(session, queued);
      if (queued.packetId === BOSS_ENCOUNTER_PACKET_ID && session.bossEncounter?.permanentEruption) {
        activatePermanentThermalHazards(session, session.bossEncounter, enemy.id);
        events.push({
          type: "permanentThermalHazardStarted",
          hazardType: "permanentEruption",
          sourceEnemyId: enemy.id,
          cells: session.bossEncounter.permanentEruption.cells,
          warningMs: 1800,
        });
      }
      markBossReinforcementSpawned(session, queued);
      events.push({ type: "spawn", x: enemy.x, y: enemy.y, enemy });
    }
    updateAlphaPressureSpawns(session, events);
    if (isSystemEnabledForPhase(session.phase, "dematerializationPulse")) updateDematerializationPulses(session, events);
    updatePrismaticMantle(session, events);
    updateTroops(session, events, dt);
    updateProjectiles(session, dt, events);
    updateEnemyProjectiles(session, dt, events);
    updateEmberBurns(session, events);
    updateEnemies(session, dt, events);
    updateSporeField(session, events);
    if (convoyMission) {
      updateConvoyThreat(session, ENEMIES, events);
      if (session.convoy.hp <= 0) {
        if (session.convoyFlow.state !== "destroying") {
          session.convoyFlow.state = "destroying";
          session.convoyFlow.destroyingStartedAt = session.elapsed;
          session.pendingOutcome = "defeat";
          session.queue = [];
          session.waveActive = false;
          session.convoy.invulnerable = true;
          updateConvoyAnimation(session);
          events.push({ type: "convoyDestroyed", x: session.convoy.x, y: session.convoy.y });
        }
        return events;
      }
    }
    updateBossEncounter(session);
    updateMines(session, events);
    if (!session.sandbox && session.integrity <= 0) {
      endSandstorm(session, events, true);
      endWindCurrent(session, events, true);
      endTideCycle(session, events, true);
      finish(session, "defeat");
      return events;
    }
    if (!session.sandbox && session.queue.length === 0 && session.enemies.length === 0 && session.alphaPressure.pendingSpawns.length) {
      session.alphaPressure.pendingSpawns = [];
    }
    const waveCleared = !convoyMission && !session.sandbox && !session.outcome && session.waveActive
      && session.queue.length === 0 && session.enemies.length === 0 && session.enemyProjectiles.length === 0
      && session.alphaPressure.pendingSpawns.length === 0;
    if (waveCleared) {
      session.waveActive = false;
      enterThermalIntermission(session);
      session.activeTemporaryDecisions = [];
      endSandstorm(session, events, true);
      endWindCurrent(session, events, true);
      endTideCycle(session, events, true);
      const completedWave = session.waveIndex;
      const waveCompletionEnergy = Math.max(0, Number(session.phase.waveCompletionEnergy) || 0);
      const waveCompletionAmount = Math.min(waveCompletionEnergy, Math.max(0, session.energyMax - session.energy));
      let outroEnergyGained = waveCompletionAmount;
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
          outroEnergyGained += amount;
          session.energy += amount;
          session.lastEnergyGainAt = session.elapsed;
          reactor.lastAttackAt = session.elapsed;
          events.push({ type: "energyGenerated", sourceTroopId: reactor.id, x: reactor.x, y: reactor.y, amount, reason: "wave", color: config.color });
        }
      }
      const finalWave = completedWave >= session.phase.waves.length - 1;
      const completedWaveNumber = completedWave + 1;
      let decisionLevel = null;
      let decisionOptions = null;
      if (finalWave) {
        session.pendingOutcome = "victory";
      } else {
        session.waveIndex += 1;
        session.preparing = false;
        decisionLevel = getDecisionStage(completedWaveNumber, session.phase.waves.length);
        decisionOptions = getDecisionOptions({
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
      }
      const fatalEvent = [...events].reverse().find((event) =>
        ["enemyDeath", "bossDeath", "glassEchoShatter"].includes(event.type));
      const fatalEnemy = fatalEvent?.entity || null;
      const fatalConfig = ENEMIES[fatalEnemy?.type] || {};
      const eventLastKill = fatalEnemy ? {
        enemy: { ...fatalEnemy },
        sourceTroopId: fatalEvent.sourceTroopId || null,
        row: fatalEnemy.row,
        cinematic: Boolean(fatalEnemy.variant === "alpha" || fatalConfig.boss || fatalConfig.elite),
      } : null;
      const lastKill = session.lastEnemyKillCandidate
        ? { ...session.lastEnemyKillCandidate, enemy: { ...session.lastEnemyKillCandidate.enemy } }
        : eventLastKill;
      session.waveOutro = {
        status: "finalKill",
        elapsedMs: 0,
        startedAt: session.elapsed,
        lastKill,
        completedWave: completedWaveNumber,
        decisionOptions,
        decisionLevel,
        finalWave,
        killed: Math.max(0, session.killed - session.waveKillStart),
        survivors: session.troops.filter((troop) => !troop.dead).length,
        integrityPercent: Math.round(session.integrity / Math.max(1, session.integrityMax) * 100),
        energyGained: outroEnergyGained,
      };
      if (lastKill) events.push({ type: "lastEnemyKilled", ...lastKill });
      events.push({ type: "waveOutroStarted", wave: completedWaveNumber, finalWave });
      events.push({ type: "waveComplete", wave: completedWaveNumber });
    } else evaluateAdaptiveAid(session, events);
  }
  if (convoyMission && session.convoyFlow.state === "sectorActive"
    && session.queue.length === 0 && !hasCombatRelevantEnemies(session)) completeConvoySector(session, events);
  return events;
}

export function getSnapshot(session) {
  const deploymentStats = Object.fromEntries(session.loadout.map((troopId) => {
    const activeCount = getActiveTroopCount(session, troopId);
    const maxDeployed = getTroopDeploymentLimit(troopId, session);
    return [troopId, { ...getEffectiveTroopStats(session, troopId), activeCount, maxDeployed, limitReached: activeCount >= maxDeployed }];
  }));
  return {
    energy: Math.round(session.energy), energyMax: Math.round(session.energyMax),
    energyPulse: session.elapsed - session.lastEnergyGainAt < 700,
    supply: Math.round(session.supply * 10) / 10, supplyMax: session.supplyMax,
    integrity: Math.round(session.integrity), integrityMax: Math.round(session.integrityMax),
    wave: session.convoyFlow ? session.convoyFlow.sectorIndex + 1 : session.waveIndex + 1,
    totalWaves: session.phase.sectors?.length || session.phase.waves.length,
    progressionMode: session.phase.progressionMode || "waves",
    convoy: session.convoy ? {
      state: session.convoyFlow.state,
      sector: session.convoyFlow.sectorIndex + 1,
      progress: session.convoy.progress,
      hp: Math.round(session.convoy.hp), hpMax: Math.round(session.convoy.maxHp),
      entryState: session.convoy.entryState,
      hpPercent: Math.round(session.convoy.hp / Math.max(1, session.convoy.maxHp) * 100),
      underAttack: session.convoy.underAttack,
      grappled: Boolean(session.convoy.grappledByEnemyId),
      grappledByEnemyId: session.convoy.grappledByEnemyId || null,
      grappleReservationEnemyId: session.convoy.grappleReservationEnemyId || null,
      grappledSince: session.convoy.grappledSince,
      attackerCount: session.convoy.attackerIds.length, reserve: Math.round(session.convoy.reserve),
      reserveMax: session.convoy.reserveMax, checkpointsReached: session.convoyFlow.reachedCheckpointCount,
      nextEnergyPulseIn: Math.max(0, session.convoy.nextEnergyPulseAt - session.elapsed),
      reinforcementLevel: session.convoyFlow.reinforcementLevel,
      checkpointBriefingPending: Boolean(session.convoyFlow.checkpointBriefingPending),
      checkpointDecisionPending: Boolean(session.convoyFlow.checkpointDecisionPending),
      checkpointOptionChosen: Boolean(session.convoyFlow.checkpointOptionChosen),
      repairAmount: session.phase.convoy.checkpointRewards?.repairHp || 200,
      reserveAmount: session.phase.convoy.checkpointRewards?.reserveAmount || 40,
      transitProgress: session.convoy.transit?.progress || 0,
      nextSector: Math.min(session.phase.sectors.length, session.convoyFlow.sectorIndex
        + (["checkpointDecision", "checkpointPreparation"].includes(session.convoyFlow.state) ? 2 : 1)),
      countdownRemainingMs: session.convoyFlow.state === "sectorCountdown"
        ? Math.max(0, (session.convoyFlow.countdownDurationMs || 2400) - (session.convoyFlow.countdownElapsedMs || 0))
        : 0,
      entryProgress: session.convoyFlow.state === "convoyEntry" ? (session.convoy.entry?.progress || 0) : 0,
    } : null,
    pendingOutcome: session.pendingOutcome,
    enemies: session.enemies.length, queued: session.queue.length,
    mines: session.mines.length,
    energyPickups: session.energyPickups.length,
    chapterSevenMetrics: session.chapterSevenMetrics ? { ...session.chapterSevenMetrics } : null,
    preparing: session.preparing, pendingDecision: session.pendingDecision, pendingDecisionLevel: session.pendingDecisionLevel,
    waveOutro: session.waveOutro ? {
      status: session.waveOutro.status,
      elapsedMs: session.waveOutro.elapsedMs,
      completedWave: session.waveOutro.completedWave,
      finalWave: session.waveOutro.finalWave,
      killed: session.waveOutro.killed,
      survivors: session.waveOutro.survivors,
      integrityPercent: session.waveOutro.integrityPercent,
      energyGained: session.waveOutro.energyGained,
      decisionOptions: Array.isArray(session.waveOutro.decisionOptions)
        ? session.waveOutro.decisionOptions.map((option) => ({ id: option.id, label: option.label }))
        : [],
      lastKill: session.waveOutro.lastKill ? {
        row: session.waveOutro.lastKill.row,
        sourceTroopId: session.waveOutro.lastKill.sourceTroopId,
        cinematic: session.waveOutro.lastKill.cinematic,
        enemy: session.waveOutro.lastKill.enemy ? {
          type: session.waveOutro.lastKill.enemy.type,
          x: session.waveOutro.lastKill.enemy.x,
          y: session.waveOutro.lastKill.enemy.y,
          variant: session.waveOutro.lastKill.enemy.variant,
        } : null,
      } : null,
    } : null,
    outcome: session.outcome, elapsed: session.elapsed,
    sandbox: session.sandbox,
    sandboxSettings: session.sandboxSettings ? { ...session.sandboxSettings } : null,
    cooldowns: Object.fromEntries(Object.entries(session.deployCooldowns).map(([key, value]) => [key, Math.max(0, value - session.elapsed)])),
    deploymentStats,
    routeTelemetry: getRouteTelemetry(session),
    refundRate: session.modifiers.refundRate,
    shieldCharges: session.shieldCharges,
    fortifiedRow: session.fortifiedRow,
    focusedFireRow: session.focusedFireRow,
    advancedFormationColumns: [...session.advancedFormationColumns],
    pendingPositionalDecision: session.pendingPositionalDecision ? { ...session.pendingPositionalDecision } : null,
    activeTemporaryDecisions: [...session.activeTemporaryDecisions],
    queuedTemporaryDecisions: [...session.queuedTemporaryDecisions],
    upcomingThreat: (() => {
      const activeBoss = session.enemies.find((enemy) => !enemy.dead && (enemy.variant === "alpha" || ENEMIES[enemy.type]?.boss));
      if (activeBoss) {
        return {
          label: ENEMIES[activeBoss.type]?.label || activeBoss.type,
          isAlpha: activeBoss.variant === "alpha",
          isBoss: Boolean(ENEMIES[activeBoss.type]?.boss),
          row: activeBoss.row,
          active: true,
        };
      }
      const queuedThreat = session.queue.find((item) => item.variant === "alpha" || ENEMIES[item.type]?.boss);
      if (queuedThreat) {
        return {
          label: ENEMIES[queuedThreat.type]?.label || queuedThreat.type,
          isAlpha: queuedThreat.variant === "alpha",
          isBoss: Boolean(ENEMIES[queuedThreat.type]?.boss),
          row: Number.isInteger(queuedThreat.row) ? queuedThreat.row : 0,
          startsInMs: Math.max(0, (session.waveStartedAt + queuedThreat.spawnAtMs) - session.elapsed),
          active: false,
        };
      }
      const scheduledAlpha = session.alphaPressure.pendingSpawns.find((item) => item.variant === "alpha");
      if (scheduledAlpha) {
        return {
          label: ENEMIES[scheduledAlpha.type]?.label || scheduledAlpha.type,
          isAlpha: true,
          isBoss: false,
          row: scheduledAlpha.row,
          startsInMs: Math.max(0, scheduledAlpha.spawnAt - session.elapsed),
          active: false,
        };
      }
      return null;
    })(),
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
      sourceCol: session.windCurrent.sourceCol,
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
      shiftedTroopIds: [...session.windCurrent.shiftedTroopIds],
      ejectedTroopIds: [...session.windCurrent.ejectedTroopIds],
      collisionTroopIds: [...session.windCurrent.collisionTroopIds],
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
    },
    tideCycle: getTideSnapshot(session),
    thermal: getThermalSnapshot(session),
    alphaPressure: {
      enabled: session.alphaPressure.enabled,
      nextCheckInMs: Number.isFinite(session.alphaPressure.nextCheckAt) ? Math.max(0, session.alphaPressure.nextCheckAt - session.elapsed) : 0,
      checksThisWave: session.alphaPressure.checksThisWave,
      failedChecksThisWave: session.alphaPressure.failedChecksThisWave,
      spawnsThisWave: session.alphaPressure.spawnsThisWave,
      totalAlphaSpawned: session.alphaPressure.totalAlphaSpawned,
      lastCheckAt: session.alphaPressure.lastCheckAt,
      lastTriggeredAt: session.alphaPressure.lastTriggeredAt,
      lastSpawnType: session.alphaPressure.lastSpawnType,
      lastSpawnRow: session.alphaPressure.lastSpawnRow,
      troopCountCurrent: countPressureTroops(session),
      pendingSpawns: session.alphaPressure.pendingSpawns.map((entry) => ({ type: entry.type, row: entry.row, startsInMs: Math.max(0, entry.spawnAt - session.elapsed) })),
    },
    dematerializationPulses: session.dematerializationPulses.map((pulse) => ({ ...pulse })),
    nextWaveEnemyCountFactor: session.nextWaveEnemyCountFactor,
  };
}

export function isWaveOutroActive(session) {
  return isWaveOutroActiveState(session);
}

export function getWaveOutroCinematicFactor(session, reduceMotion = false) {
  return getWaveOutroCinematicFactorFromState(session, reduceMotion);
}

export function accelerateWaveOutro(session) {
  return accelerateWaveOutroState(session);
}

function restoreTroopsForPlanning(session) {
  session.deployCooldowns = {};
  session.troops.forEach((troop) => {
    if (troop.dead) return;
    const config = TROOPS[troop.type];

    troop.attackReadyAt = session.elapsed;
    troop.mineReadyAt = session.elapsed;
    troop.gunReadyAt = session.elapsed;
    troop.interceptionReadyAt = config?.interceptionCooldownMs ? session.elapsed : Infinity;
    troop.specialReadyAt = config?.specialEveryMs ? session.elapsed : Infinity;
    if (config?.attack === "energy") troop.energyAccumulator = config.attackEveryMs;

    troop.state = "idle";
    troop.stateStartedAt = session.elapsed;
    troop.stateEndsAt = Infinity;
    troop.attackStartedAt = -Infinity;
    troop.lastAttackAt = -Infinity;
    troop.attackTargetId = null;
    troop.attackReleased = false;
    troop.attackReleaseAt = Infinity;
    troop.lastAttackMode = null;
    troop.attackBusyUntil = session.elapsed;
    troop.channelingAttack = false;
    troop.channelTickAccumulator = 0;
    troop.pendingImpact = null;
    troop.pendingComboImpact = null;
    troop.pendingRepulsorShot = null;
    troop.specialRequested = false;
    troop.comboStep = 0;
    troop.comboTargetId = null;
    troop.comboExpiresAt = null;

    troop.defenseActive = false;
    troop.defenseThreatId = null;
    troop.defenseExitAt = null;
    troop.icaroLockedTargetIds = [];

    troop.healTargetId = null;
    troop.healedThisCharge = 0;
    troop.lastHealPulseAt = -Infinity;
    troop.cooldownStartedAt = null;
    troop.cooldownEndsAt = null;

    troop.electricStacks = 0;
    troop.electricStacksExpireAt = session.elapsed;
    troop.electricParalyzedUntil = session.elapsed;
    troop.electricImmunityUntil = session.elapsed;
    troop.electricConductivityUntil = session.elapsed;
    troop.electricVulnerabilityUntil = session.elapsed;
    troop.electricReactorPausedUntil = session.elapsed;
    troop.webSlowUntil = session.elapsed;
    troop.webRangePenaltyUntil = session.elapsed;
  });
}

export function advanceWaveOutro(session, realDt = 0) {
  return advanceWaveOutroState(session, realDt, {
    finish,
    adaptiveAidBlocksIntermission,
  });
}

export function getRouteTelemetry(session) {
  return getRouteTelemetryFromState(session, enemyOccupiesTargetRow);
}

export function cellFromPoint(x, y) {
  return cellFromPointFromGeometry(x, y);
}
