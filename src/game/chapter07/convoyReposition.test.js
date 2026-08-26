import { describe, expect, it } from "vitest";
import { repositionTroop } from "./convoyReposition.js";

describe("convoy reposition and ferrivore trees", () => {
  it("rejects a checkpoint destination occupied by a living tree", () => {
    const troop = { id: "troop_1", type: "marine", row: 1, col: 1, x: 96, y: 180, dead: false };
    const session = {
      convoyFlow: { state: "checkpointPreparation" },
      phase: { startingTroopRules: {} },
      troops: [troop],
      forestObstacles: [{ id: "tree_1", row: 1, col: 3, alive: true }],
    };
    expect(repositionTroop(session, troop.id, 1, 3)).toEqual(expect.objectContaining({ ok: false }));
    expect(repositionTroop(session, troop.id, 1, 2)).toEqual(expect.objectContaining({ ok: true }));
  });
});
