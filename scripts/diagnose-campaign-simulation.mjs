#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import {
  parseArgs,
} from "./simulationCli.mjs";

const args = parseArgs();
const reportPath = path.resolve(
  args.report
  || "reports/campaign-simulation.json",
);
const failuresPath = path.resolve(
  args.failures
  || "reports/simulation-failures.json",
);

if (!fs.existsSync(reportPath)) {
  console.error(
    `Relatório não encontrado: ${reportPath}`,
  );
  process.exit(1);
}

const report = JSON.parse(
  fs.readFileSync(reportPath, "utf8"),
);

const technicalPhases = (
  report.phases || []
).filter((phase) => (
  Number(phase.invalidStates) > 0
  || Number(phase.deadlocks) > 0
  || Number(phase.timeouts) > 0
));

const failedRuns = (
  report.runs || []
).filter((run) => (
  run.invalidState
  || run.deadlock
  || run.timeout
  || run.failureReason
));

console.log("Diagnóstico da simulação da campanha");
console.log("");

if (!technicalPhases.length && !failedRuns.length) {
  console.log(
    "Nenhuma falha técnica registrada.",
  );
} else {
  console.log(
    `Fases com falha técnica: ${technicalPhases.length}`,
  );

  technicalPhases.forEach((phase) => {
    console.log(
      `- ${phase.phaseId}: `
      + `${phase.invalidStates} estado(s) inválido(s), `
      + `${phase.deadlocks} deadlock(s), `
      + `${phase.timeouts} timeout(s).`,
    );
  });

  console.log("");
  console.log(
    `Execuções afetadas: ${failedRuns.length}`,
  );

  failedRuns.forEach((run) => {
    const reason = (
      run.invalidState?.message
      || run.deadlock?.message
      || run.failureReason
      || (
        run.timeout
          ? "maximumDuration"
          : "falha desconhecida"
      )
    );

    console.log(
      `- ${run.phaseId} · ${run.strategyId} · seed ${run.seed}: ${reason}`,
    );

    if (run.deadlock) {
      console.log(
        `  onda ${Number(run.deadlock.waveIndex || 0) + 1}, `
        + `inimigos ${run.deadlock.enemies}, `
        + `fila ${run.deadlock.queued}, `
        + `outro ${run.deadlock.waveOutroStatus}, `
        + `assistência ${run.deadlock.adaptiveAidStatus}`,
      );
    }

    if (run.invalidState?.details) {
      console.log(
        `  detalhes: ${JSON.stringify(run.invalidState.details)}`,
      );
    }
  });
}

if (fs.existsSync(failuresPath)) {
  const workerFailures = JSON.parse(
    fs.readFileSync(failuresPath, "utf8"),
  );

  if (workerFailures.length) {
    console.log("");
    console.log(
      `Falhas de worker: ${workerFailures.length}`,
    );

    workerFailures.forEach((entry) => {
      console.log(
        `- ${entry.task?.phaseId} · ${entry.task?.strategy} · seed ${entry.task?.seed}: `
        + `${entry.error?.message || "erro desconhecido"}`,
      );
    });
  }
}

console.log("");
console.log(`Relatório: ${reportPath}`);
