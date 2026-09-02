import { afterEach, describe, expect, it } from "vitest";
import { fireEvent, render, screen, waitFor, cleanup } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import AnimationLabPage from "./AnimationLabPage.jsx";
import { getAnimationFrame, getAnimationEntityStates } from "./animationLabAssetLoader.js";

afterEach(cleanup);

describe("Laboratório de Animações", () => {
  it("lista categorias e estados completos do Colosso sem bloqueio de campanha", async () => {
    render(<MemoryRouter><AnimationLabPage /></MemoryRouter>);
    expect(screen.getByRole("heading", { name: "Laboratório de Animações" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Monstros" })).toHaveAttribute("aria-selected", "true");
    await waitFor(() => expect(screen.getByRole("button", { name: /Slam Attack/ })).toBeInTheDocument());
    expect(getAnimationEntityStates("enemy", "colossoCaldeira")).toEqual(expect.arrayContaining(["coreExposed", "death", "riftAttack"]));
    fireEvent.click(screen.getByRole("button", { name: /Slam Attack/ }));
    expect(screen.getByText(/Timing:/)).toBeInTheDocument();
  });

  it("permite frame manual, play/pause, velocidade, grade, anchor e hit zones do Colosso", async () => {
    render(<MemoryRouter><AnimationLabPage /></MemoryRouter>);
    await waitFor(() => expect(screen.getByRole("button", { name: "Próximo frame" })).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "Próximo frame" }));
    expect(screen.getByText(/Frame:/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Play" }));
    expect(screen.getByRole("button", { name: "Pausar" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "0.25x" }));
    expect(screen.getByRole("button", { name: "0.25x" })).toHaveClass("active");
    fireEvent.click(screen.getByRole("checkbox", { name: "Grade" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "Anchor" }));
    expect(screen.getByRole("checkbox", { name: "Hit zones" })).toBeChecked();
    fireEvent.click(screen.getByRole("checkbox", { name: "Hit zones" }));
    expect(screen.getByRole("checkbox", { name: "Hit zones" })).not.toBeChecked();
  });

  it("não resolve frame ausente usando Idle", () => {
    const idle = { src: "idle" };
    expect(getAnimationFrame({ states: { idle: [idle], slamAttack: [] } }, "slamAttack", 0)).toBeNull();
  });

  it("inspeciona os estados disponíveis dos transportes do comboio", async () => {
    render(<MemoryRouter><AnimationLabPage /></MemoryRouter>);
    fireEvent.click(screen.getByRole("tab", { name: "Transportes" }));
    await waitFor(() => expect(screen.getByRole("button", { name: /Energy spawn/ })).toBeInTheDocument());
    expect(screen.getAllByText(/Dínamo — Unidade Móvel de Geração/).length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole("button", { name: /Energy spawn/ }));
    expect(screen.getByText(/Timing:/)).toBeInTheDocument();
  });
});
