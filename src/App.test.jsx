import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { LoadoutPicker, PhaseSelectPage } from "./App.jsx";
import { getUnlockedTroops, PHASES } from "./game/content.js";

afterEach(cleanup);

function renderLoadout() {
  const onToggle = vi.fn();
  const result = render(<LoadoutPicker
    phase={PHASES[7]}
    selected={["colono"]}
    onToggle={onToggle}
    onStart={vi.fn()}
    onBack={vi.fn()}
  />);
  return { ...result, onToggle };
}

describe("informações das tropas no loadout", () => {
  it("exibe um botão de informação por tropa sem aninhar botões", () => {
    const { container } = renderLoadout();
    expect(screen.getAllByRole("button", { name: /^Informações de / })).toHaveLength(getUnlockedTroops(7).length);
    expect(container.querySelector("button button")).not.toBeInTheDocument();
  });

  it("abre o dossiê correto sem alterar a seleção", () => {
    const { onToggle } = renderLoadout();
    fireEvent.click(screen.getByRole("button", { name: "Informações de Marine" }));

    expect(onToggle).not.toHaveBeenCalled();
    const dialog = screen.getByRole("dialog", { name: "Marine" });
    expect(dialog).toBeInTheDocument();
    expect(within(dialog).getByText("Três disparos rápidos contra alvos comuns.")).toBeInTheDocument();
    expect(within(dialog).getByText("4 por disparo")).toBeInTheDocument();
    expect(within(dialog).getByText("3 tiros · intervalo 0,12 s")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Fechar informações de Marine" })).toHaveFocus();
  });

  it("fecha pelo botão, Escape e fundo, restaurando o foco", async () => {
    renderLoadout();
    const trigger = screen.getByRole("button", { name: "Informações de Colono" });

    fireEvent.click(trigger);
    fireEvent.click(screen.getByRole("button", { name: "Fechar informações de Colono" }));
    await waitFor(() => expect(trigger).toHaveFocus());

    fireEvent.click(trigger);
    fireEvent.keyDown(window, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(trigger).toHaveFocus();

    fireEvent.click(trigger);
    fireEvent.mouseDown(document.querySelector(".troop-info-backdrop"));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(trigger).toHaveFocus();
  });
});

describe("bestiário do Mar de Vidro", () => {
  it("apresenta os quatro monstros exclusivos e suas artes no capítulo 2", () => {
    const campaign = { unlockedPhaseIndex: 8, phaseStats: {} };
    const { container } = render(<MemoryRouter initialEntries={["/fases?capitulo=2"]}>
      <PhaseSelectPage campaign={campaign} />
    </MemoryRouter>);

    expect(screen.getByRole("heading", { name: "Predadores do Mar de Vidro" })).toBeInTheDocument();
    ["Estilha", "Vitrarca", "Obsidonte", "Refrator"].forEach((name) => {
      expect(screen.getByRole("heading", { name })).toBeInTheDocument();
      expect(screen.getByAltText(`Arte conceitual de ${name}`)).toHaveAttribute("src", expect.stringContaining(".webp"));
    });
    expect(container.querySelectorAll(".chapter-bestiary article")).toHaveLength(4);
  });
});
