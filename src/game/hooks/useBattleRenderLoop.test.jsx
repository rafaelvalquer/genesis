import { afterEach, describe, expect, it, vi } from "vitest";
import { createBattleAnimationScheduler } from "./useBattleRenderLoop.js";

const originalRequest = globalThis.requestAnimationFrame;
const originalCancel = globalThis.cancelAnimationFrame;

afterEach(() => {
  globalThis.requestAnimationFrame = originalRequest;
  globalThis.cancelAnimationFrame = originalCancel;
});

describe("battle animation scheduler", () => {
  it("mantém um único frame pendente e o cancela no encerramento", () => {
    const request = vi.fn(() => 42);
    const cancel = vi.fn();
    globalThis.requestAnimationFrame = request;
    globalThis.cancelAnimationFrame = cancel;
    const scheduler = createBattleAnimationScheduler();
    const frame = vi.fn();

    expect(scheduler.request(frame)).toBe(42);
    expect(request).toHaveBeenCalledWith(frame);
    scheduler.stop();
    expect(cancel).toHaveBeenCalledWith(42);
  });
});
