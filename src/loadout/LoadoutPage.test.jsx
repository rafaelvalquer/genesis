import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { useState } from "react";
import { PHASES, getUnlockedTroops } from "../game/content.js";
import LoadoutPage from "./LoadoutPage.jsx";
import EnemyIntel, { deriveEnemyIntel } from "./EnemyIntel.jsx";

afterEach(() => {
  cleanup();
  localStorage.clear();
  sessionStorage.clear();
});

function renderLoadout({ phase = PHASES[8], selected = ["colono"], onToggle = vi.fn(), onStart = vi.fn() } = {}) {
  const result = render(<LoadoutPage phase={phase} selected={selected} onToggle={onToggle} onStart={onStart} onBack={vi.fn()} />);
  return { ...result, onToggle, onStart };
}

function ControlledLoadout({ phase = PHASES[8], initial = [] }) {
  const [selected, setSelected] = useState(initial);
  return <LoadoutPage
    phase={phase}
    selected={selected}
    onToggle={(id) => setSelected((current) => current.includes(id) ? current.filter((entry) => entry !== id) : [...current, id])}
    onStart={() => {}}
    onBack={() => {}}
  />;
}

const stage = () => document.querySelector(".troop-stage");

describe("baia de preparação tática", () => {
  it("foca inicialmente a primeira tropa selecionada", () => {
    renderLoadout({ selected: ["marine", "colono"] });
    expect(within(stage()).getByRole("heading", { name: "Marine" })).toBeInTheDocument();
  });

  it("foca a primeira tropa disponível sem seleção", () => {
    const phase = PHASES[0];
    const first = getUnlockedTroops(0)[0];
    renderLoadout({ phase, selected: [] });
    expect(within(stage()).getByRole("heading", { name: first.label })).toBeInTheDocument();
  });

  it("hover e foco mudam o palco sem selecionar", () => {
    const onToggle = vi.fn();
    renderLoadout({ onToggle });
    const marine = screen.getByRole("button", { name: "Selecionar Marine" });
    fireEvent.mouseEnter(marine.closest("article"));
    expect(within(stage()).getByRole("heading", { name: "Marine" })).toBeInTheDocument();
    expect(onToggle).not.toHaveBeenCalled();
  });

  it("seleciona e remove tropas mantendo o contrato controlado", () => {
    render(<ControlledLoadout initial={["colono"]} />);
    fireEvent.click(screen.getByRole("button", { name: "Selecionar Marine" }));
    expect(screen.getByRole("button", { name: "Remover Marine" })).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(screen.getByRole("button", { name: "Remover Colono" }));
    expect(screen.getByRole("button", { name: "Selecionar Colono" })).toHaveAttribute("aria-pressed", "false");
  });

  it("impede ultrapassar o limite e anuncia capacidade máxima", () => {
    const phase = PHASES[8];
    const available = getUnlockedTroops(8);
    const selected = available.slice(0, phase.loadoutLimit).map((troop) => troop.id);
    const onToggle = vi.fn();
    renderLoadout({ phase, selected, onToggle });
    const extra = available.find((troop) => !selected.includes(troop.id));
    fireEvent.click(screen.getByRole("button", { name: `Selecionar ${extra.label}` }));
    expect(onToggle).not.toHaveBeenCalled();
    expect(screen.getByText("CAPACIDADE MÁXIMA ATINGIDA")).toBeInTheDocument();
  });

  it("cria a quantidade dinâmica de slots e suporta sete", () => {
    renderLoadout({ phase: PHASES[24], selected: ["colono"] });
    const dock = screen.getByRole("heading", { name: "Esquadrão" }).closest("section");
    expect(within(dock).getAllByRole("listitem")).toHaveLength(7);
    expect(within(dock).getAllByLabelText(/Slot \d vazio/)).toHaveLength(6);
  });

  it("reflete no dock a ordem exata de selected", () => {
    renderLoadout({ selected: ["marine", "reator", "colono"] });
    const occupied = [...document.querySelectorAll(".squad-slot.occupied")];
    expect(occupied.map((node) => node.querySelector("b").textContent)).toEqual(["Marine", "Reator de Energia", "Colono"]);
  });

  it("desabilita confirmação vazia e habilita com tropa", () => {
    const { rerender } = render(<LoadoutPage phase={PHASES[8]} selected={[]} onToggle={() => {}} onStart={() => {}} onBack={() => {}} />);
    expect(screen.getByRole("button", { name: /CONFIRMAR LOADOUT/ })).toBeDisabled();
    rerender(<LoadoutPage phase={PHASES[8]} selected={["colono"]} onToggle={() => {}} onStart={() => {}} onBack={() => {}} />);
    expect(screen.getByRole("button", { name: /CONFIRMAR LOADOUT/ })).toBeEnabled();
  });

  it("chama onStart uma única vez mesmo com cliques repetidos", () => {
    const onStart = vi.fn();
    renderLoadout({ onStart });
    const confirm = screen.getByRole("button", { name: /CONFIRMAR LOADOUT/ });
    fireEvent.click(confirm);
    fireEvent.click(confirm);
    expect(onStart).toHaveBeenCalledTimes(1);
  });

  it("navega pelo catálogo usando as setas", () => {
    renderLoadout();
    const first = screen.getByRole("button", { name: "Remover Colono" });
    const second = screen.getByRole("button", { name: "Selecionar Reator de Energia" });
    first.focus();
    fireEvent.keyDown(first, { key: "ArrowRight" });
    expect(second).toHaveFocus();
    expect(within(stage()).getByRole("heading", { name: "Reator de Energia" })).toBeInTheDocument();
  });

  it("mantém a interface funcional no fallback sem WebGL", async () => {
    renderLoadout();
    expect(await screen.findByTestId("loadout-webgl-fallback")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Selecionar Marine" })).toBeEnabled();
  });

  it("mantém somente o frame estático com redução de movimento", async () => {
    localStorage.setItem("genesis-defense:settings:v1", JSON.stringify({ quality: "high", reduceMotion: true }));
    renderLoadout({ selected: ["colono"] });
    const preview = screen.getByAltText("Projeção holográfica de Colono");
    expect(preview).not.toHaveClass("is-animated");
    expect(preview.getAttribute("src")).toContain("/colono/idle/frame0.png");
  });

  it("prende o foco no dossiê e o devolve ao acionador", async () => {
    renderLoadout();
    const trigger = screen.getByRole("button", { name: "Informações de Colono" });
    fireEvent.click(trigger);
    const close = screen.getByRole("button", { name: "Fechar informações de Colono" });
    fireEvent.keyDown(window, { key: "Tab" });
    expect(close).toHaveFocus();
    fireEvent.click(close);
    await waitFor(() => expect(trigger).toHaveFocus());
  });

  it("deriva inimigos, totais e primeira onda exclusivamente das ondas", () => {
    const intel = deriveEnemyIntel(PHASES[0]);
    const medu = intel.find((entry) => entry.id === "medu");
    expect(medu.firstWave).toBe(1);
    expect(medu.count).toBe(20);
    render(<EnemyIntel phase={PHASES[0]} />);
    expect(screen.getByLabelText("20 hostis projetados")).toBeInTheDocument();
    expect(intel.map((entry) => entry.id)).toEqual(expect.arrayContaining(["medu", "crix", "krulax"]));

    const priorityIntel = deriveEnemyIntel({
      environmentHazard: { id: "tide_cycle" },
      waves: [{ enemies: [
        { type: "mordelume", count: 20 },
        { type: "carapacaNereida", count: 1 },
        { type: "leviathanNereida", count: 1 },
        { type: "medu", count: 50, variant: "alpha" },
      ] }],
    });
    expect(priorityIntel.map((entry) => entry.id)).toEqual([
      "leviathanNereida", "medu", "mordelume", "carapacaNereida",
    ]);
  });

  it("não cria botões aninhados nem mais de um canvas", () => {
    const { container } = renderLoadout();
    expect(container.querySelector("button button")).not.toBeInTheDocument();
    expect(container.querySelectorAll(".troop-stage-canvas")).toHaveLength(1);
    expect(container.querySelectorAll("canvas").length).toBeLessThanOrEqual(1);
  });
});
