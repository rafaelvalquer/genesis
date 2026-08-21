import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import ConvoyHud from "./components/ConvoyHud.jsx";
import ConvoyCheckpointOverlay from "./components/ConvoyCheckpointOverlay.jsx";

const convoy = {
  state: "sectorActive", hp: 780, hpMax: 1000, hpPercent: 78, progress: .42, sector: 2,
  escorted: true, underAttack: false, reserve: 56, reserveMax: 80, checkpointsReached: 1,
};

describe("Chapter 7 convoy UI", () => {
  it("renders every required HUD datum and a textual escort state", () => {
    render(<ConvoyHud convoy={convoy} energy={137} energyMax={200} />);
    const region = screen.getByRole("region", { name: "Status do transporte" });
    expect(region).toHaveAttribute("aria-live", "polite");
    expect(screen.getByText("780 / 1000")).toBeInTheDocument();
    expect(screen.getByText("42%")).toBeInTheDocument();
    expect(screen.getByText("2 / 4")).toBeInTheDocument();
    expect(screen.getByText("ESCOLTADO")).toBeInTheDocument();
    expect(screen.getByText("137 / 200")).toBeInTheDocument();
    expect(screen.getByText("56 / 80")).toBeInTheDocument();
    expect(screen.getByLabelText("1 de 3 checkpoints alcançados")).toBeInTheDocument();
  });

  it("does not rely on color for loss-of-escort or attack warnings", () => {
    const { rerender } = render(<ConvoyHud convoy={{ ...convoy, escorted: false }} energy={100} energyMax={200} />);
    expect(screen.getByText("SEM ESCOLTA")).toBeInTheDocument();
    rerender(<ConvoyHud convoy={{ ...convoy, underAttack: true }} energy={100} energyMax={200} />);
    expect(screen.getByText("SOB ATAQUE")).toBeInTheDocument();
  });

  it("shows checkpoint resources, focuses its keyboard action and starts explicitly", () => {
    const onStart = vi.fn();
    render(<ConvoyCheckpointOverlay convoy={{ ...convoy, state: "checkpointPreparation" }} supply="18/32" energy="140/200" onStart={onStart} />);
    expect(screen.getByRole("dialog", { name: "CHECKPOINT 1/3" })).toBeInTheDocument();
    expect(screen.getByText("140/200")).toBeInTheDocument();
    expect(screen.getByText("18/32")).toBeInTheDocument();
    const button = screen.getByRole("button", { name: "INICIAR SETOR 3" });
    expect(button).toHaveAttribute("aria-keyshortcuts", "Enter");
    expect(button).toHaveFocus();
    fireEvent.click(button);
    expect(onStart).toHaveBeenCalledOnce();
  });
});
