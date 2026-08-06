import {
  ENEMIES,
  TROOPS,
} from "../../content.js";
import {
  enemyThreat,
} from "../../domain.js";
import {
  FIELD,
} from "../../battleModel.js";
import {
  estimateTroopDps,
  getTroopTags,
} from "../planners/troopTaxonomy.js";

function clamp(
  value,
  minimum,
  maximum,
) {
  return Math.max(
    minimum,
    Math.min(maximum, value),
  );
}

function enemySpecialFactor(
  enemy,
  config,
) {
  let factor = 1;

  if (enemy.variant === "alpha") {
    factor *= 2.4;
  }

  if (config?.boss) {
    factor *= 3;
  }

  if (config?.airborne) {
    factor *= 1.2;
  }

  if (
    config?.summonCount
    || config?.maximumLivingSummons
    || config?.hatchAfterMs
  ) {
    factor *= 1.22;
  }

  if (
    Number(enemy.shield || enemy.shieldMax) > 0
  ) {
    factor *= 1.15;
  }

  if (
    enemy.casting
    || enemy.jumping
    || enemy.sprintUntil > 0
  ) {
    factor *= 1.1;
  }

  return factor;
}

function activeEnemyThreat(
  enemy,
) {
  const config = ENEMIES[enemy.type] || {};

  const fieldSpan = Math.max(
    1,
    FIELD.width - FIELD.baseX,
  );

  const distanceToBase = Math.max(
    0,
    Number(enemy.x) - FIELD.baseX,
  );

  const proximity = (
    1
    + (
      1 - clamp(
        distanceToBase / fieldSpan,
        0,
        1,
      )
    ) * 2.5
  );

  const hpRatio = (
    Number(enemy.maxHp) > 0
      ? clamp(
        Number(enemy.hp) / Number(enemy.maxHp),
        0,
        1,
      )
      : 1
  );

  const effectiveThreat = enemyThreat({
    type: enemy.type,
    variant: enemy.variant,
  });

  return {
    threat: (
      effectiveThreat
      * proximity
      * enemySpecialFactor(
        enemy,
        config,
      )
      * (.45 + hpRatio * .55)
    ),
    distanceToBase,
    timeToBaseMs: (
      Number(enemy.speed) > 0
        ? distanceToBase
          / Number(enemy.speed)
          * 1000
        : Infinity
    ),
  };
}

function troopContribution(
  troop,
) {
  const config = TROOPS[troop.type] || {};
  const tags = getTroopTags(config);
  const hpRatio = (
    Number(troop.maxHp) > 0
      ? clamp(
        Number(troop.hp)
          / Number(troop.maxHp),
        0,
        1,
      )
      : 1
  );

  const dps = (
    estimateTroopDps(config)
    * hpRatio
  );

  const frontline = tags.has("frontline")
    ? (
      Number(troop.hp)
      + Number(troop.maxHp) * .35
    )
    : 0;

  const support = tags.has("support")
    ? (
      12
      + Number(config.healAmount || 0)
    )
    : 0;

  const control = tags.has("control")
    ? 9
    : 0;

  return {
    dps,
    frontline,
    support,
    control,
    tags,
    hpRatio,
  };
}

export function createLaneThreatMap(
  session,
  waveForecast = null,
) {
  const lanes = Array.from(
    { length: FIELD.rows },
    (_, row) => ({
      row,
      enemies: [],
      troops: [],
      activeThreat: 0,
      forecastThreat: Number(
        waveForecast?.laneThreat?.[row]
        || 0,
      ),
      defensePower: 0,
      frontlineHp: 0,
      supportPower: 0,
      controlPower: 0,
      enemyCount: 0,
      troopCount: 0,
      lowestTimeToBaseMs: Infinity,
      risk: 0,
      coverage: 0,
      hasFrontline: false,
      hasOffense: false,
      hasSupport: false,
      hasAntiAir: false,
      airThreat: false,
      bossThreat: false,
      criticalTroops: 0,
    }),
  );

  session.enemies
    .filter((enemy) => (
      !enemy.dead
      && Number(enemy.hp) > 0
    ))
    .forEach((enemy) => {
      const rows = (
        enemy.type === "leviathanNereida"
        && enemy.leviathanTargetableRows?.length
          ? enemy.leviathanTargetableRows
          : [enemy.row]
      );

      rows.forEach((row) => {
        const lane = lanes[row];

        if (!lane) return;

        const contribution = (
          activeEnemyThreat(enemy)
        );

        lane.enemies.push(enemy);
        lane.enemyCount += 1;
        lane.activeThreat += contribution.threat;
        lane.lowestTimeToBaseMs = Math.min(
          lane.lowestTimeToBaseMs,
          contribution.timeToBaseMs,
        );

        const config = ENEMIES[enemy.type];

        lane.airThreat ||= Boolean(
          config?.airborne,
        );

        lane.bossThreat ||= Boolean(
          config?.boss
          || enemy.variant === "alpha",
        );
      });
    });

  session.troops
    .filter((troop) => (
      !troop.dead
      && Number(troop.hp) > 0
    ))
    .forEach((troop) => {
      const lane = lanes[troop.row];

      if (!lane) return;

      const contribution = (
        troopContribution(troop)
      );

      lane.troops.push(troop);
      lane.troopCount += 1;
      lane.defensePower += (
        contribution.dps
        + contribution.frontline * .09
        + contribution.support
        + contribution.control
      );

      lane.frontlineHp += (
        contribution.frontline
      );

      lane.supportPower += (
        contribution.support
      );

      lane.controlPower += (
        contribution.control
      );

      lane.hasFrontline ||= (
        contribution.tags.has("frontline")
      );

      lane.hasOffense ||= (
        contribution.tags.has("offense")
        || contribution.tags.has("area")
      );

      lane.hasSupport ||= (
        contribution.tags.has("support")
      );

      lane.hasAntiAir ||= (
        contribution.tags.has("antiAir")
      );

      if (contribution.hpRatio < .35) {
        lane.criticalTroops += 1;
      }
    });

  lanes.forEach((lane) => {
    const forecastWeight = (
      session.waveActive
        ? .22
        : .72
    );

    const totalThreat = (
      lane.activeThreat
      + lane.forecastThreat
        * forecastWeight
    );

    const missingCounterPenalty = (
      lane.airThreat
      && !lane.hasAntiAir
        ? 12
        : 0
    );

    const missingFrontlinePenalty = (
      totalThreat > 5
      && !lane.hasFrontline
        ? 10
        : 0
    );

    const missingOffensePenalty = (
      totalThreat > 3
      && !lane.hasOffense
        ? 7
        : 0
    );

    const timePressure = Number.isFinite(
      lane.lowestTimeToBaseMs,
    )
      ? Math.max(
        0,
        12 - lane.lowestTimeToBaseMs / 1000,
      )
      : 0;

    lane.risk = Math.max(
      0,
      totalThreat
      - lane.defensePower * .33
      + missingCounterPenalty
      + missingFrontlinePenalty
      + missingOffensePenalty
      + timePressure,
    );

    lane.coverage = totalThreat > 0
      ? clamp(
        lane.defensePower
          / Math.max(1, totalThreat),
        0,
        1.5,
      )
      : lane.troopCount > 0
        ? 1
        : 0;
  });

  return lanes.sort(
    (left, right) => left.row - right.row,
  );
}

export function getMostThreatenedLane(
  lanes,
) {
  return [...lanes].sort(
    (left, right) => (
      right.risk - left.risk
      || left.lowestTimeToBaseMs
        - right.lowestTimeToBaseMs
      || left.row - right.row
    ),
  )[0] || null;
}
