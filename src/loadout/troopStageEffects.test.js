import { describe, expect, it } from "vitest";
import {
  getTroopStageEffectStyle,
  normalizeTroopStageCharacterBounds,
  translatePreviewLayoutToStage,
} from "./troopStageEffects.js";

describe("efeitos ancorados do palco de tropas", () => {
  it("traduz os limites do sprite para coordenadas do palco", () => {
    const bounds = translatePreviewLayoutToStage({
      layout: {
        body: {
          left: 20,
          top: 12,
          right: 220,
          bottom: 410,
        },
      },
      frameRect: {
        left: 150,
        top: 80,
      },
      stageRect: {
        left: 100,
        top: 30,
        width: 800,
        height: 600,
      },
    });

    expect(bounds).toMatchObject({
      left: 70,
      top: 62,
      right: 270,
      bottom: 460,
      centerX: 170,
      footY: 460,
    });
  });

  it("posiciona o efeito do chão exatamente junto aos pés", () => {
    const bounds = normalizeTroopStageCharacterBounds({
      stageWidth: 900,
      stageHeight: 640,
      left: 260,
      top: 74,
      right: 610,
      bottom: 548,
    });
    const style = getTroopStageEffectStyle(bounds);

    expect(style["--character-center-x"]).toBe("435px");
    expect(style["--character-foot-y"]).toBe("548px");
    expect(
      Number.parseFloat(
        style["--character-floor-width"],
      ),
    ).toBeGreaterThan(bounds.width);
  });

  it("mantém todos os valores dentro do palco", () => {
    const bounds = normalizeTroopStageCharacterBounds({
      stageWidth: 700,
      stageHeight: 500,
      left: -80,
      top: -40,
      right: 900,
      bottom: 720,
    });

    expect(bounds.left).toBe(0);
    expect(bounds.top).toBe(0);
    expect(bounds.right).toBe(700);
    expect(bounds.bottom).toBe(500);
  });
});
