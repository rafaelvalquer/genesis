import { describe, expect, it } from "vitest";
import { createBattleSession, placeTroop, startWave, stepBattle } from "./battleModel.js";
import { PHASES } from "./content.js";
import { renderBattleScene } from "./render/battleSceneRenderer.js";

function digest(session) {
  return {
    elapsed: session.elapsed,
    wave: session.wave,
    waveActive: session.waveActive,
    energy: session.energy,
    supply: session.supply,
    integrity: session.integrity,
    result: session.result,
    troops: session.troops.map(({ type, row, col, hp, state }) => ({ type, row, col, hp, state })),
    enemies: session.enemies.map(({ type, row, hp, x, y, dead }) => ({ type, row, hp, x, y, dead })),
    projectiles: session.projectiles.map(({ kind, x, y, active }) => ({ kind, x, y, active })),
  };
}

function createScenario() {
  const session = createBattleSession(PHASES[0], ["marine"], 8128);
  expect(placeTroop(session, "marine", 0, 1).ok).toBe(true);
  expect(startWave(session)).toBe(true);
  return session;
}

function run({ render = false } = {}) {
  const session = createScenario();
  const renderedSnapshots = [];
  for (let index = 0; index < 48; index += 1) {
    stepBattle(session, 32);
    if (render) {
      renderBattleScene({ session }, {
        background: ({ session: current }) => renderedSnapshots.push(current.elapsed),
        entities: ({ session: current }) => current.troops.length + current.enemies.length,
        projectiles: ({ session: current }) => current.projectiles.length,
      });
    }
  }
  return { state: digest(session), renderedSnapshots };
}

describe("determinismo headless × renderizado", () => {
  it("mantém o estado de gameplay idêntico quando o pipeline visual é executado entre ticks", () => {
    const headless = run();
    const rendered = run({ render: true });

    expect(rendered.state).toEqual(headless.state);
    expect(rendered.renderedSnapshots).toHaveLength(48);
  });
});
