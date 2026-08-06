import {
  TROOPS,
} from "../../content.js";
import {
  validatePositionalTarget,
} from "../../battleModel.js";

const OFFENSIVE_IDS = new Set([
  "armor_piercing",
  "accelerated_training",
  "first_impact",
  "targeting_systems",
  "aggressive_line",
  "focused_fire",
  "continuous_suppression",
  "ballistic_specialization",
  "explosive_specialization",
  "energy_specialization",
  "concussive_impact",
  "precision_doctrine",
  "final_overload",
  "early_assault",
]);

const DEFENSIVE_IDS = new Set([
  "repair_core",
  "emergency_shield",
  "structural_armor",
  "containment_protocol",
  "last_line",
  "field_maintenance",
  "reactive_barrier",
  "route_fortification",
  "organized_retreat",
  "frontline_doctrine",
  "territorial_control",
  "final_fortress",
  "core_barrier",
]);

const ECONOMIC_IDS = new Set([
  "emergency_energy",
  "supply_expansion",
  "fast_deployment",
  "strategic_reserve",
  "efficient_batteries",
  "recycling",
  "early_preparation",
  "emergency_contract",
  "overcharged_reactor",
  "supply_reserve",
  "total_mobilization",
  "final_reserve",
  "emergency_deployment",
]);

function optionId(option) {
  return String(option?.id || "");
}

function scoreOption(
  option,
  observation,
  profile,
) {
  const id = optionId(option);
  let score = 10;

  if (OFFENSIVE_IDS.has(id)) {
    score += (
      profile.offenseWeight * 18
      + observation.phase.timePressure
        * profile.timePressureWeight
        * 12
    );
  }

  if (DEFENSIVE_IDS.has(id)) {
    score += (
      profile.defenseWeight * 18
      + (
        100
        - observation.base.integrityPercent
      ) * .42
    );
  }

  if (ECONOMIC_IDS.has(id)) {
    score += (
      profile.economyWeight * 16
      + (
        1 - observation.phase.phaseProgress
      ) * 10
    );
  }

  if (option.category === "specialization") {
    score += 14;
  }

  if (
    id === "repair_core"
    || id === "structural_armor"
  ) {
    score += (
      100
      - observation.base.integrityPercent
    ) * .8;
  }

  if (
    id === "field_maintenance"
  ) {
    score += (
      observation.troops.critical.length
      * 12
    );
  }

  if (
    id === "emergency_energy"
    || id === "strategic_reserve"
  ) {
    score += (
      1 - observation.resources.energyRatio
    ) * 28;
  }

  if (
    id === "supply_expansion"
    || id === "supply_reserve"
  ) {
    score += (
      1 - observation.resources.supplyRatio
    ) * 22;
  }

  if (
    id === "focused_fire"
    || id === "route_fortification"
  ) {
    score += (
      observation.mostThreatenedLane?.risk
      || 0
    );
  }

  if (
    id === "early_assault"
    && observation.phase.timePressure > .75
  ) {
    score += 22;
  }

  if (
    id === "overcharged_reactor"
    && !observation.troops.living.some(
      (troop) => (
        TROOPS[troop.type]?.attack
        === "energy"
      ),
    )
  ) {
    score -= 60;
  }

  return score;
}

function positionalCandidates(
  option,
  observation,
) {
  const id = optionId(option);

  if (
    id === "focused_fire"
    || id === "route_fortification"
  ) {
    return [...observation.lanes]
      .sort(
        (left, right) => (
          right.risk - left.risk
        ),
      )
      .map((lane) => ({
        row: lane.row,
      }));
  }

  if (id === "advanced_formation") {
    const occupiedByColumn = new Map();

    observation.troops.living.forEach(
      (troop) => {
        occupiedByColumn.set(
          troop.col,
          (
            occupiedByColumn.get(troop.col)
            || 0
          ) + 1,
        );
      },
    );

    const columns = [
      [1, 2, 3],
      [2, 3, 4],
      [3, 4, 5],
      [4, 5, 6],
    ];

    return columns.sort(
      (left, right) => {
        const leftScore = left.reduce(
          (total, column) => (
            total
            + (
              occupiedByColumn.get(column)
              || 0
            )
          ),
          0,
        );

        const rightScore = right.reduce(
          (total, column) => (
            total
            + (
              occupiedByColumn.get(column)
              || 0
            )
          ),
          0,
        );

        return rightScore - leftScore;
      },
    ).map((entry) => ({
      columns: entry,
    }));
  }

  return [
    ...observation.lanes.map(
      (lane) => ({
        row: lane.row,
      }),
    ),
    ...observation.lanes.flatMap(
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

export function planDecision(
  session,
  observation,
  profile,
) {
  const options = Array.isArray(
    session.pendingDecision,
  )
    ? session.pendingDecision
    : [];

  const ranked = options
    .map((option) => ({
      option,
      score: scoreOption(
        option,
        observation,
        profile,
      ),
    }))
    .sort(
      (left, right) => (
        right.score - left.score
        || optionId(left.option)
          .localeCompare(
            optionId(right.option),
          )
      ),
    );

  for (const entry of ranked) {
    if (!entry.option.positional) {
      return {
        option: entry.option,
        target: null,
        score: entry.score,
      };
    }

    const candidates = (
      positionalCandidates(
        entry.option,
        observation,
      )
    );

    for (const target of candidates) {
      const validation = (
        validatePositionalTarget(
          session,
          entry.option,
          target,
        )
      );

      if (validation?.valid) {
        return {
          option: entry.option,
          target:
            validation.target || target,
          score: entry.score,
        };
      }
    }
  }

  return null;
}
