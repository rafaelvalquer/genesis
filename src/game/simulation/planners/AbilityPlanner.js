import {
  TROOPS,
} from "../../content.js";

function specialReady(
  session,
  troop,
) {
  const config = TROOPS[troop.type];

  return Boolean(
    config?.specialEveryMs
    && !troop.dead
    && !troop.specialRequested
    && session.elapsed
      >= Number(
        troop.specialReadyAt
        || Infinity,
      )
  );
}

export function planSpecialActions(
  session,
  observation,
  profile,
) {
  const actions = [];

  for (const troop of observation.troops.living) {
    if (!specialReady(session, troop)) {
      continue;
    }

    const lane = observation.lanes[
      troop.row
    ];

    const bossActive = (
      lane?.bossThreat
      || observation.enemies
        .activeBosses.length > 0
    );

    const risk = Number(
      lane?.risk || 0,
    );

    if (
      bossActive
      || risk
        >= profile.specialRiskThreshold
      || observation.base.critical
    ) {
      actions.push({
        type: "activateSpecial",
        troopId: troop.id,
        reason: bossActive
          ? "boss"
          : observation.base.critical
            ? "criticalBase"
            : "laneRisk",
        priority: (
          bossActive
            ? 120
            : 70 + risk
        ),
      });
    }
  }

  return actions.sort(
    (left, right) => (
      right.priority - left.priority
    ),
  );
}
