import { describe, expect, it } from "vitest";
import {
  drawEnvironmentLayer,
  getEnvironmentRenderer,
  registerEnvironmentRenderer,
} from "./environmentRenderer.js";

describe("environment renderer registry", () => {
  it("desenha somente os sistemas listados no plano e mantém sua ordem", () => {
    const calls = [];
    const suffix = `${Date.now()}-${Math.random()}`;
    const first = `first-${suffix}`;
    const second = `second-${suffix}`;
    registerEnvironmentRenderer(first, () => calls.push(first));
    registerEnvironmentRenderer(second, () => calls.push(second));

    drawEnvironmentLayer({ scene: { renderPlan: { environments: [second, "absent", first] } } });

    expect(calls).toEqual([second, first]);
    expect(getEnvironmentRenderer("absent")).toBeNull();
  });

  it("repassa o estágio de composição sem alterar a ordem do plano", () => {
    const calls = [];
    const suffix = `${Date.now()}-${Math.random()}`;
    const behind = `behind-${suffix}`;
    const ahead = `ahead-${suffix}`;
    registerEnvironmentRenderer(behind, ({ stage }) => {
      if (stage === "entitiesBefore") calls.push(behind);
    });
    registerEnvironmentRenderer(ahead, ({ stage }) => {
      if (stage === "entitiesAfter") calls.push(ahead);
    });

    const scene = { renderPlan: { environments: [behind, ahead] } };
    drawEnvironmentLayer({ scene, stage: "entitiesBefore" });
    drawEnvironmentLayer({ scene, stage: "entitiesAfter" });

    expect(calls).toEqual([behind, ahead]);
  });

  it("protege contra registros duplicados sem replace explícito", () => {
    const name = `duplicate-${Date.now()}-${Math.random()}`;
    registerEnvironmentRenderer(name, () => {});
    expect(() => registerEnvironmentRenderer(name, () => {})).toThrow("already registered");
  });

  it("permite substituir um renderer somente de forma explícita", () => {
    const name = `replace-${Date.now()}-${Math.random()}`;
    const original = () => {};
    const replacement = () => {};
    registerEnvironmentRenderer(name, original);
    registerEnvironmentRenderer(name, replacement, { replace: true });
    expect(getEnvironmentRenderer(name)).toBe(replacement);
  });
});
