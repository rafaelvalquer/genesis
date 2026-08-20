import { afterEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { getPhase } from "../game/content.js";
import CommandPhaseMarker from "./CommandPhaseMarker.jsx";

afterEach(cleanup);

describe("marcador orbital da tela Comando", () => {
  it("seleciona uma missão concluída sem iniciar o arraste do planeta", () => {
    const phase = getPhase("fase_01");
    const onSelect = vi.fn();
    const onStagePointerDown = vi.fn();
    const onStageClick = vi.fn();

    render(
      <div
        onPointerDown={onStagePointerDown}
        onClick={onStageClick}
      >
        <CommandPhaseMarker
          phase={phase}
          campaign={{
            unlockedPhaseIndex: 7,
            currentPhaseId: "fase_08",
            phaseStats: {
              fase_01: {
                victories: 1,
                bestStars: 3,
              },
            },
          }}
          selected={false}
          register={() => {}}
          onSelect={onSelect}
        />
      </div>,
    );

    const marker = screen.getByRole("button", {
      name: /Operação 01, Perímetro Leste/i,
    });

    expect(marker).not.toBeDisabled();

    fireEvent.pointerDown(marker, {
      pointerId: 1,
      clientX: 100,
      clientY: 100,
    });
    fireEvent.pointerUp(marker, {
      pointerId: 1,
      clientX: 100,
      clientY: 100,
    });
    fireEvent.click(marker);

    expect(onStagePointerDown).not.toHaveBeenCalled();
    expect(onStageClick).not.toHaveBeenCalled();
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith(phase);
  });

  it("mantém missão bloqueada sem interação", () => {
    const phase = getPhase("fase_09");
    const onSelect = vi.fn();

    render(
      <CommandPhaseMarker
        phase={phase}
        campaign={{
          unlockedPhaseIndex: 0,
          currentPhaseId: "fase_01",
          phaseStats: {},
        }}
        selected={false}
        register={() => {}}
        onSelect={onSelect}
      />,
    );

    const marker = screen.getByRole("button", {
      name: /Operação 09/i,
    });

    expect(marker).toBeDisabled();
    fireEvent.click(marker);
    expect(onSelect).not.toHaveBeenCalled();
  });
});
