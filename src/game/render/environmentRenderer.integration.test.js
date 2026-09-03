import { describe, expect, it } from "vitest";
import "./battleLayerRenderers.js";
import { getEnvironmentRenderer } from "./environmentRenderer.js";
import { createBattleRenderPlan } from "./battleSceneRenderer.js";

describe("phase environment renderer integration", () => {
  it.each(["forest", "spores", "convoy", "wind", "tide", "thermal"])(
    "registra o sistema visual %s",
    (name) => {
      expect(getEnvironmentRenderer(name)).toEqual(expect.any(Function));
    },
  );

  it("resolve apenas os sistemas do capítulo ativo", () => {
    expect(createBattleRenderPlan({ chapterId: "chapter_04", environment: "wind" }).environments).toEqual(["wind"]);
    expect(createBattleRenderPlan({ chapterId: "chapter_05", environment: "tide" }).environments).toEqual(["tide"]);
    expect(createBattleRenderPlan({ chapterId: "chapter_06", environment: "thermal" }).environments).toEqual(["thermal"]);
    expect(createBattleRenderPlan({ chapterId: "chapter_07", environment: "forest" }).environments).toEqual(["forest", "spores", "convoy"]);
  });
});
