import "@testing-library/jest-dom/vitest";
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createRef } from "react";
import BattleCanvas from "./BattleCanvas.jsx";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("BattleCanvas", () => {
  it("owns the animation-frame lifecycle while the canvas is ready", () => {
    const request = vi.fn(() => 41);
    const cancel = vi.fn();
    vi.stubGlobal("requestAnimationFrame", request);
    vi.stubGlobal("cancelAnimationFrame", cancel);
    const { unmount } = render(<BattleCanvas
      canvasRef={createRef()}
      ready
      label="Campo"
      onFrame={() => {}}
    />);

    expect(request).toHaveBeenCalledTimes(1);
    unmount();
    expect(cancel).toHaveBeenCalledWith(41);
  });
});
