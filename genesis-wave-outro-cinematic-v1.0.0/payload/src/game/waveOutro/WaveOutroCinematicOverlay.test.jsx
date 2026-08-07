import "@testing-library/jest-dom/vitest";
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { WaveOutroCinematicOverlay } from "./WaveOutroCinematicOverlay.jsx";

afterEach(cleanup);

describe("overlay cinematográfico", () => {
  it("usa letterbox somente no encerramento da missão", () => {
    const { container, rerender } = render(<WaveOutroCinematicOverlay outro={{
      status: "finalKill", elapsedMs: 230, finalWave: false,
      lastKill: { row: 2, enemy: { x: 700 } },
    }} palette={{ primary: "#38bdf8", accent: "#e0f2fe" }} />);
    expect(container.querySelector(".wave-outro-letterbox")).toBeNull();
    expect(container.querySelector(".wave-outro-impact-ring")).not.toBeNull();

    rerender(<WaveOutroCinematicOverlay outro={{
      status: "finalKill", elapsedMs: 230, finalWave: true,
      lastKill: { row: 2, enemy: { x: 700 } },
    }} palette={{ primary: "#38bdf8", accent: "#e0f2fe" }} />);
    expect(container.querySelectorAll(".wave-outro-letterbox")).toHaveLength(2);
  });
});
