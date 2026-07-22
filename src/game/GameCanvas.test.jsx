import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DECISIONS } from "./content.js";
import { ColossusSpecialButtons, DecisionModal, resolveCanvasClickAction } from "./GameCanvas.jsx";

afterEach(cleanup);

describe("clique no Campo de Provas", () => {
  it("prioriza o especial do Colosso mesmo com uma tropa selecionada para implantação", () => {
    const colossus = {
      id: "colosso_1", type: "colossoImpacto", row: 0, col: 1, x: 150, y: 60, dead: false,
    };
    const session = { troops: [colossus] };

    expect(resolveCanvasClickAction(session, { x: 150, y: 60 }, "marine")).toMatchObject({
      type: "special",
      troop: colossus,
    });
    expect(resolveCanvasClickAction(session, { x: 212, y: 8 }, "marine")).toMatchObject({
      type: "special",
      troop: colossus,
    });
  });

  it("mantém implantação e remoção para células sem especial manual", () => {
    const marine = {
      id: "marine_1", type: "marine", row: 0, col: 1, x: 150, y: 60, dead: false,
    };
    const session = { troops: [marine] };

    expect(resolveCanvasClickAction(session, { x: 150, y: 60 }, "sniper")).toMatchObject({
      type: "place",
      troopType: "sniper",
      cell: { row: 0, col: 1 },
    });
    expect(resolveCanvasClickAction(session, { x: 150, y: 60 }, "sniper", true)).toMatchObject({
      type: "remove",
      cell: { row: 0, col: 1 },
    });
  });
});

describe("botão contextual do Colosso", () => {
  it("ativa diretamente o Colosso pronto durante uma onda", () => {
    const onActivate = vi.fn();
    const troop = {
      id: "colosso_ready", type: "colossoImpacto", row: 2, x: 350, y: 300,
      dead: false, specialRequested: false, specialReadyAt: 1000,
    };
    const session = { troops: [troop], elapsed: 1000, waveActive: true, outcome: null };

    render(<ColossusSpecialButtons session={session} onActivate={onActivate} />);
    fireEvent.click(screen.getByRole("button", { name: /ativar esmagamento total.*rota 3/i }));

    expect(onActivate).toHaveBeenCalledWith("colosso_ready");
  });

  it("não aparece fora da onda nem durante a recarga", () => {
    const troop = {
      id: "colosso_cooling", type: "colossoImpacto", row: 0, x: 150, y: 60,
      dead: false, specialRequested: false, specialReadyAt: 2000,
    };
    const { rerender } = render(
      <ColossusSpecialButtons
        session={{ troops: [troop], elapsed: 2000, waveActive: false, outcome: null }}
        onActivate={vi.fn()}
      />,
    );
    expect(screen.queryByRole("button")).not.toBeInTheDocument();

    rerender(
      <ColossusSpecialButtons
        session={{ troops: [troop], elapsed: 1999, waveActive: true, outcome: null }}
        onActivate={vi.fn()}
      />,
    );
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});

describe("modal de decisões entre ondas", () => {
  it("mostra o nível, exatamente duas opções e encaminha a escolha", () => {
    const onChoose = vi.fn();
    const options = [DECISIONS.emergency_energy, DECISIONS.emergency_shield];
    render(<DecisionModal level="preparation" options={options} onChoose={onChoose} />);

    expect(screen.getByText("Decisão · Preparação")).toBeInTheDocument();
    expect(screen.getByText("Economia")).toBeInTheDocument();
    expect(screen.getByText("Poder 2")).toBeInTheDocument();
    expect(screen.getAllByRole("button")).toHaveLength(2);
    fireEvent.click(screen.getByRole("button", { name: /Carga emergencial/i }));
    expect(onChoose).toHaveBeenCalledWith(DECISIONS.emergency_energy);
  });
});
