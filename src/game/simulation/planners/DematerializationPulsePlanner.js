import {
  DEMATERIALIZATION_PULSE,
  calculateDematerializationPulseCollapseScore,
  estimateDematerializationPulseValue,
} from "../../dematerializationPulse.js";
import { ENEMIES } from "../../content.js";
import { FIELD } from "../../visualGeometry.js";

const DEFAULT_POLICY = Object.freeze({
  pulseRiskThreshold: 16,
  pulseEmergencyTimeMs: 6000,
  pulseMinimumValue: 900,
});

function pulsePolicy(profile = {}) {
  return {
    pulseRiskThreshold: Number(profile.pulseRiskThreshold ?? DEFAULT_POLICY.pulseRiskThreshold),
    pulseEmergencyTimeMs: Number(profile.pulseEmergencyTimeMs ?? DEFAULT_POLICY.pulseEmergencyTimeMs),
    pulseMinimumValue: Number(profile.pulseMinimumValue ?? DEFAULT_POLICY.pulseMinimumValue),
  };
}

const projectedEnemySpeed = (session, enemy) => (
  Number(enemy.speed || 0)
  * Number(session.modifiers?.enemySpeed || 1)
  * Number(session.sandboxSettings?.enemySpeedMultiplier ?? 1)
);

function queuedEnemyAtFire(session, queued, fireAt) {
  const spawnedAt = Number(session.waveStartedAt || 0) + Number(queued.spawnAtMs || 0);
  if (spawnedAt > fireAt || !Number.isInteger(queued.row)) return null;
  const config = ENEMIES[queued.type];
  if (!config) return null;
  const alpha = queued.variant === "alpha" && config.allowAlphaVariant !== false;
  const hp = config.hp * (alpha ? 8 : 1) * Number(session.sandboxSettings?.enemyHpMultiplier ?? 1);
  const elapsedSinceSpawn = Math.max(0, fireAt - spawnedAt);
  const speed = projectedEnemySpeed(session, { speed: config.speed * (alpha ? .75 : 1) });
  const x = FIELD.spawnX - speed * elapsedSinceSpawn / 1000;
  if (x <= FIELD.baseX) return null;
  return { type: queued.type, variant: alpha ? "alpha" : null, row: queued.row, hp, maxHp: hp, x, projected: true };
}

export function projectDematerializationPulseLane(session, lane, horizonMs = DEMATERIALIZATION_PULSE.chargeDurationMs) {
  const fireAt = Number(session?.elapsed || 0) + horizonMs;
  const row = lane?.row;
  if (!session || !Number.isInteger(row)) return null;
  const current = (lane.enemies || session.enemies || [])
    .filter((enemy) => !enemy.dead && Number(enemy.hp) > 0 && enemy.row === row)
    .map((enemy) => ({
      ...enemy,
      x: enemy.x - projectedEnemySpeed(session, enemy) * horizonMs / 1000,
    }))
    .filter((enemy) => enemy.x > FIELD.baseX);
  const incoming = (session.queue || [])
    .filter((queued) => queued.row === row)
    .map((queued) => queuedEnemyAtFire(session, queued, fireAt))
    .filter(Boolean);
  const enemies = [...current, ...incoming];
  const frontline = (lane.troops || session.troops || [])
    .filter((troop) => !troop.dead && Number(troop.hp) > 0 && troop.row === row)
    .sort((left, right) => left.x - right.x)[0];
  const frontlineAtRisk = Boolean(frontline && enemies.some((enemy) => enemy.x <= frontline.x));
  const lowestTimeToBaseMs = enemies.reduce((lowest, enemy) => {
    const speed = projectedEnemySpeed(session, enemy);
    const remaining = speed > 0 ? (enemy.x - FIELD.baseX) / speed * 1000 : Infinity;
    return Math.min(lowest, remaining);
  }, Infinity);
  const value = estimateDematerializationPulseValue(enemies, DEMATERIALIZATION_PULSE.damage);
  return {
    row,
    fireAt,
    enemies,
    currentSurvivors: current.length,
    incomingCount: incoming.length,
    frontlineExpectedAlive: Boolean(frontline) && !frontlineAtRisk,
    frontlineAtRisk,
    lowestTimeToBaseMs,
    ...value,
  };
}

export function evaluateDematerializationPulseLane(lane, pulse, profile = {}, projection = null) {
  if (!lane || !pulse || pulse.state !== "ready") return null;
  const value = projection || estimateDematerializationPulseValue(lane.enemies, DEMATERIALIZATION_PULSE.damage);
  if (!value.enemyCount) return null;

  const policy = pulsePolicy(profile);
  const projectedLane = projection ? {
    ...lane,
    enemies: projection.enemies,
    hasFrontline: projection.frontlineExpectedAlive,
    lowestTimeToBaseMs: projection.lowestTimeToBaseMs,
    criticalTroops: projection.frontlineAtRisk ? Math.max(1, Number(lane.criticalTroops || 0)) : lane.criticalTroops,
  } : lane;
  const collapseScore = calculateDematerializationPulseCollapseScore(projectedLane);
  const timeToBaseMs = Number(projectedLane.lowestTimeToBaseMs);
  const emergency = Number.isFinite(timeToBaseMs) && timeToBaseMs <= policy.pulseEmergencyTimeMs;
  const routeCollapse = collapseScore >= policy.pulseRiskThreshold;
  const frontlineCritical = Number(projectedLane.criticalTroops || 0) > 0 && Number(lane.risk || 0) >= policy.pulseRiskThreshold * 0.65;
  const highValue = value.potentialDamage >= policy.pulseMinimumValue;
  const shouldActivate = emergency
    ? value.potentialDamage >= Math.min(DEMATERIALIZATION_PULSE.damage * 0.5, policy.pulseMinimumValue)
    : (routeCollapse || frontlineCritical) && highValue;

  const reason = emergency
    ? "pulseEmergencyProximity"
    : frontlineCritical
      ? "pulseProtectCriticalTroops"
      : "pulsePreventLaneCollapse";

  const priority = Math.min(205, Math.round(
    145
    + Math.min(36, collapseScore * 1.6)
    + (emergency ? 18 : 0)
    + Math.min(6, value.potentialKills * 2),
  ));

  return {
    shouldActivate,
    row: lane.row,
    reason,
    priority,
    collapseScore,
    timeToBaseMs,
    risk: Number(lane.risk || 0),
    criticalTroops: Number(lane.criticalTroops || 0),
    potentialDamage: value.potentialDamage,
    potentialKills: value.potentialKills,
    enemyCount: value.enemyCount,
    projected: Boolean(projection),
    incomingCount: Number(projection?.incomingCount || 0),
    frontlineExpectedAlive: projection?.frontlineExpectedAlive ?? Boolean(lane.hasFrontline),
  };
}

export function planDematerializationPulseActions(session, observation, profile = {}) {
  if (!session?.waveActive || session.outcome) return [];
  const pulses = observation?.defenses?.dematerializationPulses
    || session.dematerializationPulses
    || [];
  const lanes = observation?.lanes || [];

  return pulses
    .filter((pulse) => pulse.state === "ready")
    .map((pulse) => {
      const lane = lanes.find((entry) => entry.row === pulse.row);
      const projection = projectDematerializationPulseLane(session, lane);
      return evaluateDematerializationPulseLane(lane, pulse, profile, projection);
    })
    .filter((evaluation) => evaluation?.shouldActivate)
    .sort((left, right) => right.priority - left.priority || right.potentialDamage - left.potentialDamage)
    .slice(0, 1)
    .map((evaluation) => ({
      type: "activateDematerializationPulse",
      row: evaluation.row,
      priority: evaluation.priority,
      reason: evaluation.reason,
      pulseEvaluation: evaluation,
    }));
}
