import { describe, expect, it } from "vitest";
import { buildSimulationReport, reportToCsv, reportToMarkdown } from "./SimulationReport.js";

const results = [
  { phaseId: "fase_01", strategyId: "balanced", seed: 1, loadout: ["colono"], outcome: "victory", stars: 2, durationMs: 100000, integrity: 70, troopDeaths: 1, deployments: 5, replacements: 1, peaks: { activeEntities: 20 }, assistanceTriggered: false, assistanceUsed: false, dematerializationPulse: { activations: 2, aiActivations: 1, automaticActivations: 1, damage: 800, kills: 1 } },
  { phaseId: "fase_01", strategyId: "balanced", seed: 2, loadout: ["colono"], outcome: "defeat", stars: 0, durationMs: 120000, integrity: 0, troopDeaths: 4, deployments: 6, replacements: 2, peaks: { activeEntities: 28 }, assistanceTriggered: true, assistanceUsed: true, dematerializationPulse: { activations: 0, aiActivations: 0, automaticActivations: 0, damage: 0, kills: 0 } },
];

describe("campaign simulation report", () => {
  const report = () => buildSimulationReport({ results, phases: [{ id: "fase_01", name: "Teste" }] });

  it("aggregates results and pulse telemetry per phase", () => {
    const phase = report().phases[0];
    expect(phase.victoryRate).toBe(.5);
    expect(phase.recommendedLoadout).toEqual(["colono"]);
    expect(phase).toMatchObject({
      averagePulseActivations: 1, aiPulseActivationRate: .5, automaticPulseActivationRate: .5,
      averagePulseDamage: 400, averagePulseKills: .5,
      averageDamagePerActivation: 400, averageKillsPerActivation: .5,
    });
  });

  it("includes pulse telemetry in CSV and Markdown", () => {
    const value = report();
    expect(reportToCsv(value)).toContain("averagePulseActivations");
    expect(reportToMarkdown(value)).toContain("Telemetria do pulso de desmaterializa\u00e7\u00e3o");
  });

  it("returns zero derived averages without pulse activations", () => {
    const emptyPulseReport = buildSimulationReport({
      results: [{ ...results[1], phaseId: "fase_02" }],
      phases: [{ id: "fase_02", name: "Sem pulso" }],
    });
    expect(emptyPulseReport.phases[0]).toMatchObject({
      averagePulseActivations: 0,
      aiPulseActivationRate: 0,
      automaticPulseActivationRate: 0,
      averageDamagePerActivation: 0,
      averageKillsPerActivation: 0,
    });
  });
});
