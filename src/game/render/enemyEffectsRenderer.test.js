import { describe, expect, it, vi } from "vitest";
import { drawProceduralGlassEnemy } from "./enemyEffectsRenderer.js";

function canvasContext() {
  const gradient = { addColorStop: vi.fn() };
  return {
    createLinearGradient: vi.fn(() => gradient), beginPath: vi.fn(), closePath: vi.fn(),
    moveTo: vi.fn(), lineTo: vi.fn(), quadraticCurveTo: vi.fn(), arc: vi.fn(),
    fill: vi.fn(), stroke: vi.fn(), fillRect: vi.fn(), save: vi.fn(), restore: vi.fn(),
    translate: vi.fn(), set fillStyle(value) {}, set strokeStyle(value) {},
    set lineWidth(value) {}, set filter(value) {}, set shadowBlur(value) {}, set shadowColor(value) {},
  };
}

describe("enemy effects renderer", () => {
  it("mantém o fallback de inimigos de vidro no renderer dedicado", () => {
    const ctx = canvasContext();
    expect(drawProceduralGlassEnemy(ctx, { x: 0, y: 0 }, {}, 0)).toBe(false);
    expect(drawProceduralGlassEnemy(ctx, { x: 10, y: 20, row: 1, scale: 1 }, { proceduralKind: "estilha", color: "#7fffd4" }, 100)).toBe(true);
    expect(ctx.save).toHaveBeenCalledOnce();
    expect(ctx.fill).toHaveBeenCalled();
  });
});
