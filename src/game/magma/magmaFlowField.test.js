import { describe, expect, it } from "vitest";
import { getMagmaFlowFrame } from "./magmaFlowField.js";

const region = { seed: 4141 };
const visualConfig = { flow: { x: -1, y: 0.025 }, speed: 26 };

describe("fluxo de magma", () => {
  it("desloca deterministicamente para a esquerda em 1 e 5 segundos", () => {
    const first = getMagmaFlowFrame({ region, visualConfig, thermalState: "active", time: 1000 });
    const fifth = getMagmaFlowFrame({ region, visualConfig, thermalState: "active", time: 5000 });

    expect(first.offsetX).toBeCloseTo(-26, 4);
    expect(first.offsetY).toBeCloseTo(0.65, 4);
    expect(fifth.offsetX).toBeCloseTo(-130, 4);
    expect(first).toEqual(getMagmaFlowFrame({ region, visualConfig, thermalState: "active", time: 1000 }));
  });

  it("mantém as velocidades térmicas e o modo de movimento reduzido", () => {
    const stable = getMagmaFlowFrame({ region, visualConfig, thermalState: "stable", time: 1000 });
    const active = getMagmaFlowFrame({ region, visualConfig, thermalState: "active", time: 1000 });
    const eruption = getMagmaFlowFrame({ region, visualConfig, thermalState: "eruption", time: 1000 });
    const cooldown = getMagmaFlowFrame({ region, visualConfig, thermalState: "cooldown", time: 1000 });
    const reduced = getMagmaFlowFrame({
      region, visualConfig, thermalState: "active", time: 1000, reduceMotion: true,
    });

    expect(stable.speed).toBeCloseTo(18.72, 4);
    expect(active.speed).toBeCloseTo(26, 4);
    expect(eruption.speed).toBeCloseTo(35.1, 4);
    expect(cooldown.speed).toBeCloseTo(13, 4);
    expect(reduced.speed).toBeCloseTo(3.12, 4);
  });

  it("faz o multiplicador zero interromper somente o deslocamento", () => {
    const stopped = getMagmaFlowFrame({
      region,
      visualConfig: { ...visualConfig, flowMultiplier: 0 },
      thermalState: "eruption",
      time: 5000,
    });

    expect(stopped.speed).toBe(0);
    expect(stopped.primaryTravel).toBe(0);
    expect(stopped.offsetX).toBeCloseTo(0, 8);
    expect(stopped.offsetY).toBeCloseTo(0, 8);
  });
});
