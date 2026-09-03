import { describe, expect, it } from "vitest";
import { PHASES } from "./content.js";
import { createBattleSession, getSnapshot, placeTroop, startWave, stepBattle } from "./battleModel.js";

function runScenario(seed) {
  const session = createBattleSession(PHASES[0], ["marine", "sniper"], seed, { sandbox: true });
  placeTroop(session, "marine", 0, 1);
  placeTroop(session, "sniper", 2, 2);
  startWave(session);
  const timeline = [];
  for (let tick = 0; tick < 90; tick += 1) {
    const events = stepBattle(session, 32);
    timeline.push(events.map((event) => event.type));
  }
  const snapshot = getSnapshot(session);
  return {
    timeline,
    energy: snapshot.energy,
    integrity: snapshot.integrity,
    enemies: snapshot.enemies,
    queued: snapshot.queued,
    troopHp: session.troops.map((troop) => troop.hp),
  };
}

describe("BattleScreen render boundary", () => {
  it("não muda o resultado determinístico da simulação", () => {
    expect(runScenario(44102)).toEqual(runScenario(44102));
  });
});
