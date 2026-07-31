import { describe, expect, it } from "vitest";
import {
  getTroopStageEffectStyle,
  normalizeTroopStageCharacterBounds,
} from "./troopStageEffects.js";

describe("contrato visual do efeito de interação", () => {
  it("gera variáveis para cabeça, centro e pés", () => {
    const style = getTroopStageEffectStyle(
      normalizeTroopStageCharacterBounds({
        stageWidth: 1000,
        stageHeight: 700,
        left: 300,
        top: 90,
        right: 690,
        bottom: 610,
      }),
    );

    expect(style).toEqual(
      expect.objectContaining({
        "--character-head-y": "90px",
        "--character-foot-y": "610px",
        "--character-center-x": "495px",
        "--character-center-y": "350px",
      }),
    );
  });
});
