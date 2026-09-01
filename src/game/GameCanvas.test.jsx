import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DECISIONS, ENEMIES } from "./content.js";
import {
  CapsuleInteractionButton, ColossusSpecialButtons, DecisionModal, FortuneChoiceModal, WaveOutroOverlay,
  getWaveOutroCameraTransform,
  SandboxPanel, getThermalBannerText, resolveCanvasClickAction, resolveInspectedTroopId,
  drawLeviathanBrineJet, FREE_HAND_ACTIVATED_MESSAGE, isLeviathanShadowOnly,
} from "./GameCanvas.jsx";
import { getLeviathanBrineMouthPosition } from "./visualGeometry.js";

afterEach(cleanup);

describe("isolamento da HUD térmica", () => {
  it("exibe o banner de magma no Capítulo 6", () => {
    expect(getThermalBannerText(
      { chapterId: "chapter_06" },
      { elapsed: 0, thermal: { state: "stable", paused: true, remainingMs: 1200 } },
    )).toBe("MAGMA EM PAUSA · 1s");
  });

  it("não exibe o banner de magma no Capítulo 7", () => {
    expect(getThermalBannerText(
      { chapterId: "chapter_07" },
      { elapsed: 0, thermal: { state: "stable", paused: true, remainingMs: 1200 } },
    )).toBeNull();
  });
});

describe("tooltip do loadout", () => {
  it("inspeciona somente a tropa sob o mouse e ignora a selecao persistente", () => {
    expect(resolveInspectedTroopId({ hoveredTroop: "marine", selectedTroop: "guard" })).toBe("marine");
    expect(resolveInspectedTroopId({ hoveredTroop: null, selectedTroop: "guard" })).toBeNull();
  });
});

describe("Mão Livre", () => {
  it("reutiliza a confirmação temporária sem instrução do Colosso", () => {
    expect(FREE_HAND_ACTIVATED_MESSAGE).toBe("Mão livre ativada.");
    expect(FREE_HAND_ACTIVATED_MESSAGE).not.toMatch(/Colosso|Esmagamento/i);
  });
});

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

describe("renderização submersa do Leviatã", () => {
  it("mantém somente a sombra na viagem, espreita, aproximação e no fim da submersão", () => {
    const entity = { type: "leviathanNereida", leviathanStateStartedAt: 0, leviathanStateEndsAt: 800 };
    for (const state of ["submergedTravel", "submergedStalk", "submergedFinalApproach"]) {
      entity.leviathanState = state;
      expect(isLeviathanShadowOnly(entity, 100)).toBe(true);
    }
    entity.leviathanState = "submerge";
    expect(isLeviathanShadowOnly(entity, 400, 4)).toBe(false);
    expect(isLeviathanShadowOnly(entity, 600, 5)).toBe(true);
    entity.leviathanState = "emergeImpact";
    expect(isLeviathanShadowOnly(entity, 700)).toBe(false);
  });
});

describe("Jato de Salmoura", () => {
  it("parte da boca e varre a rota em direção aos defensores", () => {
    const ctx = Object.fromEntries(["save", "restore", "beginPath", "rect", "clip", "moveTo", "lineTo", "closePath", "fill", "stroke", "fillRect", "quadraticCurveTo", "setLineDash", "arc"].map((method) => [method, vi.fn()]));
    const config = ENEMIES.leviathanNereida;
    drawLeviathanBrineJet(ctx, {
      type: "leviathanNereida", leviathanAttackRow: 1,
      x: 1030, y: 180, scale: config.scale,
      leviathanBrineReleasedAt: 100, leviathanBrineFrontX: 420,
      leviathanBrineEndsAt: 3000, leviathanAnimationStartedAt: 0,
    }, { elapsed: 100 + config.brineJet.mouthToGroundMs + 200 }, config);
    expect(ctx.fill).toHaveBeenCalledOnce();
    expect(ctx.stroke).toHaveBeenCalledTimes(2);
    expect(ctx.arc).toHaveBeenCalledOnce();
    expect(ctx.fillRect).not.toHaveBeenCalled();
    expect(ctx.quadraticCurveTo).not.toHaveBeenCalled();
    expect(ctx.globalCompositeOperation).not.toBe("screen");
    const mouth = getLeviathanBrineMouthPosition({ x: 1030, y: 180, scale: config.scale }, config, 3);
    expect(ctx.moveTo.mock.calls[0][0]).toBeLessThan(mouth.x);
    expect(ctx.lineTo.mock.calls.some(([x]) => x <= 420)).toBe(true);
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

describe("finalização de onda", () => {
  it("entra em zoom de 8%, sustenta o foco e retorna durante a limpeza", () => {
    const session = {
      waveOutro: {
        status: "finalKill", elapsedMs: 150,
        lastKill: { row: 2, enemy: { x: 720 } },
      },
    };
    expect(getWaveOutroCameraTransform(session)).toMatchObject({
      zoom: expect.closeTo(1.0995, 3),
      focusX: 720,
    });
    session.waveOutro.status = "cleanup";
    session.waveOutro.elapsedMs = 1000;
    expect(getWaveOutroCameraTransform(session).zoom).toBe(1);
    expect(getWaveOutroCameraTransform(session, true)).toBeNull();
  });

  it("mostra o banner antes da introdução da vantagem", () => {
    const { rerender } = render(<WaveOutroOverlay outro={{
      status: "waveCompleteBanner", completedWave: 3, killed: 18,
      integrityPercent: 82, survivors: 4, energyGained: 20,
    }} />);
    expect(screen.getByText("ONDA 3 CONCLUÍDA")).toBeInTheDocument();
    expect(screen.getByText(/18 hostis neutralizados/i)).toBeInTheDocument();

    rerender(<WaveOutroOverlay outro={{
      status: "decisionIntro",
      elapsedMs: 3900,
      decisionOptions: [{ id: "one", label: "Escudo" }, { id: "two", label: "Energia" }],
    }} />);
    expect(screen.getByText("NOVA VANTAGEM TÁTICA")).toBeInTheDocument();
    expect(screen.getByText("Escudo")).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(screen.queryByText("ONDA 3 CONCLUÍDA")).not.toBeInTheDocument();
  });

  it("troca a última onda por uma introdução de vitória", () => {
    render(<WaveOutroOverlay outro={{ status: "victoryIntro" }} />);
    expect(screen.getByText("MISSÃO CONCLUÍDA")).toBeInTheDocument();
    expect(screen.queryByText("NOVA VANTAGEM TÁTICA")).not.toBeInTheDocument();
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
