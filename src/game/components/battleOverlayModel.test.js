import { describe, expect, it } from "vitest";
import { createBattleOverlayModel } from "./battleOverlayModel.js";

describe("createBattleOverlayModel", () => {
  it("expõe apenas dados derivados, sem vazar a sessão mutável para overlays", () => {
    const session = {
      elapsed: 120,
      waveActive: true,
      troops: [{ id: "colosso", type: "colossoImpacto", dead: false, specialReadyAt: 120, x: 100, y: 200, row: 2 }],
      dematerializationPulses: [],
    };
    const snapshot = { convoy: null, progressionMode: "standard" };
    const model = createBattleOverlayModel({
      snapshot,
      notification: { text: "Pronto", tone: "info" },
      fortuneBlocksIntermission: false,
      session,
    });

    expect(model.snapshot).toBe(snapshot);
    expect(model).not.toHaveProperty("session");
    expect(model.colossusControls).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: "colosso", row: 2 }),
    ]));
  });
});
