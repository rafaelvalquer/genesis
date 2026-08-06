#!/usr/bin/env node
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  Worker,
} from "node:worker_threads";
import {
  PHASES,
  getChapterForPhase,
} from "../src/game/content.js";
import {
  DEFAULT_CAMPAIGN_SEEDS,
  QUICK_CAMPAIGN_SEEDS,
  STRATEGY_IDS,
} from "../src/game/simulation/index.js";
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
const quick = parseBoolean(
  args.quick,
  false,
);

const strict = parseBoolean(
  args.strict,
  false,
);

const requestedPhases = parseCsv(
  args.phases,
  PHASES.map((phase) => phase.id),
);

const phaseIds = new Set(
  requestedPhases,
);

const phases = PHASES.filter(
  (phase) => phaseIds.has(phase.id),
);

if (!phases.length) {
  console.error(
    "Nenhuma fase válida foi selecionada.",
  );

  process.exit(1);
}

const strategies = parseCsv(
  args.strategies,
  quick
    ? ["balanced"]
    : STRATEGY_IDS,
);

const seeds = parseNumberList(
  args.seeds,
  quick
    ? [QUICK_CAMPAIGN_SEEDS[0]]
    : DEFAULT_CAMPAIGN_SEEDS,
);

const availableParallelism = (
  typeof os.availableParallelism
    === "function"
      ? os.availableParallelism()
      : os.cpus().length
);

const workers = Math.max(
  1,
  Math.min(
    parsePositiveInteger(
      args.workers,
      Math.max(
        1,
        availableParallelism - 1,
      ),
    ),
    Math.max(1, availableParallelism),
  ),
);

const outputDirectory = (
  ensureDirectory(
    resolveOutputDirectory(
      args["out-dir"],
    ),
  )
);

const strategyFile = (
  args["strategy-file"]
    ? readJsonFile(
      args["strategy-file"],
      {},
    )
    : {}
);

const phaseStrategies = (
  strategyFile?.phases
  || strategyFile
  || {}
);

const commonConfig = {
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
  actionLogLimit:
    Math.max(
      0,
      Number(
        args["action-log-limit"]
        ?? (quick ? 40 : 0),
      ) || 0,
    ),
};

const tasks = [];

for (const phase of phases) {
  for (const strategy of strategies) {
    for (const seed of seeds) {
      const saved = (
        phaseStrategies[phase.id]
        || {}
      );

      tasks.push({
        phaseId: phase.id,
        strategy,
        seed,
        loadout:
          saved.loadout
          || saved.best?.loadout
          || null,
        policyOverrides:
          saved.policy
          || saved.best?.policy
          || {},
        config: commonConfig,
      });
    }
  }
}

console.log(
  `Simulação da campanha: ${phases.length} fases · `
  + `${strategies.length} estratégia(s) · `
  + `${seeds.length} seed(s) · `
  + `${tasks.length} execução(ões) · `
  + `${workers} worker(s)`,
);

const workerUrl = new URL(
  "./simulation-worker.mjs",
  import.meta.url,
);

const results = [];
const failures = [];
let completed = 0;
let nextTaskIndex = 0;
let sequence = 0;
let resolved = false;

const startedAt = Date.now();

const runAll = () => (
  new Promise((resolve, reject) => {
    const instances = [];

    const stopAll = () => {
      instances.forEach((worker) => {
        worker.terminate().catch(() => {});
      });
    };

    const finish = () => {
      if (resolved) return;
      resolved = true;
      stopAll();
      resolve();
    };

    const dispatch = (worker) => {
      if (nextTaskIndex >= tasks.length) {
        if (completed >= tasks.length) {
          finish();
        }

        return;
      }

      const task = tasks[nextTaskIndex];
      nextTaskIndex += 1;

      const id = sequence;
      sequence += 1;

      worker.currentTask = {
        id,
        task,
      };

      worker.postMessage({
        type: "run",
        id,
        task,
      });
    };

    for (
      let index = 0;
      index < workers;
      index += 1
    ) {
      const worker = new Worker(
        workerUrl,
        {
          type: "module",
        },
      );

      instances.push(worker);

      worker.on(
        "message",
        (message) => {
          const current = worker.currentTask;

          if (
            !current
            || message.id !== current.id
          ) {
            return;
          }

          completed += 1;

          if (message.type === "result") {
            results.push(message.result);

            const result = message.result;

            console.log(
              `[${completed}/${tasks.length}] `
              + `${result.phaseId} · ${result.strategyId} · seed ${result.seed}: `
              + `${result.outcome || result.failureReason || "sem resultado"} · `
              + `${result.stars}★ · `
              + `${formatElapsed(result.durationMs)}`,
            );
          } else {
            failures.push({
              task: current.task,
              error: message.error,
            });

            console.error(
              `[${completed}/${tasks.length}] `
              + `${current.task.phaseId} · ${current.task.strategy} · seed ${current.task.seed}: `
              + `erro ${message.error?.message}`,
            );
          }

          worker.currentTask = null;
          dispatch(worker);
        },
      );

      worker.on(
        "error",
        (error) => {
          const current = worker.currentTask;

          if (current) {
            completed += 1;

            failures.push({
              task: current.task,
              error: {
                name: error.name,
                message: error.message,
                stack: error.stack,
              },
            });

            worker.currentTask = null;
          }

          if (completed >= tasks.length) {
            finish();
          } else {
            reject(error);
          }
        },
      );

      worker.on(
        "exit",
        (code) => {
          if (
            !resolved
            && code !== 0
          ) {
            reject(
              new Error(
                `Worker finalizado com código ${code}.`,
              ),
            );
          }
        },
      );

      dispatch(worker);
    }
  })
);

await runAll();

const report = buildSimulationReport({
  results,
  phases: phases.map((phase) => ({
    ...phase,
    chapterId:
      getChapterForPhase(phase)?.id
      || null,
  })),
  metadata: {
    command: "simulate-campaign",
    quick,
    strict,
    strategies,
    seeds,
    workers,
    tasks: tasks.length,
    workerFailures: failures.length,
    wallDurationMs:
      Date.now() - startedAt,
  },
});

const serialized = (
  serializeSimulationReport(report)
);

writeTextFile(
  path.join(
    outputDirectory,
    "campaign-simulation.json",
  ),
  serialized.json,
);

writeTextFile(
  path.join(
    outputDirectory,
    "campaign-simulation.csv",
  ),
  serialized.csv,
);

writeTextFile(
  path.join(
    outputDirectory,
    "campaign-simulation.md",
  ),
  serialized.markdown,
);

writeTextFile(
  path.join(
    outputDirectory,
    "simulation-failures.json",
  ),
  `${JSON.stringify(
    failures,
    null,
    2,
  )}\n`,
);

const summary = report.campaign;

console.log("");
console.log(
  `Concluído em ${formatElapsed(
    Date.now() - startedAt,
  )}.`,
);

console.log(
  `Taxa geral de vitória: ${(summary.victoryRate * 100).toFixed(1)}%`,
);

console.log(
  `Falhas técnicas: ${summary.technicalFailures + failures.length}`,
);

console.log(
  `Relatórios: ${outputDirectory}`,
);

if (
  failures.length > 0
  || summary.technicalFailures > 0
) {
  console.warn("");
  console.warn(
    "A auditoria encontrou falhas técnicas em uma ou mais execuções.",
  );
  console.warn(
    "Os relatórios foram preservados para diagnóstico.",
  );
  console.warn(
    "Execute: npm run diagnose:simulation",
  );

  if (strict) {
    process.exitCode = 2;
  }
}
