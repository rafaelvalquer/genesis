import {
  TROOPS,
} from "../../content.js";
import {
  canPlaceTroop,
  getEffectiveTroopStats,
} from "../../battleModel.js";
import {
  getTroopTags,
} from "./troopTaxonomy.js";

function cellOccupied(
  session,
  row,
  col,
) {
  return session.troops.some(
    (troop) => (
      !troop.dead
      && troop.row === row
      && troop.col === col
    ),
  );
}

function replacementScore(
  loss,
  observation,
  profile,
) {
  const config = TROOPS[loss.troopType];
  const tags = getTroopTags(config);
  const lane = observation.lanes[loss.row];

  let score = 90 + Number(lane?.risk || 0) * 3;

  if (tags.has("frontline")) {
    score += profile.defenseWeight * 24;
  }

  if (
    tags.has("offense")
    || tags.has("area")
  ) {
    score += profile.offenseWeight * 20;
  }

  if (tags.has("support")) {
    score += profile.supportWeight * 16;
  }

  if (
    tags.has("antiAir")
    && lane?.airThreat
  ) {
    score += 32;
  }

  if (
    tags.has("economy")
    && observation.phase.phaseProgress
      > profile.economyUntilWaveRatio
  ) {
    score -= 35;
  }

  const ageMs = (
    observation.phase.elapsedMs
    - Number(loss.at || 0)
  );

  score += Math.max(
    0,
    20 - ageMs / 1000,
  );

  return score;
}

export function planReplacementActions(
  session,
  observation,
  profile,
  maximumActions = 2,
) {
  const losses = [
    ...(session.recentTroopLosses || []),
  ].filter((loss) => (
    loss.cause === "enemy"
    && session.loadout.includes(
      loss.troopType,
    )
    && TROOPS[loss.troopType]
    && Number.isInteger(loss.row)
    && Number.isInteger(loss.col)
    && !cellOccupied(
      session,
      loss.row,
      loss.col,
    )
  )).sort(
    (left, right) => (
      Number(right.at || 0)
      - Number(left.at || 0)
    ),
  );

  const candidates = [];
  const seen = new Set();

  for (const loss of losses) {
    const cellKey = (
      `${loss.troopType}:${loss.row}:${loss.col}`
    );

    if (seen.has(cellKey)) continue;
    seen.add(cellKey);

    const effective = getEffectiveTroopStats(
      session,
      loss.troopType,
    );

    if (
      !effective
      || observation.resources.energy
        < effective.price
      || observation.resources.supply
        < effective.supply
    ) {
      continue;
    }

    const reason = canPlaceTroop(
      session,
      loss.troopType,
      loss.row,
      loss.col,
    );

    if (reason) continue;

    candidates.push({
      type: "place",
      troopId: loss.troopType,
      row: loss.row,
      col: loss.col,
      score: replacementScore(
        loss,
        observation,
        profile,
      ),
      priority: replacementScore(
        loss,
        observation,
        profile,
      ),
      reason: "replacement",
      lostTroopId: loss.troopId,
      lostAt: loss.at,
      price: effective.price,
      supply: effective.supply,
    });
  }

  return candidates
    .sort(
      (left, right) => (
        right.score - left.score
        || Number(right.lostAt)
          - Number(left.lostAt)
      ),
    )
    .slice(0, maximumActions);
}
