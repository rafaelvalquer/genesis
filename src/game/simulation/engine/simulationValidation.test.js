import {
  describe,
  expect,
  it,
} from "vitest";
import {
  SimulationValidationError,
  StagnationDetector,
  validateSimulationState,
} from "./simulationValidation.js";

function sessionStub() {
  return {
    phase: {
      id: "fase_teste",
      waves: [{}],
    },
    elapsed: 100,
    energy: 10,
    integrity: 100,
    supply: 20,
    waveIndex: 0,
    waveActive: false,
    queue: [],
    troops: [],
    enemies: [],
    projectiles: [],
    enemyProjectiles: [],
    mines: [],
    energyPickups: [],
    killed: 0,
    pendingDecision: null,
    waveOutro: {
      status: "idle",
    },
    adaptiveAid: {
      status: "idle",
    },
    pendingOutcome: null,
    outcome: null,
    result: null,
  };
}

describe("validação da simulação", () => {
  it("aceita uma sessão consistente", () => {
    expect(
      validateSimulationState(
        sessionStub(),
      ),
    ).toBe(true);
  });

  it("rejeita valores não finitos", () => {
    const session = sessionStub();
    session.energy = Number.NaN;

    expect(() => (
      validateSimulationState(session)
    )).toThrow(
      SimulationValidationError,
    );
  });

  it("detecta estagnação", () => {
    const session = sessionStub();
    const detector = (
      new StagnationDetector(1000)
    );

    detector.update(session);
    session.elapsed = 1200;

    expect(
      detector.update(session).stagnant,
    ).toBe(true);
  });
});
