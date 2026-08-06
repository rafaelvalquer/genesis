const BASE_PROFILE = Object.freeze({
  id: "balanced",
  economyTarget: 2,
  economyUntilWaveRatio: 0.58,
  energyReserveBase: 12,
  energyReserveThreatScale: 0.075,
  emergencyReserveMultiplier: 1.45,
  frontlineRiskThreshold: 8,
  reinforcementRiskThreshold: 13,
  replacementHpThreshold: 0.32,
  specialRiskThreshold: 15,
  startReadinessThreshold: 0.72,
  minimumCoverageRatio: 0.5,
  timePressureWeight: 0.7,
  integrityWeight: 1,
  offenseWeight: 1,
  defenseWeight: 1,
  supportWeight: 0.8,
  economyWeight: 0.72,
  antiAirWeight: 1.25,
  areaDamageWeight: 1,
  controlWeight: 0.9,
  bossWeight: 1.35,
  removeLowValueTroops: false,
});

export const STRATEGY_PROFILES = Object.freeze({
  balanced: Object.freeze({
    ...BASE_PROFILE,
    id: "balanced",
  }),

  defensive: Object.freeze({
    ...BASE_PROFILE,
    id: "defensive",
    economyTarget: 1,
    energyReserveBase: 18,
    energyReserveThreatScale: 0.11,
    emergencyReserveMultiplier: 1.75,
    frontlineRiskThreshold: 5,
    reinforcementRiskThreshold: 9,
    replacementHpThreshold: 0.45,
    specialRiskThreshold: 11,
    startReadinessThreshold: 0.84,
    minimumCoverageRatio: 0.66,
    timePressureWeight: 0.35,
    integrityWeight: 1.45,
    offenseWeight: 0.8,
    defenseWeight: 1.45,
    supportWeight: 1.2,
    economyWeight: 0.5,
    controlWeight: 1.15,
  }),

  economic: Object.freeze({
    ...BASE_PROFILE,
    id: "economic",
    economyTarget: 3,
    economyUntilWaveRatio: 0.72,
    energyReserveBase: 10,
    energyReserveThreatScale: 0.06,
    frontlineRiskThreshold: 10,
    reinforcementRiskThreshold: 16,
    replacementHpThreshold: 0.28,
    specialRiskThreshold: 18,
    startReadinessThreshold: 0.7,
    minimumCoverageRatio: 0.45,
    timePressureWeight: 0.55,
    integrityWeight: 0.85,
    offenseWeight: 0.9,
    defenseWeight: 0.82,
    supportWeight: 0.72,
    economyWeight: 1.55,
  }),

  aggressive: Object.freeze({
    ...BASE_PROFILE,
    id: "aggressive",
    economyTarget: 1,
    economyUntilWaveRatio: 0.35,
    energyReserveBase: 7,
    energyReserveThreatScale: 0.04,
    emergencyReserveMultiplier: 1.2,
    frontlineRiskThreshold: 11,
    reinforcementRiskThreshold: 17,
    replacementHpThreshold: 0.22,
    specialRiskThreshold: 9,
    startReadinessThreshold: 0.55,
    minimumCoverageRatio: 0.38,
    timePressureWeight: 1.4,
    integrityWeight: 0.65,
    offenseWeight: 1.45,
    defenseWeight: 0.7,
    supportWeight: 0.55,
    economyWeight: 0.4,
    areaDamageWeight: 1.2,
    bossWeight: 1.5,
  }),
});

export function resolveStrategyProfile(
  strategy = "balanced",
  overrides = {},
) {
  const base = (
    typeof strategy === "string"
      ? STRATEGY_PROFILES[strategy]
      : strategy
  ) || STRATEGY_PROFILES.balanced;

  return {
    ...base,
    ...overrides,
    id: (
      overrides.id
      || base.id
      || "custom"
    ),
  };
}

export function createPolicyGenome(
  profile,
) {
  return {
    economyTarget: profile.economyTarget,
    energyReserveBase: profile.energyReserveBase,
    energyReserveThreatScale:
      profile.energyReserveThreatScale,
    emergencyReserveMultiplier:
      profile.emergencyReserveMultiplier,
    frontlineRiskThreshold:
      profile.frontlineRiskThreshold,
    reinforcementRiskThreshold:
      profile.reinforcementRiskThreshold,
    replacementHpThreshold:
      profile.replacementHpThreshold,
    specialRiskThreshold:
      profile.specialRiskThreshold,
    startReadinessThreshold:
      profile.startReadinessThreshold,
    minimumCoverageRatio:
      profile.minimumCoverageRatio,
    timePressureWeight:
      profile.timePressureWeight,
    integrityWeight:
      profile.integrityWeight,
    offenseWeight:
      profile.offenseWeight,
    defenseWeight:
      profile.defenseWeight,
    supportWeight:
      profile.supportWeight,
    economyWeight:
      profile.economyWeight,
  };
}
