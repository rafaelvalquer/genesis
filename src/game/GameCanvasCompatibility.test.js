import { describe, expect, it } from "vitest";
import GameCanvasDefault, * as facade from "./GameCanvas.jsx";
import { BattleScreen } from "./BattleScreen.jsx";
import { drawBattleRows, drawEnemyEntity, drawTroopEntity } from "./render/entityRenderer.js";

const EXPECTED_EXPORTS = [
  "BattleScreen",
  "CapsuleInteractionButton",
  "ColossusSpecialButtons",
  "DecisionModal",
  "FREE_HAND_ACTIVATED_MESSAGE",
  "FortuneChoiceModal",
  "SandboxPanel",
  "WaveOutroOverlay",
  "drawBattleRows",
  "drawEnemyEntity",
  "drawLeviathanBrineJet",
  "drawTroopEntity",
  "getThermalBannerText",
  "getWaveOutroCameraTransform",
  "isLeviathanShadowOnly",
  "isRasgamarShadowOnly",
  "resolveCanvasClickAction",
  "resolveInspectedTroopId",
];

describe("GameCanvas compatibility façade", () => {
  it("mantém BattleScreen como export default", () => {
    expect(GameCanvasDefault).toBe(BattleScreen);
  });

  it("preserva todos os exports públicos históricos", () => {
    for (const name of EXPECTED_EXPORTS) {
      expect(facade).toHaveProperty(name);
      expect(facade[name]).not.toBeUndefined();
    }
  });

  it("reexporta renderizadores a partir da fronteira correta", () => {
    expect(facade.drawBattleRows).toBe(drawBattleRows);
    expect(facade.drawEnemyEntity).toBe(drawEnemyEntity);
    expect(facade.drawTroopEntity).toBe(drawTroopEntity);
  });
});
