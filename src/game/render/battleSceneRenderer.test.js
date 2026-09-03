import { describe, expect, it, vi } from "vitest";
import { BATTLE_RENDER_STAGES, createBattleRenderPlan, renderBattleScene } from "./battleSceneRenderer.js";

describe("battle scene renderer", () => {
  it("preserva o contrato explícito de z-order", () => {
    const order = [];
    renderBattleScene({}, Object.fromEntries(BATTLE_RENDER_STAGES.map((name) => [name, () => order.push(name)])));
    expect(order).toEqual(BATTLE_RENDER_STAGES);
  });

  it("resolve sistemas de ambiente uma vez por fase", () => {
    expect(createBattleRenderPlan({ chapterId: "chapter_07" }).environments).toEqual(["forest", "spores", "convoy"]);
    expect(createBattleRenderPlan({ chapterId: "chapter_02" }).environments).toEqual([]);
  });

  it("não chama uma etapa ausente", () => {
    const background = vi.fn();
    renderBattleScene({}, { background });
    expect(background).toHaveBeenCalledOnce();
  });

  it("entrega a sessão como dado de leitura ao estágio", () => {
    const session = Object.freeze({ elapsed: 42, enemies: Object.freeze([]) });
    const scene = Object.freeze({ session });
    const draw = vi.fn((context) => expect(context.scene.session).toBe(session));

    renderBattleScene({ scene }, { entities: draw });

    expect(draw).toHaveBeenCalledOnce();
    expect(session.elapsed).toBe(42);
  });
});
