import {
  describe,
  expect,
  it,
} from "vitest";
import {
  buildSimulationReport,
  reportToCsv,
  reportToMarkdown,
} from "./SimulationReport.js";

const results = [
  {
    phaseId: "fase_01",
    strategyId: "balanced",
    seed: 1,
    loadout: ["colono"],
    outcome: "victory",
    stars: 2,
    durationMs: 100000,
    integrity: 70,
    troopDeaths: 1,
    deployments: 5,
    replacements: 1,
    peaks: {
      activeEntities: 20,
    },
    assistanceTriggered: false,
    assistanceUsed: false,
  },
  {
    phaseId: "fase_01",
    strategyId: "balanced",
    seed: 2,
    loadout: ["colono"],
    outcome: "defeat",
    stars: 0,
    durationMs: 120000,
    integrity: 0,
    troopDeaths: 4,
    deployments: 6,
    replacements: 2,
    peaks: {
      activeEntities: 28,
    },
    assistanceTriggered: true,
    assistanceUsed: true,
  },
];

describe("relatório da campanha", () => {
  it("agrega execuções por fase", () => {
    const report = buildSimulationReport({
      results,
      phases: [{
        id: "fase_01",
        name: "Teste",
      }],
    });

    expect(report.phases)
      .toHaveLength(1);

    expect(report.phases[0].victoryRate)
      .toBe(.5);

    expect(report.phases[0]
      .recommendedLoadout)
      .toEqual(["colono"]);
  });

  it("gera CSV e Markdown", () => {
    const report = buildSimulationReport({
      results,
      phases: [{
        id: "fase_01",
        name: "Teste",
      }],
    });

    expect(reportToCsv(report))
      .toContain("phaseId");

    expect(reportToMarkdown(report))
      .toContain("Relatório de simulação");
  });
});
