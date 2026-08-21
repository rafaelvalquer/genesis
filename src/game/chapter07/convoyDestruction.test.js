import { describe, expect, it } from "vitest";
import { createBattleSession, startWave, stepBattle } from "../battle/engine.js";
import { PHASES } from "../content.js";
import { CONVOY_DESTROYED_TRANSITION_MS, CONVOY_DEFEAT_RESULT_DELAY_MS } from "./convoyAnimationConfig.js";

function destroyedSession() {
  const session = createBattleSession(PHASES.find((phase) => phase.id === "fase_49"), ["colono"], 901);
  startWave(session);
  session.convoy.hp = 0;
  return session;
}

describe("destruição do transporte", () => {
  it("mantém a derrota pendente e inicia a transição", () => {
    const session = destroyedSession();
    const events = stepBattle(session, 32);

    expect(session.outcome).toBeNull();
    expect(session.pendingOutcome).toBe("defeat");
    expect(session.convoyFlow.state).toBe("destroying");
    expect(session.convoy.animation.state).toBe("destroyed_transition");
    expect(events.filter((event) => event.type === "convoyDestroyed")).toHaveLength(1);
  });

  it("troca para o loop e só finaliza depois do hold", () => {
    const session = destroyedSession();
    stepBattle(session, 32);
    const startedAt = session.convoyFlow.destroyingStartedAt;

    stepBattle(session, CONVOY_DESTROYED_TRANSITION_MS - 1);
    expect(session.outcome).toBeNull();
    expect(session.convoy.animation.state).toBe("destroyed_transition");

    stepBattle(session, 1);
    expect(session.outcome).toBeNull();
    expect(session.convoy.animation.state).toBe("destroyed_loop");
    expect(session.elapsed - startedAt).toBe(CONVOY_DESTROYED_TRANSITION_MS);

    stepBattle(session, CONVOY_DEFEAT_RESULT_DELAY_MS - CONVOY_DESTROYED_TRANSITION_MS - 1);
    expect(session.outcome).toBeNull();
    stepBattle(session, 1);
    expect(session.outcome).toBe("defeat");
    expect(session.pendingOutcome).toBeNull();
  });

  it("não repete o evento de destruição durante a animação", () => {
    const session = destroyedSession();
    const first = stepBattle(session, 32);
    const second = stepBattle(session, 32);

    expect(first.filter((event) => event.type === "convoyDestroyed")).toHaveLength(1);
    expect(second.filter((event) => event.type === "convoyDestroyed")).toHaveLength(0);
    expect(session.outcome).toBeNull();
  });
});
