#!/usr/bin/env node
import path from "node:path";
import {
  PHASES,
  getPhaseIndex,
} from "../src/game/content.js";
import {
  optimizePhaseStrategy,
} from "../src/game/simulation/optimization/PolicyOptimizer.js";
import {
  parseArgs,
  parseBoolean,
  parseCsv,
  parseNumberList,
  parsePositiveInteger,
  resolveOutputDirectory,
  ensureDirectory,
  writeTextFile,
} from "./simulationCli.mjs";

const args = parseArgs();

const quick = parseBoolean(
  args.quick,
  false,
);

const requested = new Set(
  parseCsv(
    args.phases,
    PHASES.map((phase) => phase.id),
  ),
);

const phases = PHASES.filter(
  (phase) => requested.has(phase.id),
);

if (!phases.length) {
  console.error(
    "Nenhuma fase válida para otimização.",
  );

  process.exit(1);
}

const seeds = parseNumberList(
  args.seeds,
  quick
    ? [1001, 1013]
    : [1001, 1013, 1031, 1061, 1091],
);

const populationSize = (
  parsePositiveInteger(
    args.population,
    quick ? 6 : 12,
  )
);

const generations = (
  parsePositiveInteger(
    args.generations,
    quick ? 3 : 8,
  )
);

const loadoutCandidates = (
  parsePositiveInteger(
    args["loadout-candidates"],
    quick ? 5 : 10,
  )
);

const outputDirectory = ensureDirectory(
  resolveOutputDirectory(
    args["out-dir"],
  ),
);

const output = {
  schemaVersion: 1,
  generatedAt:
    new Date().toISOString(),
  baseStrategy:
    args.strategy || "balanced",
  seeds,
  populationSize,
  generations,
  loadoutCandidates,
  phases: {},
};

for (
  let index = 0;
  index < phases.length;
  index += 1
) {
  const phase = phases[index];

  console.log("");
  console.log(
    `[${index + 1}/${phases.length}] Otimizando ${phase.id} · ${phase.name}`,
  );

  const optimization = (
    await optimizePhaseStrategy({
      phase,
      phaseIndex:
        getPhaseIndex(phase.id),
      baseStrategy:
        output.baseStrategy,
      seeds,
      populationSize,
      generations,
      loadoutCandidates,
      simulationConfig: {
        maximumDurationMs:
          Number(
            args["max-duration-ms"],
          ) || undefined,
        actionLogLimit: 0,
      },
      seed:
        501 + index * 7919,
      onGeneration: ({
        generation,
        best,
      }) => {
        console.log(
          `  geração ${generation + 1}: `
          + `vitória ${(best.aggregate.victoryRate * 100).toFixed(1)}% · `
          + `estrelas ${best.aggregate.averageStars.toFixed(2)}`,
        );
      },
    })
  );

  output.phases[phase.id] = {
    loadout:
      optimization.best.loadout,
    policy:
      optimization.best.policy,
    aggregate:
      optimization.best.aggregate,
    history:
      optimization.history,
    loadoutEvaluation:
      optimization.loadoutEvaluation,
  };

  writeTextFile(
    path.join(
      outputDirectory,
      "phase-strategies.partial.json",
    ),
    `${JSON.stringify(
      output,
      null,
      2,
    )}\n`,
  );
}

const outputPath = path.join(
  outputDirectory,
  "phase-strategies.json",
);

writeTextFile(
  outputPath,
  `${JSON.stringify(
    output,
    null,
    2,
  )}\n`,
);

console.log("");
console.log(
  `Estratégias otimizadas: ${outputPath}`,
);
