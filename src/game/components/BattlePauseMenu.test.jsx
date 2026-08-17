import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import BattlePauseMenu from "./BattlePauseMenu.jsx";

afterEach(cleanup);

const props = () => ({
  phase: { id: "phase_46", name: "Linha de Ruptura" },
  snapshot: { wave: 4, totalWaves: 6, integrity: 74, integrityMax: 100 },
  loadout: ["mantis", "cryo7", "interceptadorIcaro"],
  onContinue: vi.fn(), onRestart: vi.fn(), onExit: vi.fn(), reduceMotion: false,
});

describe("BattlePauseMenu", () => {
  it("confirma o restart sem trocar fase ou loadout", async () => {
    const input = props();
    render(<BattlePauseMenu {...input} />);
    fireEvent.click(screen.getByRole("button", { name: /reiniciar fase/i }));
    expect(screen.getByText(/todo o progresso desta tentativa/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /^.*reiniciar$/i }));
    expect(input.onRestart).toHaveBeenCalledOnce();
  });

  it("Escape retorna da confirmação e continua a batalha no menu", () => {
    const input = props();
    render(<BattlePauseMenu {...input} />);
    fireEvent.click(screen.getByRole("button", { name: /reiniciar fase/i }));
    fireEvent.keyDown(window, { code: "Escape" });
    expect(screen.getByRole("button", { name: /reiniciar fase/i })).toBeInTheDocument();
    fireEvent.keyDown(window, { code: "Escape" });
    expect(input.onContinue).toHaveBeenCalledOnce();
  });
});
