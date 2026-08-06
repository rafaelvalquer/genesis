function safeNumber(
  value,
  fallback = 0,
) {
  return Number.isFinite(Number(value))
    ? Number(value)
    : fallback;
}

export function scoreSimulationResult(
  result,
) {
  if (
    result.invalidState
    || result.deadlock
    || result.timeout
  ) {
    return -1_000_000_000;
  }

  const victory = (
    result.outcome === "victory"
  );

  const stars = safeNumber(
    result.stars,
  );

  const integrity = safeNumber(
    result.integrity,
  );

  const durationMs = safeNumber(
    result.durationMs,
    30 * 60 * 1000,
  );

  const losses = safeNumber(
    result.troopDeaths,
  );

  const assistancePenalty = (
    result.assistanceUsed
      ? 25_000
      : 0
  );

  return (
    (victory ? 1_000_000 : 0)
    + stars * 100_000
    + integrity * 1_000
    - durationMs * .08
    - losses * 250
    - assistancePenalty
  );
}

export function aggregateCandidateScore(
  results,
) {
  const valid = results.filter(
    (result) => (
      !result.invalidState
      && !result.deadlock
      && !result.timeout
    ),
  );

  const victories = valid.filter(
    (result) => (
      result.outcome === "victory"
    ),
  );

  const average = (
    values,
  ) => (
    values.length
      ? values.reduce(
        (total, value) => total + value,
        0,
      ) / values.length
      : 0
  );

  const victoryRate = (
    results.length
      ? victories.length / results.length
      : 0
  );

  const averageScore = average(
    results.map(scoreSimulationResult),
  );

  const averageStars = average(
    victories.map(
      (result) => safeNumber(result.stars),
    ),
  );

  const averageIntegrity = average(
    victories.map(
      (result) => safeNumber(
        result.integrity,
      ),
    ),
  );

  const averageDurationMs = average(
    victories.map(
      (result) => safeNumber(
        result.durationMs,
      ),
    ),
  );

  return {
    score: (
      victoryRate * 10_000_000
      + averageScore
    ),
    victoryRate,
    averageStars,
    averageIntegrity,
    averageDurationMs,
    failures:
      results.length - valid.length,
  };
}
