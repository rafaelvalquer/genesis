import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DECISIONS } from "./content.js";
import {
  CapsuleInteractionButton, ColossusSpecialButtons, DecisionModal, FortuneChoiceModal,
  SandboxPanel, resolveCanvasClickAction,
} from "./GameCanvas.jsx";

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

describe("interface do Protocolo Fortuna", () => {
  it("expõe o botão acessível da cápsula", () => {
    const onOpen = vi.fn();
    render(<CapsuleInteractionButton capsule={{ x: 250, y: 180 }} onOpen={onOpen} />);
    fireEvent.click(screen.getByRole("button", { name: "Abrir Cápsula da Colônia" }));
    expect(onOpen).toHaveBeenCalledOnce();
  });

  it("mostra raridade e encaminha a recompensa escolhida", () => {
    const onChoose = vi.fn();
    render(<FortuneChoiceModal tier="critical" options={[
      { id: "shield", label: "Barreira do núcleo", rarity: "rare", description: "Duas cargas." },
      { id: "orbital", label: "Ataque orbital", rarity: "epic", description: "Escolha uma rota.", requiresTarget: true },
    ]} onChoose={onChoose} />);
    expect(screen.getByText("SITUAÇÃO CRÍTICA", { exact: false })).toBeInTheDocument();
    expect(screen.getByText("ÉPICA")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Ataque orbital/i }));
    expect(onChoose).toHaveBeenCalledWith("orbital");
  });

  it("oferece seletor Difícil/Crítica e bloqueia nova simulação", () => {
    render(<SandboxPanel
      selectedEnemy="medu" onSelectEnemy={vi.fn()} row={0} onRow={vi.fn()} count={1} onCount={vi.fn()}
      alpha={false} onAlpha={vi.fn()} grouped={false} onGrouped={vi.fn()}
      settings={{ rulesMode: "free", enemyHpMultiplier: 1, enemySpeedMultiplier: 1, enemyDamageMultiplier: 1, troopDamageMultiplier: 1, invulnerableBase: true }}
      onSetting={vi.fn()} onRulesMode={vi.fn()} onSpawn={vi.fn()} onForceCombo={vi.fn()}
      onInjure={vi.fn()} onClear={vi.fn()} onReset={vi.fn()}
      fortuneTier="critical" onFortuneTier={vi.fn()} onSimulateFortune={vi.fn()}
      fortuneDisabled fortuneReason="Ajuda já simulada. Use Reiniciar para testar novamente."
    />);
    expect(screen.getByRole("button", { name: "Difícil" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Crítica" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "SIMULAR AJUDA" })).toBeDisabled();
    expect(screen.getByText(/Use Reiniciar/)).toBeInTheDocument();
  });
});
