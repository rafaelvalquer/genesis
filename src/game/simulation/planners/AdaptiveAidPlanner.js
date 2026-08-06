const AID_PRIORITY = Object.freeze({
  repair: 100,
  restore: 95,
  revive: 92,
  shield: 88,
  stun: 82,
  energy: 74,
  supply: 70,
  damage: 62,
  fortune: 55,
});

function scoreAidOption(
  option,
  observation,
) {
  const id = String(
    option?.id || "",
  ).toLowerCase();

  let score = 30;

  Object.entries(AID_PRIORITY)
    .forEach(([fragment, value]) => {
      if (id.includes(fragment)) {
        score = Math.max(
          score,
          value,
        );
      }
    });

  score += (
    100
    - observation.base.integrityPercent
  ) * .6;

  score += observation.troops.critical.length * 8;
  score += (
    1 - observation.resources.energyRatio
  ) * 12;

  return score;
}

function aidTargets(
  observation,
) {
  const threatenedRows = [
    ...observation.lanes,
  ].sort(
    (left, right) => (
      right.risk - left.risk
    ),
  );

  return [
    ...threatenedRows.map(
      (lane) => ({
        row: lane.row,
      }),
    ),
    ...observation.troops.critical.map(
      (troop) => ({
        troopId: troop.id,
        row: troop.row,
        col: troop.col,
      }),
    ),
    ...threatenedRows.flatMap(
      (lane) => (
        [1, 2, 3, 4, 5, 6]
          .map((col) => ({
            row: lane.row,
            col,
          }))
      ),
    ),
  ];
}

export function rankAdaptiveAidOptions(
  observation,
) {
  return [
    ...observation.adaptiveAid
      .availableOptions,
  ].map((option) => ({
    option,
    score: scoreAidOption(
      option,
      observation,
    ),
  })).sort(
    (left, right) => (
      right.score - left.score
    ),
  );
}

export function getAdaptiveAidTargets(
  observation,
) {
  return aidTargets(observation);
}
