import { describe, expect, it, vi } from "vitest";
import { advanceBattleSimulation } from "./battleFrameSimulation.js";

describe("advanceBattleSimulation", () => {
  it("preserva passos fixos e a fração para interpolação", () => {
    const onStep = vi.fn();
    const accumulator = advanceBattleSimulation({ accumulator: 10, frameDelta: 70, onStep });

    expect(onStep).toHaveBeenCalledTimes(2);
    expect(onStep).toHaveBeenNthCalledWith(1, 32);
    expect(accumulator).toBe(16);
  });

  it("não acumula enquanto a simulação está pausada", () => {
    const onStep = vi.fn();
    expect(advanceBattleSimulation({ accumulator: 11, frameDelta: 100, paused: true, onStep })).toBe(11);
    expect(onStep).not.toHaveBeenCalled();
  });
});
