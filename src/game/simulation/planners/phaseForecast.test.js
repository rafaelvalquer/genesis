import {
  describe,
  expect,
  it,
} from "vitest";
import {
  PHASES,
} from "../../content.js";
import {
  createPhaseForecast,
  getCurrentWaveForecast,
} from "./phaseForecast.js";

describe("previsão de fase", () => {
  it("usa todas as ondas e cinco rotas", () => {
    const phase = PHASES[0];
    const forecast = createPhaseForecast(
      phase,
      1001,
    );

    expect(forecast.phaseId)
      .toBe(phase.id);

    expect(forecast.waveQueues)
      .toHaveLength(phase.waves.length);

    expect(forecast.laneThreat)
      .toHaveLength(5);

    expect(forecast.totalThreat)
      .toBeGreaterThan(0);
  });

  it("gera previsão isolada para a onda atual", () => {
    const phase = PHASES[0];
    const forecast = createPhaseForecast(
      phase,
      1001,
    );

    const wave = getCurrentWaveForecast(
      forecast,
      0,
    );

    expect(wave.laneThreat)
      .toHaveLength(5);

    expect(wave.totalThreat)
      .toBeGreaterThanOrEqual(0);
  });
});
