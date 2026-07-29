import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { createMemoryRouter, MemoryRouter, Route, RouterProvider, Routes, useLocation } from "react-router-dom";
import { CHAPTERS, getPhaseIndex } from "../game/content.js";
import CampaignPage from "./CampaignPage.jsx";
import CampaignWebGLFallback from "./CampaignWebGLFallback.jsx";

vi.mock("./CampaignPlanet.jsx", () => ({
  default: ({ phases, campaign, selectedPhase, onSelectPhase, quality }) => <div
    role="application"
    aria-label="Planeta simulado"
    data-testid="campaign-planet"
    data-reduce-motion={String(quality.reduceMotion)}
  >
    {phases.map((phase) => {
      const locked = getPhaseIndex(phase.id) > campaign.unlockedPhaseIndex;
      return <button
        key={phase.id}
        disabled={locked}
        aria-pressed={selectedPhase?.id === phase.id}
        onClick={() => onSelectPhase(phase)}
      >{phase.name}</button>;
    })}
  </div>,
}));

const makeCampaign = (unlockedPhaseIndex = 0, phaseStats = {}) => ({
  unlockedPhaseIndex,
  currentPhaseId: `fase_${String(unlockedPhaseIndex + 1).padStart(2, "0")}`,
  phaseStats,
});

function LocationProbe() {
  const location = useLocation();
  return <output data-testid="location">{location.pathname}{location.search}</output>;
}

function renderPage(path = "/fases?capitulo=1", campaign = makeCampaign()) {
  return render(<MemoryRouter initialEntries={[path]}>
    <Routes>
      <Route path="/fases" element={<><CampaignPage campaign={campaign} /><LocationProbe /></>} />
      <Route path="/jogar/:phaseId" element={<><div>BRIEFING ABERTO</div><LocationProbe /></>} />
    </Routes>
  </MemoryRouter>);
}

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
});
afterEach(cleanup);

describe("mapa de campanha", () => {
  it("renderiza todos os capítulos na barra de teatros", async () => {
    renderPage();
    const rail = screen.getByRole("complementary", { name: "Capítulos da campanha" });
    for (const chapter of CHAPTERS) {
      expect(within(rail).getByText(chapter.name)).toBeInTheDocument();
    }
  });

  it("mantém capítulos futuros bloqueados e informa o requisito", () => {
    renderPage();
    expect(screen.getByRole("button", { name: /Mar de Vidro, bloqueado/i })).toBeDisabled();
  });

  it("libera um capítulo somente quando sua primeira fase está acessível", () => {
    renderPage("/fases?capitulo=2", makeCampaign(8));
    expect(screen.getByRole("button", { name: /Mar de Vidro, 0 de 8 concluídas/i })).toBeEnabled();
    expect(screen.getByRole("heading", { name: "Costa de Obsidiana" })).toBeInTheDocument();
  });

  it("atualiza o query parameter ao trocar de capítulo", async () => {
    renderPage("/fases?capitulo=1", makeCampaign(8));
    fireEvent.click(screen.getByRole("button", { name: /Mar de Vidro, 0 de 8 concluídas/i }));
    await waitFor(() => expect(screen.getByTestId("location")).toHaveTextContent("/fases?capitulo=2"));
  });

  it("usa o capítulo da fase atual quando o parâmetro é inválido", async () => {
    renderPage("/fases?capitulo=99", makeCampaign(8));
    expect(await screen.findByRole("heading", { name: "Costa de Obsidiana" })).toBeInTheDocument();
    await waitFor(() => expect(screen.getByTestId("location")).toHaveTextContent("/fases?capitulo=2"));
  });

  it("seleciona uma fase sem iniciar a batalha", async () => {
    renderPage("/fases?capitulo=1", makeCampaign(3));
    fireEvent.click(await screen.findByRole("button", { name: "Cratera Norte" }));
    await waitFor(() => expect(screen.getByRole("heading", { name: "Cratera Norte" })).toBeInTheDocument());
    expect(screen.getByTestId("location")).toHaveTextContent("/fases?capitulo=1");
  });

  it("não permite selecionar nem navegar por uma fase bloqueada", async () => {
    renderPage();
    const locked = await screen.findByRole("button", { name: "Floresta Exterior" });
    expect(locked).toBeDisabled();
    fireEvent.click(locked);
    expect(screen.getByRole("heading", { name: "Perímetro Leste" })).toBeInTheDocument();
  });

  it("abre a rota da fase apenas pelo botão Preparar operação", async () => {
    renderPage("/fases?capitulo=1", makeCampaign(2));
    fireEvent.click(await screen.findByRole("button", { name: "Cratera Norte" }));
    fireEvent.click(screen.getByRole("button", { name: /Preparar operação/i }));
    expect(await screen.findByText("BRIEFING ABERTO")).toBeInTheDocument();
    expect(screen.getByTestId("location")).toHaveTextContent("/jogar/fase_03");
  });

  it("exibe estrelas, melhor tempo e integridade salvos", () => {
    renderPage("/fases?capitulo=1", makeCampaign(0, {
      fase_01: { victories: 1, bestStars: 3, bestTimeMs: 125000, bestIntegrity: 87 },
    }));
    expect(screen.getByLabelText("3 de 3 estrelas")).toBeInTheDocument();
    expect(screen.getByText("2:05")).toBeInTheDocument();
    expect(screen.getByText("87%")).toBeInTheDocument();
  });

  it("propaga a preferência de redução de movimento", async () => {
    localStorage.setItem("genesis-defense:settings:v1", JSON.stringify({ reduceMotion: true, quality: "low" }));
    renderPage();
    expect(await screen.findByTestId("campaign-planet")).toHaveAttribute("data-reduce-motion", "true");
  });

  it("preserva seleção e bloqueios no fallback bidimensional", () => {
    const campaign = makeCampaign(1);
    const phases = CHAPTERS[0].phaseIds.map((id) => ({ id, name: id, arenaId: id }));
    const onSelect = vi.fn();
    render(<CampaignWebGLFallback
      chapter={CHAPTERS[0]}
      phases={phases}
      campaign={campaign}
      selectedPhase={phases[0]}
      onSelectPhase={onSelect}
    />);
    expect(screen.getByLabelText(/fase_01, fase 1/)).toHaveClass("is-selected");
    expect(screen.getByLabelText(/fase_03, fase 3, bloqueada/)).toBeDisabled();
    fireEvent.click(screen.getByLabelText(/fase_02, fase 2/));
    expect(onSelect).toHaveBeenCalledWith(phases[1]);
  });

  it("acompanha voltar e avançar do histórico", async () => {
    const router = createMemoryRouter([{
      path: "/fases",
      element: <><CampaignPage campaign={makeCampaign(16)} /><LocationProbe /></>,
    }], { initialEntries: ["/fases?capitulo=1"] });
    render(<RouterProvider router={router} />);
    fireEvent.click(screen.getByRole("button", { name: /Mar de Vidro, 0 de 8 concluídas/i }));
    await waitFor(() => expect(router.state.location.search).toBe("?capitulo=2"));
    fireEvent.click(screen.getByRole("button", { name: /Dunas de Quitina, 0 de 8 concluídas/i }));
    await waitFor(() => expect(router.state.location.search).toBe("?capitulo=3"));
    await router.navigate(-1);
    await waitFor(() => expect(screen.getByRole("heading", { name: "Trono dos Reflexos" })).toBeInTheDocument());
    await router.navigate(1);
    await waitFor(() => expect(screen.getByRole("heading", { name: "Limiar das Dunas" })).toBeInTheDocument());
  });
});
