function laneReadiness(
  lane,
) {
  if (
    lane.forecastThreat <= 0
    && lane.activeThreat <= 0
  ) {
    return lane.troopCount > 0
      ? 1
      : .75;
  }

  let score = Math.min(
    1,
    lane.coverage,
  );

  if (lane.hasFrontline) score += .12;
  if (lane.hasOffense) score += .12;
  if (lane.hasSupport) score += .04;
  if (
    lane.airThreat
    && !lane.hasAntiAir
  ) {
    score -= .28;
  }

  return Math.max(
    0,
    Math.min(1, score),
  );
}

export function calculateWaveReadiness(
  observation,
  profile,
  preparationElapsedMs,
) {
  const readinessValues = (
    observation.lanes.map(
      laneReadiness,
    )
  );

  const averageCoverage = (
    readinessValues.reduce(
      (total, value) => total + value,
      0,
    )
    / Math.max(1, readinessValues.length)
  );

  const coveredLanes = (
    readinessValues.filter(
      (value) => (
        value >= profile.minimumCoverageRatio
      ),
    ).length
  );

  const coverageRatio = (
    coveredLanes
    / Math.max(1, readinessValues.length)
  );

  const reserveRatio = (
    observation.resources.energyMax > 0
      ? observation.resources.energy
        / observation.resources.energyMax
      : 0
  );

  const cooldownReadiness = (
    Object.values(
      observation.snapshot.cooldowns
      || {},
    ).every(
      (value) => Number(value) <= 0,
    )
      ? 1
      : .72
  );

  const integrityReadiness = (
    observation.base.integrityPercent
    / 100
  );

  let readiness = (
    averageCoverage * .42
    + coverageRatio * .25
    + reserveRatio * .1
    + cooldownReadiness * .08
    + integrityReadiness * .15
  );

  const timePressure = (
    observation.phase.timePressure
    * profile.timePressureWeight
  );

  readiness += Math.min(
    .22,
    timePressure * .12,
  );

  if (
    preparationElapsedMs
    >= 18_000
  ) {
    readiness = Math.max(
      readiness,
      profile.startReadinessThreshold,
    );
  }

  return {
    readiness,
    averageCoverage,
    coverageRatio,
    threshold:
      profile.startReadinessThreshold,
    shouldStart: (
      readiness
      >= profile.startReadinessThreshold
    ),
  };
}
