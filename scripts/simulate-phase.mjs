#!/usr/bin/env node
import path from "node:path";
import {
  PHASES,
  getChapterForPhase,
  getPhase,
  getPhaseIndex,
} from "../src/game/content.js";
import {
  generateLoadoutCandidates,
  planLoadoutForPhase,
  runBattleSimulation,
  resolveStrategyProfile,
} from "../src/game/simulation/index.js";
import {
  optimizePhaseStrategy,
} from "../src/game/simulation/optimization/PolicyOptimizer.js";
import {
  buildSimulationReport,
  serializeSimulationReport,
} from "../src/game/simulation/metrics/SimulationReport.js";
import {
  ensureDirectory,
  formatElapsed,
  parseArgs,
  parseBoolean,
  parseCsv,
  parseNumberList,
  parsePositiveInteger,
  readJsonFile,
  resolveOutputDirectory,
  writeTextFile,
} from "./simulationCli.mjs";

const args = parseArgs();

const phaseId = (
  args.phase
  || PHASES[0]?.id
);

const phase = getPhase(phaseId);

if (!phase) {
  console.error(
    `Fase desconhecida: ${phaseId}`,
  );

  process.exit(1);
}

const phaseIndex = getPhaseIndex(
  phase.id,
);

const strategy = (
  args.strategy
  || "balanced"
);

const seed = Number(
  args.seed || 1001,
);

const seeds = parseNumberList(
  args.seeds,
  [seed],
);

const optimize = parseBoolean(
  args.optimize,
  false,
);

const outputDirectory = (
  ensureDirectory(
    resolveOutputDirectory(
      args["out-dir"],
    ),
  )
);

const policyFile = (
  args.policy
  ? readJsonFile(args.policy)
  : null
);

let selectedLoadout = parseCsv(
  args.loadout,
);

let policyOverrides = (
  policyFile?.policy
  || policyFile?.best?.policy
  || {}
);

if (optimize) {
  const optimization = (
    await optimizePhaseStrategy({
      phase,
      phaseIndex,
      baseStrategy: strategy,
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
      simulationConfig: {
        maximumDurationMs:
          Number(
            args["max-duration-ms"],
          ) || undefined,
        allowAdaptiveAid:
          !parseBoolean(
            args["no-aid"],
            false,
          ),
      },
      onGeneration: ({
        generation,
        best,
      }) => {
        console.log(
          `Geração ${generation + 1}: `
          + `vitória ${(best.aggregate.victoryRate * 100).toFixed(1)}% · `
          + `score ${Math.round(best.aggregate.score)}`,
        );
      },
    })
  );

  selectedLoadout = (
    optimization.best.loadout
  );

  policyOverrides = (
    optimization.best.policy
  );

  writeTextFile(
    path.join(
      outputDirectory,
      `${phase.id}-optimized-strategy.json`,
    ),
    `${JSON.stringify(
      optimization,
      null,
      2,
    )}\n`,
  );
}

if (!selectedLoadout.length) {
  const profile = (
    resolveStrategyProfile(
      strategy,
      policyOverrides,
    )
  );

  const plan = (
    planLoadoutForPhase({
      phase,
      phaseIndex,
      profile,
      seed,
    })
  );

  selectedLoadout = plan.loadout;
}

console.log(
  `Simulando ${phase.id} (${phase.name})`,
);

console.log(
  `Estratégia: ${strategy}`,
);

console.log(
  `Loadout: ${selectedLoadout.join(", ")}`,
);

const results = [];

for (const currentSeed of seeds) {
  const result = await runBattleSimulation({
    phase,
    loadout: selectedLoadout,
    seed: currentSeed,
    strategy,
    policyOverrides,
    config: {
      maximumDurationMs:
        Number(
          args["max-duration-ms"],
        ) || undefined,
      allowAdaptiveAid:
        !parseBoolean(
          args["no-aid"],
          false,
        ),
      accelerateOutros:
        parseBoolean(
          args["accelerate-outros"],
          false,
        ),
    },
    onProgress: parseBoolean(
      args.progress,
      false,
    )
      ? (progress) => {
        console.log(
          `  seed ${currentSeed} · `
          + `onda ${progress.waveIndex + 1}/${progress.totalWaves} · `
          + `${formatElapsed(progress.elapsedMs)} · `
          + `integridade ${Math.round(progress.integrity)}`,
        );
      }
      : undefined,
  });

  results.push(result);

  console.log(
    `  seed ${currentSeed}: `
    + `${result.outcome || result.failureReason || "sem resultado"} · `
    + `${result.stars}★ · `
    + `${formatElapsed(result.durationMs)} · `
    + `integridade ${result.integrity}%`,
  );
}

const report = buildSimulationReport({
  results,
  phases: [{
    ...phase,
    chapterId:
      getChapterForPhase(phase)?.id
      || null,
  }],
  metadata: {
    command: "simulate-phase",
    phaseId: phase.id,
    strategy,
    loadout: selectedLoadout,
    seeds,
  },
});

const serialized = (
  serializeSimulationReport(report)
);

const baseName = (
  `${phase.id}-simulation`
);

writeTextFile(
  path.join(
    outputDirectory,
    `${baseName}.json`,
  ),
  serialized.json,
);

writeTextFile(
  path.join(
    outputDirectory,
    `${baseName}.csv`,
  ),
  serialized.csv,
);

writeTextFile(
  path.join(
    outputDirectory,
    `${baseName}.md`,
  ),
  serialized.markdown,
);

const phaseSummary = report.phases[0];

console.log("");
console.log(
  `Taxa de vitória: ${(phaseSummary.victoryRate * 100).toFixed(1)}%`,
);

console.log(
  `Relatórios: ${outputDirectory}`,
);

if (
  phaseSummary.invalidStates > 0
  || phaseSummary.deadlocks > 0
  || phaseSummary.timeouts > 0
) {
  process.exitCode = 2;
}
