#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import {
  PHASES,
} from "../src/game/content.js";
import {
  parseArgs,
  parseBoolean,
} from "./simulationCli.mjs";

const args = parseArgs();

const reportPath = path.resolve(
  args.report
  || "reports/campaign-simulation.json",
);

if (!fs.existsSync(reportPath)) {
  console.error(
    `Relatório não encontrado: ${reportPath}`,
  );

  process.exit(1);
}

const report = JSON.parse(
  fs.readFileSync(
    reportPath,
    "utf8",
  ),
);

const errors = [];
const warnings = [];

if (
  report.schemaVersion !== 1
) {
  errors.push(
    `schemaVersion inválido: ${report.schemaVersion}`,
  );
}

const phaseSummaries = (
  Array.isArray(report.phases)
    ? report.phases
    : []
);

const summaryByPhase = new Map(
  phaseSummaries.map(
    (phase) => [
      phase.phaseId,
      phase,
    ],
  ),
);

const allowPartial = parseBoolean(
  args["allow-partial"],
  false,
);

const strictTechnical = parseBoolean(
  args["strict-technical"],
  false,
);

if (!allowPartial) {
  PHASES.forEach((phase) => {
    if (!summaryByPhase.has(phase.id)) {
      errors.push(
        `Fase ausente no relatório: ${phase.id}`,
      );
    }
  });
}

phaseSummaries.forEach((phase) => {
  if (Number(phase.runs) <= 0) {
    errors.push(
      `${phase.phaseId}: nenhuma execução.`,
    );
  }

  const technicalMessages = [];

  if (Number(phase.invalidStates) > 0) {
    technicalMessages.push(
      `${phase.phaseId}: ${phase.invalidStates} estado(s) inválido(s).`,
    );
  }

  if (Number(phase.deadlocks) > 0) {
    technicalMessages.push(
      `${phase.phaseId}: ${phase.deadlocks} deadlock(s).`,
    );
  }

  if (Number(phase.timeouts) > 0) {
    technicalMessages.push(
      `${phase.phaseId}: ${phase.timeouts} timeout(s).`,
    );
  }

  technicalMessages.forEach((message) => {
    if (strictTechnical) {
      errors.push(message);
    } else {
      warnings.push(message);
    }
  });

  if (Number(phase.victories) <= 0) {
    warnings.push(
      `${phase.phaseId}: nenhuma vitória da IA.`,
    );
  }
});

const minimumVictoryRate = Number(
  args["minimum-victory-rate"],
);

if (
  Number.isFinite(minimumVictoryRate)
  && minimumVictoryRate > 0
) {
  phaseSummaries.forEach((phase) => {
    if (
      Number(phase.victoryRate)
      < minimumVictoryRate
    ) {
      errors.push(
        `${phase.phaseId}: taxa de vitória ${(Number(phase.victoryRate) * 100).toFixed(1)}% abaixo de ${(minimumVictoryRate * 100).toFixed(1)}%.`,
      );
    }
  });
}

if (args.baseline) {
  const baselinePath = path.resolve(
    args.baseline,
  );

  if (!fs.existsSync(baselinePath)) {
    errors.push(
      `Baseline não encontrada: ${baselinePath}`,
    );
  } else {
    const baseline = JSON.parse(
      fs.readFileSync(
        baselinePath,
        "utf8",
      ),
    );

    const baselineMap = new Map(
      (baseline.phases || []).map(
        (phase) => [
          phase.phaseId,
          phase,
        ],
      ),
    );

    const maximumVictoryDrop = Number(
      args["maximum-victory-drop"]
      ?? .2,
    );

    const maximumDurationIncrease = Number(
      args["maximum-duration-increase"]
      ?? .3,
    );

    phaseSummaries.forEach((phase) => {
      const previous = baselineMap.get(
        phase.phaseId,
      );

      if (!previous) return;

      const victoryDrop = (
        Number(previous.victoryRate)
        - Number(phase.victoryRate)
      );

      if (
        victoryDrop > maximumVictoryDrop
      ) {
        errors.push(
          `${phase.phaseId}: queda de vitória de ${(victoryDrop * 100).toFixed(1)} pontos percentuais.`,
        );
      }

      if (
        Number(previous.medianDurationMs) > 0
        && Number(phase.medianDurationMs) > 0
      ) {
        const durationIncrease = (
          Number(phase.medianDurationMs)
          / Number(previous.medianDurationMs)
          - 1
        );

        if (
          durationIncrease
          > maximumDurationIncrease
        ) {
          errors.push(
            `${phase.phaseId}: tempo mediano aumentou ${(durationIncrease * 100).toFixed(1)}%.`,
          );
        }
      }
    });
  }
}

warnings.forEach((warning) => {
  console.warn(`[AVISO] ${warning}`);
});

if (errors.length) {
  console.error(
    `Relatório reprovado: ${errors.length} erro(s).`,
  );

  errors.forEach((error) => {
    console.error(`- ${error}`);
  });

  process.exitCode = 1;
} else if (warnings.length) {
  console.log(
    `Relatório estruturalmente aprovado: ${phaseSummaries.length} fase(s), ${warnings.length} aviso(s).`,
  );
} else {
  console.log(
    `Relatório aprovado: ${phaseSummaries.length} fase(s), sem avisos.`,
  );
}
