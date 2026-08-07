import "@testing-library/jest-dom/vitest";
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { WaveOutroCinematicOverlay } from "./WaveOutroCinematicOverlay.jsx";

afterEach(cleanup);

const phase = { name: "Fase Teste", palette: { primary: "#38bdf8", accent: "#e0f2fe" } };

describe("overlay cinematográfico único", () => {
  it("renderiza shockwave em finalKill pelo elapsedMs", () => {
    const { container } = render(<WaveOutroCinematicOverlay outro={{
      status: "finalKill",
      elapsedMs: 230,
      finalWave: false,
      lastKill: { row: 2, cinematic: false, enemy: { type: "voltriz", x: 700 } },
    }} phase={phase} />);
    expect(container.querySelector(".wave-outro-impact-ring")).not.toBeNull();
  });

  it("usa letterbox pela flag finalWave", () => {
    const { container } = render(<WaveOutroCinematicOverlay outro={{
      status: "finalKill",
      elapsedMs: 260,
      finalWave: true,
      lastKill: { row: 2, cinematic: false, enemy: { type: "voltriz", x: 700 } },
    }} phase={phase} />);
    expect(container.querySelectorAll(".wave-outro-letterbox")).toHaveLength(2);
  });

  it("remove efeitos de movimento com reduceMotion mas mantém a mensagem", () => {
    const { container, getByText } = render(<WaveOutroCinematicOverlay outro={{
      status: "waveCompleteBanner",
      elapsedMs: 1300,
      finalWave: true,
      killed: 12,
      lastKill: { row: 2, cinematic: false, enemy: { type: "voltriz", x: 700 } },
    }} phase={phase} reduceMotion />);
    expect(getByText("PERÍMETRO ASSEGURADO")).toBeInTheDocument();
    expect(container.querySelector(".wave-outro-letterbox")).toBeNull();
    expect(container.querySelector(".wave-outro-impact-ring")).toBeNull();
  });
});
