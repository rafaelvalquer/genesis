import { describe, expect, it, vi } from "vitest";

import { drawDematerializationPulses } from "./pulseRenderer.js";

function createContext() {
  const gradient = { addColorStop: vi.fn() };
  return {
    save: vi.fn(),
    restore: vi.fn(),
    createLinearGradient: vi.fn(() => gradient),
    fillRect: vi.fn(),
    strokeRect: vi.fn(),
    setLineDash: vi.fn(),
    beginPath: vi.fn(),
    ellipse: vi.fn(),
    arc: vi.fn(),
    fill: vi.fn(),
    drawImage: vi.fn(),
    fillText: vi.fn(),
    roundRect: vi.fn(),
  };
}

describe("Pulso de Desmaterialização", () => {
  it("não desenha badges ou textos para nenhum estado", () => {
    const ctx = createContext();
    const frame = { width: 256, height: 256 };
    const assets = {
      idle: [frame],
      attack: [frame],
      dead: [frame],
    };
    const pulses = [
      { row: 0, state: "ready" },
      { row: 1, state: "charging", chargeStartedAt: 1_000, fireAt: 3_000 },
      { row: 2, state: "spent", fireAt: 900 },
    ];

    drawDematerializationPulses(ctx, pulses, assets, 1_500, { quality: "high" });

    expect(ctx.fillText).not.toHaveBeenCalled();
    expect(ctx.roundRect).not.toHaveBeenCalled();
  });
});
