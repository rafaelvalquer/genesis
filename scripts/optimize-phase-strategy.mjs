#!/usr/bin/env node
import path from "node:path";
import {
  PHASES,
  getPhase,
  getPhaseIndex,
} from "../src/game/content.js";
import {
  optimizePhaseStrategy,
} from "../src/game/simulation/optimization/PolicyOptimizer.js";
import {
  ensureDirectory,
  parseArgs,
  parseNumberList,
  parsePositiveInteger,
  resolveOutputDirectory,
  writeTextFile,
} from "./simulationCli.mjs";

const args = parseArgs();
const phaseId = (
  args.phase || PHASES[0]?.id
);

const phase = getPhase(phaseId);

if (!phase) {
  console.error(
    `Fase desconhecida: ${phaseId}`,
  );

  process.exit(1);
}

const seeds = parseNumberList(
  args.seeds,
  [1001, 1013, 1031],
);

const outputDirectory = (
  ensureDirectory(
    resolveOutputDirectory(
      args["out-dir"],
    ),
  )
);

console.log(
  `Otimizando ${phase.id} (${phase.name})`,
);

const result = await optimizePhaseStrategy({
  phase,
  phaseIndex: getPhaseIndex(
    phase.id,
  ),
  baseStrategy:
    args.strategy || "balanced",
  seeds,
  populationSize:
    parsePositiveInteger(
      args.population,
      12,
    ),
  generations:
    parsePositiveInteger(
      args.generations,
      6,
    ),
  loadoutCandidates:
    parsePositiveInteger(
      args["loadout-candidates"],
      8,
    ),
  mutationRate:
    Number(args["mutation-rate"])
      || .32,
  simulationConfig: {
    maximumDurationMs:
      Number(
        args["max-duration-ms"],
      ) || undefined,
    actionLogLimit: 0,
  },
  seed:
    Number(args.seed) || 501,
  onGeneration: ({
    generation,
    best,
  }) => {
    console.log(
      `Geração ${generation + 1}: `
      + `vitória ${(best.aggregate.victoryRate * 100).toFixed(1)}% · `
      + `estrelas ${best.aggregate.averageStars.toFixed(2)} · `
      + `integridade ${best.aggregate.averageIntegrity.toFixed(1)}%`,
    );
  },
});

const outputPath = path.join(
  outputDirectory,
  `${phase.id}-optimized-strategy.json`,
);

writeTextFile(
  outputPath,
  `${JSON.stringify(
    result,
    null,
    2,
  )}\n`,
);

console.log("");
console.log(
  `Melhor loadout: ${result.best.loadout.join(", ")}`,
);

console.log(
  `Taxa de vitória: ${(result.best.aggregate.victoryRate * 100).toFixed(1)}%`,
);

console.log(
  `Arquivo: ${outputPath}`,
);
