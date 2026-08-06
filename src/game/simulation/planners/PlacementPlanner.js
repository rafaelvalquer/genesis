import {
  TROOPS,
} from "../../content.js";
import {
  FIELD,
  canPlaceTroop,
  getEffectiveTroopStats,
} from "../../battleModel.js";
import {
  getTroopTags,
} from "./troopTaxonomy.js";

function unique(
  values,
) {
  return [...new Set(values)];
}

function preferredColumns(
  tags,
) {
  const first = FIELD.firstTroopCol;
  const last = FIELD.lastTroopCol;

  if (tags.has("economy")) {
    return unique([
      first,
      first + 1,
      first + 2,
    ]).filter(
      (value) => value <= last,
    );
  }

  if (
    tags.has("frontline")
    || tags.has("trap")
  ) {
    return unique([
      last,
      last - 1,
      last - 2,
    ]).filter(
      (value) => value >= first,
    );
  }

  if (tags.has("support")) {
    return unique([
      first + 1,
      first + 2,
      first,
      first + 3,
    ]).filter(
      (value) => (
        value >= first
        && value <= last
      ),
    );
  }

  if (tags.has("ranged")) {
    return unique([
      first + 1,
      first + 2,
      first + 3,
      first,
    ]).filter(
      (value) => (
        value >= first
        && value <= last
      ),
    );
  }

  return unique([
    first + 2,
    first + 3,
    first + 1,
    last - 1,
    first,
  ]).filter(
    (value) => (
      value >= first
      && value <= last
    ),
  );
}

function laneRoleNeed(
  lane,
  tags,
  observation,
) {
  let score = lane.risk * 2;

  if (
    tags.has("frontline")
    && !lane.hasFrontline
  ) {
    score += 34;
  }

  if (
    (
      tags.has("offense")
      || tags.has("area")
    )
    && !lane.hasOffense
  ) {
    score += 29;
  }

  if (
    tags.has("support")
    && lane.troopCount >= 2
    && !lane.hasSupport
  ) {
    score += 20;
  }

  if (
    tags.has("antiAir")
    && lane.airThreat
    && !lane.hasAntiAir
  ) {
    score += 42;
  }

  if (
    tags.has("control")
    && lane.risk >= 10
  ) {
    score += 16;
  }

  if (
    tags.has("area")
    && lane.enemyCount >= 3
  ) {
    score += 20;
  }

  if (
    tags.has("economy")
    && (
      lane.enemyCount > 0
      || lane.risk > 8
    )
  ) {
    score -= 22;
  }

  if (
    observation.environment.hazardId
      === "wind_current"
    && !tags.has("windResistant")
  ) {
    score -= 4;
  }

  return score;
}

function countTag(
  observation,
  tag,
) {
  return observation.troops.living
    .filter((troop) => (
      getTroopTags(
        TROOPS[troop.type],
      ).has(tag)
    ))
    .length;
}

export function calculateEnergyReserve(
  observation,
  profile,
) {
  const threat = (
    observation.mostThreatenedLane?.risk
    || 0
  );

  const replacementCosts = (
    observation.troops.critical
      .map((troop) => (
        Number(
          observation.resources
            .deploymentStats[
              troop.type
            ]?.price
          || TROOPS[troop.type]?.price
          || 0,
        )
      ))
  );

  const criticalReplacement = Math.max(
    0,
    ...replacementCosts,
  );

  const reserve = (
    profile.energyReserveBase
    + threat
      * profile.energyReserveThreatScale
      * 10
    + criticalReplacement
      * (
        threat >= profile
          .reinforcementRiskThreshold
          ? profile
            .emergencyReserveMultiplier
          : .45
      )
  );

  return Math.max(
    0,
    Math.min(
      observation.resources.energyMax,
      reserve,
    ),
  );
}

function troopStrategicScore(
  troopId,
  observation,
  profile,
) {
  const config = TROOPS[troopId];
  const tags = getTroopTags(config);
  const stats = (
    observation.resources
      .deploymentStats[troopId]
  );

  if (!config || !stats) {
    return -Infinity;
  }

  if (
    stats.activeCount
    >= Number(
      stats.maxDeployed
      || Infinity,
    )
  ) {
    return -Infinity;
  }

  let score = 0;

  if (tags.has("economy")) {
    const economyCount = countTag(
      observation,
      "economy",
    );

    const economyStillUseful = (
      observation.phase.phaseProgress
      <= profile.economyUntilWaveRatio
    );

    if (
      economyCount
      < profile.economyTarget
      && economyStillUseful
    ) {
      score += (
        42
        + profile.economyWeight * 18
      );
    } else {
      score -= 40;
    }
  }

  if (tags.has("frontline")) {
    score += profile.defenseWeight * 18;
  }

  if (
    tags.has("offense")
    || tags.has("area")
  ) {
    score += profile.offenseWeight * 18;
  }

  if (tags.has("support")) {
    score += profile.supportWeight * 13;
  }

  if (
    tags.has("antiAir")
    && observation.lanes.some(
      (lane) => lane.airThreat,
    )
  ) {
    score += 34;
  }

  if (
    tags.has("area")
    && observation.enemies.count >= 4
  ) {
    score += 18;
  }

  if (
    tags.has("control")
    && (
      observation.mostThreatenedLane?.risk
      || 0
    ) >= 10
  ) {
    score += 15;
  }

  const price = Math.max(
    1,
    Number(stats.price) || 1,
  );

  score -= price * .28;
  score -= (
    Number(stats.supply) || 0
  ) * .45;

  return score;
}

function candidateCells(
  troopId,
  observation,
) {
  const tags = getTroopTags(
    TROOPS[troopId],
  );

  const lanes = [
    ...observation.lanes,
  ].sort(
    (left, right) => (
      laneRoleNeed(
        right,
        tags,
        observation,
      )
      - laneRoleNeed(
        left,
        tags,
        observation,
      )
      || left.row - right.row
    ),
  );

  const columns = preferredColumns(tags);

  return lanes.flatMap(
    (lane) => (
      columns.map((col) => ({
        row: lane.row,
        col,
        lane,
      }))
    ),
  );
}

function placementScore(
  troopId,
  candidate,
  observation,
  profile,
) {
  const config = TROOPS[troopId];
  const tags = getTroopTags(config);

  let score = troopStrategicScore(
    troopId,
    observation,
    profile,
  );

  score += laneRoleNeed(
    candidate.lane,
    tags,
    observation,
  );

  if (
    tags.has("support")
    && candidate.col
      < FIELD.lastTroopCol
  ) {
    score += 7;
  }

  if (
    tags.has("frontline")
    && candidate.col
      >= FIELD.lastTroopCol - 1
  ) {
    score += 10;
  }

  if (
    tags.has("economy")
    && candidate.col
      <= FIELD.firstTroopCol + 1
  ) {
    score += 10;
  }

  if (
    tags.has("ranged")
    && candidate.col
      <= FIELD.firstTroopCol + 3
  ) {
    score += 8;
  }

  const adjacentAllies = (
    observation.troops.living
      .filter((troop) => (
        troop.row === candidate.row
        && Math.abs(
          troop.col - candidate.col
        ) <= 1
      ))
      .length
  );

  if (
    tags.has("support")
    || tags.has("frontline")
  ) {
    score += adjacentAllies * 2;
  }

  return score;
}

export function planPlacementActions(
  session,
  observation,
  profile,
  maximumActions = 3,
) {
  const reserve = calculateEnergyReserve(
    observation,
    profile,
  );

  const availableEnergy = (
    observation.resources.energy
    - reserve
  );

  const emergency = (
    observation.mostThreatenedLane?.risk
    >= profile.reinforcementRiskThreshold
    || observation.base.critical
  );

  const actions = [];

  for (const troopId of session.loadout) {
    const effective = (
      getEffectiveTroopStats(
        session,
        troopId,
      )
    );

    if (!effective) continue;

    const canAfford = emergency
      ? (
        observation.resources.energy
        >= effective.price
      )
      : (
        availableEnergy >= effective.price
      );

    if (
      !canAfford
      || observation.resources.supply
        < effective.supply
    ) {
      continue;
    }

    const candidates = candidateCells(
      troopId,
      observation,
    );

    for (const candidate of candidates) {
      const reason = canPlaceTroop(
        session,
        troopId,
        candidate.row,
        candidate.col,
      );

      if (reason) continue;

      actions.push({
        type: "place",
        troopId,
        row: candidate.row,
        col: candidate.col,
        score: placementScore(
          troopId,
          candidate,
          observation,
          profile,
        ),
        reason: (
          emergency
            ? "emergency"
            : "strategic"
        ),
        price: effective.price,
        supply: effective.supply,
      });
    }
  }

  actions.sort(
    (left, right) => (
      right.score - left.score
      || left.price - right.price
      || left.troopId.localeCompare(
        right.troopId,
      )
      || left.row - right.row
      || left.col - right.col
    ),
  );

  const selected = [];
  const occupied = new Set();

  for (const action of actions) {
    if (
      selected.length >= maximumActions
    ) {
      break;
    }

    const key = `${action.row}:${action.col}`;

    if (occupied.has(key)) {
      continue;
    }

    selected.push(action);
    occupied.add(key);
  }

  return {
    actions: selected,
    reserve,
    emergency,
  };
}
