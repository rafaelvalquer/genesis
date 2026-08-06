import {
  describe,
  expect,
  it,
} from "vitest";
import {
  aggregateCandidateScore,
  scoreSimulationResult,
} from "./simulationScoring.js";

describe("pontuação da IA", () => {
  it("prioriza vitória sobre derrota rápida", () => {
    const victory = scoreSimulationResult({
      outcome: "victory",
      stars: 1,
      integrity: 20,
      durationMs: 900000,
      troopDeaths: 20,
      assistanceUsed: true,
    });

    const defeat = scoreSimulationResult({
      outcome: "defeat",
      stars: 0,
      integrity: 0,
      durationMs: 30000,
      troopDeaths: 0,
      assistanceUsed: false,
    });

    expect(victory).toBeGreaterThan(defeat);
  });

  it("penaliza falhas técnicas fortemente", () => {
    expect(
      scoreSimulationResult({
        timeout: true,
      }),
    ).toBeLessThan(-1000000);
  });

  it("calcula taxa de vitória do candidato", () => {
    const aggregate = (
      aggregateCandidateScore([
        {
          outcome: "victory",
          stars: 2,
          integrity: 60,
          durationMs: 100000,
        },
        {
          outcome: "defeat",
          stars: 0,
          integrity: 0,
          durationMs: 120000,
        },
      ])
    );

    expect(aggregate.victoryRate)
      .toBe(.5);
  });
});
