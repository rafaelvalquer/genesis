import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import ConvoyHud from "./components/ConvoyHud.jsx";
import ConvoyPreparationPanel from "./components/ConvoyPreparationPanel.jsx";
import ConvoySectorCountdown from "./components/ConvoySectorCountdown.jsx";

const convoy = {
  state: "sectorActive", hp: 780, hpMax: 1000, hpPercent: 78, progress: .42, sector: 2,
  escorted: true, underAttack: false, reserve: 56, reserveMax: 80, checkpointsReached: 1,
};

describe("Chapter 7 convoy UI", () => {
  afterEach(cleanup);
  it("renders every required HUD datum and a textual escort state", () => {
    render(<ConvoyHud convoy={convoy} energy={137} energyMax={200} />);
    const region = screen.getByRole("region", { name: "Status do transporte" });
    expect(region).not.toHaveAttribute("aria-live");
    expect(screen.getByLabelText("Integridade do transporte")).toHaveTextContent("780");
    expect(screen.getByText("42%")).toBeInTheDocument();
    expect(screen.getByText("SETOR 2 / 4")).toBeInTheDocument();
    expect(screen.getByText("ESCOLTA ATIVA")).toBeInTheDocument();
    expect(screen.getByText(/137\s*\/\s*200/)).toBeInTheDocument();
    expect(screen.getByText(/56\s*\/\s*80/)).toBeInTheDocument();
    expect(screen.getByLabelText("1 de 3 checkpoints alcançados")).toBeInTheDocument();
  });

  it("does not rely on color for loss-of-escort or attack warnings", () => {
    const { rerender } = render(<ConvoyHud convoy={{ ...convoy, escorted: false }} energy={100} energyMax={200} />);
    expect(screen.getByText("SEM ESCOLTA")).toBeInTheDocument();
    rerender(<ConvoyHud convoy={{ ...convoy, underAttack: true }} energy={100} energyMax={200} />);
    expect(screen.getByText("SOB ATAQUE")).toBeInTheDocument();
  });

  it("renders preparation as a compact non-modal panel without autofocus", () => {
    const onStart = vi.fn();
    render(<ConvoyPreparationPanel convoy={{ ...convoy, state: "checkpointPreparation", escorted: true, escortCount: 2 }} supply={18} supplyMax={32} onStart={onStart} />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    const button = screen.getByRole("button", { name: "INICIAR SETOR 3" });
    expect(button).not.toHaveFocus();
    fireEvent.click(button);
    expect(onStart).toHaveBeenCalledOnce();
    expect(screen.getAllByText("ESCOLTA ATIVA").length).toBeGreaterThan(0);
  });

  it("confirms starting without escort and exposes countdown state", () => {
    const onStart = vi.fn();
    const { rerender } = render(<ConvoyPreparationPanel convoy={{ ...convoy, state: "checkpointPreparation", escorted: false, escortCount: 0 }} supply={18} supplyMax={32} onStart={onStart} />);
    fireEvent.click(screen.getByRole("button", { name: "INICIAR SETOR 3" }));
    expect(screen.getByText(/O comboio permanecerá parado/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "INICIAR MESMO ASSIM" }));
    expect(onStart).toHaveBeenCalledOnce();
    rerender(<ConvoySectorCountdown convoy={{ ...convoy, state: "sectorCountdown", countdownRemainingMs: 1600 }} />);
    expect(screen.getByRole("status")).toHaveTextContent("2");
  });
});
