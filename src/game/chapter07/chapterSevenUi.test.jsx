import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import ConvoyCheckpointOverlay from "./components/ConvoyCheckpointOverlay.jsx";
import ConvoySectorCountdown from "./components/ConvoySectorCountdown.jsx";
import { getConvoyAttackSummary } from "./convoySummary.js";

const convoy = {
  state: "sectorActive", hp: 780, hpMax: 1000, hpPercent: 78, progress: .42, sector: 2,
  escorted: true, underAttack: false, reserve: 56, reserveMax: 80, checkpointsReached: 1,
};

describe("Chapter 7 convoy UI", () => {
  afterEach(cleanup);
  it("resolves convoy attack text in the existing field summary", () => {
    expect(getConvoyAttackSummary({ ...convoy, underAttack: false }, 6)).toBeNull();
    expect(getConvoyAttackSummary({ ...convoy, underAttack: true, damageState: "heavy" }, 6)).toBe("⚠ TRANSPORTE SOB ATAQUE · 6 HOSTIS RESTANTES");
    expect(getConvoyAttackSummary({ ...convoy, underAttack: true, damageState: "critical" }, 6)).toBe("⚠ TRANSPORTE CRÍTICO SOB ATAQUE · 6 HOSTIS RESTANTES");
  });

  it("renders the centered checkpoint briefing without autofocus", () => {
    const onContinue = vi.fn();
    render(<ConvoyCheckpointOverlay convoy={{ ...convoy, state: "checkpointDecision", checkpointBriefingPending: true, checkpointOptionChosen: true, nextSector: 3 }} onContinue={onContinue} />);
    expect(screen.getByRole("dialog")).toHaveAttribute("aria-modal", "true");
    const button = screen.getByRole("button", { name: "PREPARAR SETOR 3" });
    expect(button).not.toHaveFocus();
    fireEvent.click(button);
    expect(onContinue).toHaveBeenCalledOnce();
    expect(screen.queryByRole("button", { name: "INICIAR SETOR 3" })).not.toBeInTheDocument();
  });

  it("does not render the briefing after acknowledgement", () => {
    const { rerender } = render(<ConvoyCheckpointOverlay convoy={{ ...convoy, state: "checkpointDecision", checkpointBriefingPending: true, nextSector: 3 }} onContinue={vi.fn()} />);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    rerender(<ConvoyCheckpointOverlay convoy={{ ...convoy, state: "checkpointPreparation", checkpointBriefingPending: false, nextSector: 3 }} onContinue={vi.fn()} />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("exposes countdown state after the standard start control is used", () => {
    render(<ConvoySectorCountdown convoy={{ ...convoy, state: "sectorCountdown", countdownRemainingMs: 1600 }} />);
    expect(screen.getByRole("status")).toHaveTextContent("2");
  });
});
