import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { AppLayout, EncyclopediaPage, LoadoutPicker, PhaseSelectPage, PlayPage } from "./App.jsx";
import { getUnlockedTroops, PHASES } from "./game/content.js";

afterEach(cleanup);

function renderLoadout(phase = PHASES[7]) {
  const onToggle = vi.fn();
  const result = render(<LoadoutPicker
    phase={phase}
    selected={["colono"]}
    onToggle={onToggle}
    onStart={vi.fn()}
    onBack={vi.fn()}
  />);
  return { ...result, onToggle };
}

describe("Enciclopédia", () => {
  it("remove o bestiário exclusivo do capítulo 2", () => {
    const campaign = { unlockedPhaseIndex: 8, phaseStats: {} };
    render(<MemoryRouter initialEntries={["/fases?capitulo=2"]}>
      <PhaseSelectPage campaign={campaign} />
    </MemoryRouter>);

    expect(screen.queryByText("FAUNA EXCLUSIVA")).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Predadores do Mar de Vidro" })).not.toBeInTheDocument();
  });

  it("oferece a nova aba na navegação e indica a rota ativa", () => {
    vi.spyOn(window, "scrollTo").mockImplementation(() => {});
    render(<MemoryRouter initialEntries={["/enciclopedia"]}>
      <AppLayout><EncyclopediaPage campaign={{ unlockedPhaseIndex: 0, phaseStats: {} }} /></AppLayout>
    </MemoryRouter>);

    expect(screen.getByRole("link", { name: "Enciclopédia" })).toHaveClass("active");
    expect(screen.getByRole("heading", { name: "Enciclopédia" })).toBeInTheDocument();
  });

  it("oferece a aba Animações ao lado de Configurações", () => {
    render(<MemoryRouter initialEntries={["/animacoes"]}><AppLayout><div /></AppLayout></MemoryRouter>);
    expect(screen.getByRole("link", { name: "Configurações" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Animações" })).toHaveClass("active");
    expect(screen.getByRole("link", { name: "Animações" })).toHaveAttribute("href", "/animacoes");
  });

  it("separa tropas e inimigos e protege registros futuros", () => {
    render(<MemoryRouter><EncyclopediaPage campaign={{ unlockedPhaseIndex: 0, phaseStats: {} }} /></MemoryRouter>);

    expect(screen.getByRole("tab", { name: /Tropas/ })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("button", { name: "Ver informações de Colono" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Ver informações de Marine" })).not.toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /Registro bloqueado/ })[0]).toBeDisabled();
    expect(screen.queryByText("Marine")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: /Inimigos/ }));
    expect(screen.getByRole("tab", { name: /Inimigos/ })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("button", { name: "Ver informações de Medu" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Ver informações de Crix" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Ver informações de Escavador de Sílica" })).not.toBeInTheDocument();
    expect(screen.queryByText("Crisálio")).not.toBeInTheDocument();
  });

  it("libera o Escavador de Sílica na abertura do capítulo 3", () => {
    const { rerender } = render(<MemoryRouter><EncyclopediaPage campaign={{ unlockedPhaseIndex: 15, phaseStats: {} }} /></MemoryRouter>);
    fireEvent.click(screen.getByRole("tab", { name: /Inimigos/ }));
    expect(screen.queryByRole("button", { name: "Ver informações de Escavador de Sílica" })).not.toBeInTheDocument();

    rerender(<MemoryRouter><EncyclopediaPage campaign={{ unlockedPhaseIndex: 16, phaseStats: {} }} /></MemoryRouter>);
    fireEvent.click(screen.getByRole("button", { name: "Ver informações de Escavador de Sílica" }));
    expect(screen.getByRole("heading", { name: "Escavador de Sílica" })).toBeInTheDocument();
  });

  it("revela entradas conforme as fases e atualiza o dossiê selecionado", () => {
    render(<MemoryRouter><EncyclopediaPage campaign={{ unlockedPhaseIndex: 12, phaseStats: {} }} /></MemoryRouter>);

    fireEvent.click(screen.getByRole("button", { name: "Ver informações de Reator de Energia" }));
    expect(screen.getByRole("heading", { name: "Reator de Energia" })).toBeInTheDocument();
    expect(screen.getByText("1 energia a cada 6 s")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: /Inimigos/ }));
    fireEvent.click(screen.getByRole("button", { name: "Ver informações de Crisálio" }));
    expect(screen.getByRole("heading", { name: "Crisálio" })).toBeInTheDocument();
    expect(screen.getByAltText("Retrato de Crisálio")).toHaveAttribute("src", expect.stringMatching(/frame0.*\.png/i));
    expect(screen.getByText("Renova escudos aliados a cada 7 s")).toBeInTheDocument();
  });

  it("libera o Besouro-Aríete em sua estreia na fase 19", () => {
    const { rerender } = render(<MemoryRouter><EncyclopediaPage campaign={{ unlockedPhaseIndex: 17, phaseStats: {} }} /></MemoryRouter>);
    fireEvent.click(screen.getByRole("tab", { name: /Inimigos/ }));
    expect(screen.queryByRole("button", { name: "Ver informações de Besouro-Aríete" })).not.toBeInTheDocument();

    rerender(<MemoryRouter><EncyclopediaPage campaign={{ unlockedPhaseIndex: 18, phaseStats: {} }} /></MemoryRouter>);
    fireEvent.click(screen.getByRole("button", { name: "Ver informações de Besouro-Aríete" }));
    expect(screen.getByRole("heading", { name: "Besouro-Aríete" })).toBeInTheDocument();
    expect(screen.getByText("55 de dano após 0,65 s")).toBeInTheDocument();
    expect(screen.getByAltText("Retrato de Besouro-Aríete")).toHaveAttribute("src", expect.stringMatching(/frame0.*\.png/i));
  });

  it("libera o Imperador Escaravelho na fase final e apresenta suas três formas", () => {
    const { rerender } = render(<MemoryRouter><EncyclopediaPage campaign={{ unlockedPhaseIndex: 22, phaseStats: {} }} /></MemoryRouter>);
    fireEvent.click(screen.getByRole("tab", { name: /Inimigos/ }));
    expect(screen.queryByRole("button", { name: "Ver informações de Imperador Escaravelho" })).not.toBeInTheDocument();

    rerender(<MemoryRouter><EncyclopediaPage campaign={{ unlockedPhaseIndex: 23, phaseStats: {} }} /></MemoryRouter>);
    fireEvent.click(screen.getByRole("button", { name: "Ver informações de Imperador Escaravelho" }));
    expect(screen.getByRole("heading", { name: "Imperador Escaravelho" })).toBeInTheDocument();
    expect(screen.getByAltText("Retrato de Imperador Escaravelho")).toHaveAttribute("src", expect.stringMatching(/phase1Idle\/frame0.*\.png/i));
    expect(screen.getByText("Fase 2 em 65% de HP; fase 3 em 30% de HP")).toBeInTheDocument();
    expect(screen.getByText("Não pode ser deslocado por empurrões")).toBeInTheDocument();
  });
});
