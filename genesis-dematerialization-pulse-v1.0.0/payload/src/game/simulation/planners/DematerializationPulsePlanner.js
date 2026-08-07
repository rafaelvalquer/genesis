import {
  DEMATERIALIZATION_PULSE,
  calculateDematerializationPulseCollapseScore,
  estimateDematerializationPulseValue,
} from "../../dematerializationPulse.js";

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

export function evaluateDematerializationPulseLane(lane, pulse, profile = {}) {
  if (!lane || !pulse || pulse.state !== "ready") return null;
  const value = estimateDematerializationPulseValue(lane.enemies, DEMATERIALIZATION_PULSE.damage);
  if (!value.enemyCount) return null;

  const policy = pulsePolicy(profile);
  const collapseScore = calculateDematerializationPulseCollapseScore(lane);
  const timeToBaseMs = Number(lane.lowestTimeToBaseMs);
  const emergency = Number.isFinite(timeToBaseMs) && timeToBaseMs <= policy.pulseEmergencyTimeMs;
  const routeCollapse = collapseScore >= policy.pulseRiskThreshold;
  const frontlineCritical = Number(lane.criticalTroops || 0) > 0 && Number(lane.risk || 0) >= policy.pulseRiskThreshold * 0.65;
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
      return evaluateDematerializationPulseLane(lane, pulse, profile);
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
