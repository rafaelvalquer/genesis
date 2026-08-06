import fs from "node:fs";
import path from "node:path";
import {
  describe,
  expect,
  it,
} from "vitest";

const root = process.cwd();

function source(relativePath) {
  return fs.readFileSync(
    path.join(root, relativePath),
    "utf8",
  );
}

describe("contrato do simulador de campanha", () => {
  it("executa o motor real sem importar a interface", () => {
    const runner = source(
      "src/game/simulation/engine/runSimulation.js",
    );

    const actions = source(
      "src/game/simulation/engine/simulationActions.js",
    );

    expect(runner).toContain(
      "stepBattle",
    );

    expect(runner).toContain(
      "advanceWaveOutro",
    );

    expect(actions).toContain(
      "placeTroop",
    );

    expect(actions).toContain(
      "selectDecision",
    );

    expect(runner).not.toContain(
      "GameCanvas",
    );

    expect(runner).not.toContain(
      "requestAnimationFrame",
    );
  });

  it("possui IA estratégica e otimizador", () => {
    const agent = source(
      "src/game/simulation/ai/StrategicAgent.js",
    );

    const optimizer = source(
      "src/game/simulation/optimization/PolicyOptimizer.js",
    );

    expect(agent).toContain(
      "planPlacementActions",
    );

    expect(agent).toContain(
      "planSpecialActions",
    );

    expect(agent).toContain(
      "planReplacementActions",
    );

    expect(optimizer).toContain(
      "mutateGenome",
    );

    expect(optimizer).toContain(
      "crossover",
    );
  });

  it("possui comandos para fase, campanha e otimização", () => {
    const packageJson = JSON.parse(
      source("package.json"),
    );

    expect(
      packageJson.scripts[
        "simulate:phase"
      ],
    ).toBeTruthy();

    expect(
      packageJson.scripts[
        "simulate:campaign"
      ],
    ).toBeTruthy();

    expect(
      packageJson.scripts[
        "optimize:campaign"
      ],
    ).toBeTruthy();
  });
});
