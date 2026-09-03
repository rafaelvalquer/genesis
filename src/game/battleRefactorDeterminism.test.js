import { describe, expect, it } from "vitest";
import { PHASES } from "./content.js";
import { createBattleSession, placeTroop, startWave, stepBattle } from "./battleModel.js";

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

describe("determinismo após o refactor visual", () => {
  it("mantém o mesmo resultado com seed e ações idênticas", () => {
    const run = () => {
      const session = createBattleSession(PHASES[0], ["marine"], 8128);
      expect(placeTroop(session, "marine", 0, 1).ok).toBe(true);
      expect(startWave(session)).toBe(true);
      const events = [];
      for (let index = 0; index < 48; index += 1) {
        events.push(...stepBattle(session, 32).map((event) => event.type));
      }
      return { events, state: digest(session) };
    };

    expect(run()).toEqual(run());
  });
});
