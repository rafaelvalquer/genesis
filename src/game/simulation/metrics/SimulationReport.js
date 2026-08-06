import {
  average,
  csvEscape,
  formatDuration,
  median,
  percentile,
  round,
  stableJson,
} from "./reportUtils.js";

function phaseKey(
  result,
) {
  return String(result.phaseId);
}

function groupByPhase(
  results,
) {
  const groups = new Map();

  results.forEach((result) => {
    const key = phaseKey(result);

    if (!groups.has(key)) {
      groups.set(key, []);
    }

    groups.get(key).push(result);
  });

  return groups;
}

function mostFrequent(
  values,
) {
  const counts = new Map();

  values.forEach((value) => {
    if (value == null) return;

    const key = typeof value === "string"
      ? value
      : JSON.stringify(value);

    counts.set(
      key,
      (counts.get(key) || 0) + 1,
    );
  });

  const winner = [
    ...counts.entries(),
  ].sort(
    (left, right) => (
      right[1] - left[1]
      || left[0].localeCompare(right[0])
    ),
  )[0];

  if (!winner) return null;

  try {
    return JSON.parse(winner[0]);
  } catch {
    return winner[0];
  }
}

function classifyPhase(
  summary,
) {
  if (
    summary.invalidStates > 0
    || summary.deadlocks > 0
  ) {
    return "ERRO TÉCNICO";
  }

  if (summary.timeouts > 0) {
    return "TIMEOUT";
  }

  if (summary.victoryRate >= .9) {
    return "CONFIÁVEL";
  }

  if (summary.victoryRate >= .65) {
    return "EQUILIBRADA";
  }

  if (summary.victoryRate >= .35) {
    return "SEVERA";
  }

  if (summary.victoryRate > 0) {
    return "MUITO SEVERA";
  }

  return "SEM VITÓRIA";
}

function summarizePhase(
  phaseId,
  results,
  phaseMetadata = {},
) {
  const valid = results.filter(
    (result) => (
      !result.invalidState
      && !result.deadlock
      && !result.timeout
    ),
  );

  const victories = valid.filter(
    (result) => (
      result.outcome === "victory"
    ),
  );

  const denominator = Math.max(
    1,
    results.length,
  );

  const victoryRate = (
    victories.length / denominator
  );

  const summary = {
    phaseId,
    phaseName:
      phaseMetadata.name || phaseId,
    chapterId:
      phaseMetadata.chapterId || null,
    runs: results.length,
    validRuns: valid.length,
    victories: victories.length,
    defeats: valid.filter(
      (result) => (
        result.outcome === "defeat"
      ),
    ).length,
    victoryRate,
    averageStars: round(
      average(
        victories.map(
          (result) => result.stars,
        ),
      ),
    ),
    medianStars: round(
      median(
        victories.map(
          (result) => result.stars,
        ),
      ),
    ),
    medianDurationMs: Math.round(
      median(
        victories.map(
          (result) => result.durationMs,
        ),
      ),
    ),
    p25DurationMs: Math.round(
      percentile(
        victories.map(
          (result) => result.durationMs,
        ),
        .25,
      ),
    ),
    p75DurationMs: Math.round(
      percentile(
        victories.map(
          (result) => result.durationMs,
        ),
        .75,
      ),
    ),
    medianIntegrity: round(
      median(
        victories.map(
          (result) => result.integrity,
        ),
      ),
    ),
    averageTroopDeaths: round(
      average(
        results.map(
          (result) => result.troopDeaths,
        ),
      ),
    ),
    averageDeployments: round(
      average(
        results.map(
          (result) => result.deployments,
        ),
      ),
    ),
    averageReplacements: round(
      average(
        results.map(
          (result) => result.replacements,
        ),
      ),
    ),
    medianPeakEntities: round(
      median(
        results.map(
          (result) => (
            result.peaks?.activeEntities
          ),
        ),
      ),
    ),
    assistanceTriggeredRate: round(
      results.filter(
        (result) => (
          result.assistanceTriggered
        ),
      ).length / denominator,
      4,
    ),
    assistanceUsedRate: round(
      results.filter(
        (result) => (
          result.assistanceUsed
        ),
      ).length / denominator,
      4,
    ),
    invalidStates: results.filter(
      (result) => result.invalidState,
    ).length,
    deadlocks: results.filter(
      (result) => result.deadlock,
    ).length,
    timeouts: results.filter(
      (result) => result.timeout,
    ).length,
    recommendedLoadout: mostFrequent(
      victories.map(
        (result) => result.loadout,
      ),
    ) || mostFrequent(
      results.map(
        (result) => result.loadout,
      ),
    ),
    strategyIds: [
      ...new Set(
        results.map(
          (result) => result.strategyId,
        ),
      ),
    ],
  };

  summary.classification = (
    classifyPhase(summary)
  );

  return summary;
}

function campaignSummary(
  phaseSummaries,
  results,
) {
  const totalRuns = results.length;
  const victories = results.filter(
    (result) => (
      result.outcome === "victory"
    ),
  );

  return {
    phases: phaseSummaries.length,
    totalRuns,
    victories: victories.length,
    victoryRate: totalRuns
      ? victories.length / totalRuns
      : 0,
    technicalFailures: results.filter(
      (result) => (
        result.invalidState
        || result.deadlock
        || result.timeout
      ),
    ).length,
    phasesWithTechnicalFailure:
      phaseSummaries.filter(
        (summary) => (
          summary.invalidStates > 0
          || summary.deadlocks > 0
          || summary.timeouts > 0
        ),
      ).length,
    phasesWithoutVictory:
      phaseSummaries.filter(
        (summary) => (
          summary.victories === 0
        ),
      ).length,
    medianVictoryDurationMs:
      Math.round(
        median(
          victories.map(
            (result) => result.durationMs,
          ),
        ),
      ),
    medianVictoryIntegrity:
      round(
        median(
          victories.map(
            (result) => result.integrity,
          ),
        ),
      ),
    generatedAt:
      new Date().toISOString(),
  };
}

export function buildSimulationReport({
  results,
  phases = [],
  metadata = {},
}) {
  const phaseMetadata = new Map(
    phases.map((phase) => [
      phase.id,
      {
        name: phase.name,
        chapterId:
          phase.chapterId || null,
      },
    ]),
  );

  const grouped = groupByPhase(results);

  const phaseOrder = new Map(
    phases.map(
      (phase, index) => [
        phase.id,
        index,
      ],
    ),
  );

  const phaseSummaries = [
    ...grouped.entries(),
  ].map(([phaseId, entries]) => (
    summarizePhase(
      phaseId,
      entries,
      phaseMetadata.get(phaseId),
    )
  )).sort(
    (left, right) => (
      (
        phaseOrder.get(left.phaseId)
        ?? Number.MAX_SAFE_INTEGER
      )
      - (
        phaseOrder.get(right.phaseId)
        ?? Number.MAX_SAFE_INTEGER
      )
      || left.phaseId.localeCompare(
        right.phaseId,
      )
    ),
  );

  return {
    schemaVersion: 1,
    metadata: {
      ...metadata,
      generatedAt:
        new Date().toISOString(),
    },
    campaign:
      campaignSummary(
        phaseSummaries,
        results,
      ),
    phases: phaseSummaries,
    runs: results,
  };
}

export function reportToCsv(
  report,
) {
  const columns = [
    "phaseId",
    "phaseName",
    "chapterId",
    "runs",
    "victories",
    "defeats",
    "victoryRate",
    "averageStars",
    "medianDurationMs",
    "medianIntegrity",
    "averageTroopDeaths",
    "averageDeployments",
    "averageReplacements",
    "medianPeakEntities",
    "assistanceUsedRate",
    "invalidStates",
    "deadlocks",
    "timeouts",
    "classification",
    "recommendedLoadout",
  ];

  const lines = [
    columns.join(";"),
  ];

  report.phases.forEach((phase) => {
    const row = {
      ...phase,
      victoryRate:
        round(phase.victoryRate * 100, 2),
      assistanceUsedRate:
        round(
          phase.assistanceUsedRate * 100,
          2,
        ),
      recommendedLoadout:
        phase.recommendedLoadout?.join(",")
        || "",
    };

    lines.push(
      columns.map(
        (column) => (
          csvEscape(row[column])
        ),
      ).join(";"),
    );
  });

  return `${lines.join("\n")}\n`;
}

export function reportToMarkdown(
  report,
) {
  const campaign = report.campaign;

  const lines = [
    "# Relatório de simulação da campanha",
    "",
    `Gerado em: ${report.metadata.generatedAt}`,
    "",
    "## Resumo",
    "",
    `- Fases analisadas: ${campaign.phases}`,
    `- Execuções: ${campaign.totalRuns}`,
    `- Taxa geral de vitória: ${round(campaign.victoryRate * 100, 2)}%`,
    `- Falhas técnicas: ${campaign.technicalFailures}`,
    `- Fases sem vitória: ${campaign.phasesWithoutVictory}`,
    `- Duração mediana das vitórias: ${formatDuration(campaign.medianVictoryDurationMs)}`,
    `- Integridade mediana das vitórias: ${campaign.medianVictoryIntegrity}%`,
    "",
    "## Resultado por fase",
    "",
    "| Fase | Execuções | Vitória | Estrelas | Tempo mediano | Integridade | Mortes | Reposições | Pico | Estado |",
    "|---|---:|---:|---:|---:|---:|---:|---:|---:|---|",
  ];

  report.phases.forEach((phase) => {
    lines.push([
      `| ${phase.phaseId}`,
      phase.runs,
      `${round(phase.victoryRate * 100, 1)}%`,
      phase.averageStars,
      formatDuration(
        phase.medianDurationMs,
      ),
      `${phase.medianIntegrity}%`,
      phase.averageTroopDeaths,
      phase.averageReplacements,
      phase.medianPeakEntities,
      `${phase.classification} |`,
    ].join(" | "));
  });

  const technicalFailures = (
    report.phases.filter(
      (phase) => (
        phase.invalidStates > 0
        || phase.deadlocks > 0
        || phase.timeouts > 0
      ),
    )
  );

  lines.push(
    "",
    "## Alertas técnicos",
    "",
  );

  if (!technicalFailures.length) {
    lines.push(
      "Nenhuma falha técnica detectada.",
    );
  } else {
    technicalFailures.forEach((phase) => {
      lines.push(
        `- ${phase.phaseId}: `
        + `${phase.invalidStates} estado(s) inválido(s), `
        + `${phase.deadlocks} deadlock(s), `
        + `${phase.timeouts} timeout(s).`,
      );
    });
  }

  lines.push(
    "",
    "## Loadouts recomendados",
    "",
  );

  report.phases.forEach((phase) => {
    lines.push(
      `- ${phase.phaseId}: `
      + (
        phase.recommendedLoadout
          ?.join(", ")
        || "sem recomendação"
      ),
    );
  });

  return `${lines.join("\n")}\n`;
}

export function serializeSimulationReport(
  report,
) {
  return {
    json: stableJson(report),
    csv: reportToCsv(report),
    markdown: reportToMarkdown(report),
  };
}
