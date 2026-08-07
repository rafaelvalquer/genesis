import "@testing-library/jest-dom/vitest";
import { fireEvent, render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DematerializationPulseControls } from "./DematerializationPulseControls.jsx";

function session(overrides = {}) {
  return {
    waveActive: true,
    sandbox: false,
    outcome: null,
    elapsed: 1000,
    enemies: [{ id: "e1", row: 2, hp: 800, dead: false, type: "silicaDigger" }],
    dematerializationPulses: Array.from({ length: 5 }, (_, row) => ({
      id: `dematerialization_pulse_${row}`,
      row,
      state: "ready",
      chargeStartedAt: null,
      fireAt: null,
    })),
    ...overrides,
  };
}

describe("DematerializationPulseControls", () => {
  it("habilita apenas a rota com alvo e dispara a rota correta", () => {
    const onActivate = vi.fn();
    const { getByRole } = render(<DematerializationPulseControls session={session()} onActivate={onActivate} />);
    const route3 = getByRole("button", { name: /Canhão da rota 3.*500 de dano/i });
    const route1 = getByRole("button", { name: /Canhão da rota 1/i });
    expect(route3).toBeEnabled();
    expect(route1).toBeDisabled();
    fireEvent.click(route3);
    expect(onActivate).toHaveBeenCalledWith(2);
  });

  it("mostra estado de carregamento sem permitir segundo clique", () => {
    const value = session();
    value.dematerializationPulses[2] = {
      ...value.dematerializationPulses[2],
      state: "charging",
      chargeStartedAt: 1000,
      fireAt: 3000,
    };
    const { getByRole } = render(<DematerializationPulseControls session={value} onActivate={() => {}} />);
    const route3 = getByRole("button", { name: /Canhão da rota 3.*Carregando/i });
    expect(route3).toBeDisabled();
    expect(route3).toHaveTextContent("CARREGANDO");
  });
});
