import {
  createRng,
} from "../../domain.js";
import {
  generateLoadoutCandidates,
} from "../planners/LoadoutPlanner.js";
import {
  runBattleSimulation,
} from "../engine/runSimulation.js";
import {
  createPolicyGenome,
  resolveStrategyProfile,
} from "../strategies/strategyProfiles.js";
import {
  aggregateCandidateScore,
} from "./simulationScoring.js";
import {
  createSimulationCacheKey,
  SimulationCache,
} from "./SimulationCache.js";

const GENOME_RANGES = Object.freeze({
  economyTarget: [0, 4],
  energyReserveBase: [4, 35],
  energyReserveThreatScale: [.02, .2],
  emergencyReserveMultiplier: [1, 2.2],
  frontlineRiskThreshold: [2, 18],
  reinforcementRiskThreshold: [6, 28],
  replacementHpThreshold: [.15, .65],
  specialRiskThreshold: [5, 28],
  pulseRiskThreshold: [8, 30],
  pulseEmergencyTimeMs: [2000, 9000],
  pulseMinimumValue: [300, 1800],
  startReadinessThreshold: [.42, .95],
  minimumCoverageRatio: [.25, .9],
  timePressureWeight: [.2, 1.8],
  integrityWeight: [.4, 1.8],
  offenseWeight: [.5, 1.8],
  defenseWeight: [.5, 1.8],
  supportWeight: [.3, 1.6],
  economyWeight: [.2, 1.8],
});

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

function mutateGenome(
  genome,
  rng,
  mutationRate,
) {
  const next = {
    ...genome,
  };

  Object.entries(GENOME_RANGES)
    .forEach(
      ([key, [minimum, maximum]]) => {
        if (rng() > mutationRate) {
          return;
        }

        const span = maximum - minimum;
        const delta = (
          (rng() - .5)
          * span
          * .22
        );

        let value = clamp(
          Number(next[key]) + delta,
          minimum,
          maximum,
        );

        if (key === "economyTarget") {
          value = Math.round(value);
        }

        next[key] = value;
      },
    );

  return next;
}

function crossover(
  left,
  right,
  rng,
) {
  const child = {};

  Object.keys(GENOME_RANGES)
    .forEach((key) => {
      const leftValue = Number(left[key]);
      const rightValue = Number(right[key]);

      if (rng() < .35) {
        child[key] = (
          leftValue + rightValue
        ) / 2;
      } else {
        child[key] = rng() < .5
          ? leftValue
          : rightValue;
      }
    });

  child.economyTarget = Math.round(
    child.economyTarget,
  );

  return child;
}

async function evaluateCandidate({
  phase,
  loadout,
  baseStrategy,
  genome,
  seeds,
  config,
  cache,
}) {
  const cacheKey = (
    createSimulationCacheKey({
      phaseId: phase.id,
      loadout,
      strategy: baseStrategy,
      policy: genome,
      seeds,
      config,
    })
  );

  const cached = cache?.get(cacheKey);

  if (cached) {
    return cached;
  }

  const results = [];

  for (const seed of seeds) {
    results.push(
      await runBattleSimulation({
        phase,
        loadout,
        seed,
        strategy: baseStrategy,
        policyOverrides: {
          ...genome,
          id: "optimized",
        },
        config,
      }),
    );
  }

  const evaluation = {
    loadout,
    genome,
    results,
    aggregate:
      aggregateCandidateScore(results),
  };

  return cache
    ? cache.set(cacheKey, evaluation)
    : evaluation;
}

export async function optimizePhaseStrategy({
  phase,
  phaseIndex,
  baseStrategy = "balanced",
  seeds = [1001, 1013, 1031],
  populationSize = 12,
  generations = 6,
  loadoutCandidates = 8,
  mutationRate = .32,
  simulationConfig = {},
  seed = 501,
  onGeneration,
}) {
  const baseProfile = (
    resolveStrategyProfile(
      baseStrategy,
    )
  );

  const cache = new SimulationCache();

  const loadoutPlan = (
    generateLoadoutCandidates({
      phase,
      phaseIndex,
      profile: baseProfile,
      seed,
      maximumCandidates:
        loadoutCandidates,
    })
  );

  const baseGenome = (
    createPolicyGenome(baseProfile)
  );

  const rng = createRng(
    seed ^ 0x9e3779b9,
  );

  const initialEvaluations = [];

  for (const loadout of loadoutPlan.candidates) {
    initialEvaluations.push(
      await evaluateCandidate({
        phase,
        loadout,
        baseStrategy,
        genome: baseGenome,
        seeds,
        config: simulationConfig,
        cache,
      }),
    );
  }

  initialEvaluations.sort(
    (left, right) => (
      right.aggregate.score
      - left.aggregate.score
    ),
  );

  const selectedLoadout = (
    initialEvaluations[0]
      ?.loadout
    || loadoutPlan.loadout
  );

  let population = [
    baseGenome,
  ];

  while (
    population.length < populationSize
  ) {
    population.push(
      mutateGenome(
        baseGenome,
        rng,
        .8,
      ),
    );
  }

  let best = null;
  const history = [];

  for (
    let generation = 0;
    generation < generations;
    generation += 1
  ) {
    const evaluated = [];

    for (const genome of population) {
      evaluated.push(
        await evaluateCandidate({
          phase,
          loadout: selectedLoadout,
          baseStrategy,
          genome,
          seeds,
          config: simulationConfig,
          cache,
        }),
      );
    }

    evaluated.sort(
      (left, right) => (
        right.aggregate.score
        - left.aggregate.score
      ),
    );

    if (
      !best
      || evaluated[0].aggregate.score
        > best.aggregate.score
    ) {
      best = evaluated[0];
    }

    history.push({
      generation,
      bestScore:
        evaluated[0].aggregate.score,
      victoryRate:
        evaluated[0].aggregate.victoryRate,
      averageStars:
        evaluated[0].aggregate.averageStars,
      averageIntegrity:
        evaluated[0].aggregate.averageIntegrity,
      averageDurationMs:
        evaluated[0].aggregate.averageDurationMs,
    });

    onGeneration?.({
      generation,
      best: evaluated[0],
    });

    const eliteCount = Math.max(
      2,
      Math.ceil(populationSize * .25),
    );

    const elites = evaluated
      .slice(0, eliteCount)
      .map((entry) => entry.genome);

    const next = elites.map(
      (entry) => ({
        ...entry,
      }),
    );

    while (next.length < populationSize) {
      const left = elites[
        Math.floor(rng() * elites.length)
      ];

      const right = elites[
        Math.floor(rng() * elites.length)
      ];

      next.push(
        mutateGenome(
          crossover(left, right, rng),
          rng,
          mutationRate,
        ),
      );
    }

    population = next;
  }

  return {
    phaseId: phase.id,
    baseStrategy,
    seeds: [...seeds],
    selectedLoadout,
    loadoutEvaluation:
      initialEvaluations.map((entry) => ({
        loadout: entry.loadout,
        aggregate: entry.aggregate,
      })),
    best: {
      loadout: best.loadout,
      policy: {
        ...best.genome,
        id: "optimized",
      },
      aggregate: best.aggregate,
      results: best.results,
    },
    history,
    cache: cache.summary(),
  };
}
