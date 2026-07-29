import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import PhaseMarker from "./PhaseMarker.jsx";

afterEach(cleanup);

describe("marcador de fase", () => {
  it("não deixa o controle de arraste do planeta capturar o clique", () => {
    const onPlanetPointerDown = vi.fn();
    const onPlanetPointerMove = vi.fn();
    const onPlanetPointerUp = vi.fn();
    const onSelect = vi.fn();
    const phase = {
      id: "fase_02",
      name: "Floresta Exterior",
      subtitle: "Movimento sob neblina",
      boss: false,
    };

    render(<div
      onPointerDown={onPlanetPointerDown}
      onPointerMove={onPlanetPointerMove}
      onPointerUp={onPlanetPointerUp}
    >
      <PhaseMarker
        phase={phase}
        index={1}
        locked={false}
        selected={false}
        completed={false}
        stars={0}
        current={false}
        registerMarker={vi.fn()}
        onSelect={onSelect}
        reduceMotion
      />
    </div>);

    const marker = screen.getByRole("button", { name: /Floresta Exterior/ });
    fireEvent.pointerDown(marker, { pointerId: 1, clientX: 120, clientY: 80 });
    fireEvent.pointerMove(marker, { pointerId: 1, clientX: 121, clientY: 80 });
    fireEvent.pointerUp(marker, { pointerId: 1, clientX: 121, clientY: 80 });
    fireEvent.click(marker);

    expect(onPlanetPointerDown).not.toHaveBeenCalled();
    expect(onPlanetPointerMove).not.toHaveBeenCalled();
    expect(onPlanetPointerUp).not.toHaveBeenCalled();
    expect(onSelect).toHaveBeenCalledOnce();
    expect(onSelect).toHaveBeenCalledWith(phase);
  });
});
