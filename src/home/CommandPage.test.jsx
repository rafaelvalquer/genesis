import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import CommandPage from "./CommandPage.jsx";

vi.mock("./CommandGlobe.jsx", () => ({
  default: ({ phase, onOpenMap }) => <button
    type="button"
    aria-label={`Operação ${phase.id.slice(-2)}, ${phase.name}. Abrir mapa orbital.`}
    onClick={onOpenMap}
  >MARCADOR ORBITAL</button>,
}));

vi.mock("./useCommandAnimations.js", async () => {
  const { useNavigate } = await import("react-router-dom");
  return {
    useCommandAnimations: ({ chapter, phase }) => {
      const navigate = useNavigate();
      return {
        openCampaign: () => navigate(`/fases?capitulo=${chapter.number}&fase=${phase.id}`),
        previewChapter: vi.fn(),
        scheduleReturn: vi.fn(),
      };
    },
  };
});

const makeCampaign = (overrides = {}) => ({
  unlockedPhaseIndex: 0,
  currentPhaseId: "fase_01",
  phaseStats: {},
  ...overrides,
});

function LocationProbe() {
  const location = useLocation();
  return <output data-testid="location">{location.pathname}{location.search}</output>;
}

function renderPage(campaign = makeCampaign(), onReset = vi.fn()) {
  return {
    onReset,
    ...render(<MemoryRouter initialEntries={["/"]}>
      <Routes>
        <Route path="*" element={<><CommandPage campaign={campaign} onReset={onReset} /><LocationProbe /></>} />
      </Routes>
    </MemoryRouter>),
  };
}

afterEach(() => {
  cleanup();
  localStorage.clear();
  sessionStorage.clear();
});

describe("página Comando Orbital", () => {
  it("renderiza a fase indicada por currentPhaseId", () => {
    renderPage(makeCampaign({ unlockedPhaseIndex: 8, currentPhaseId: "fase_03" }));
    expect(screen.getByRole("heading", { name: "Cratera Norte" })).toBeInTheDocument();
    expect(screen.getByText(/OPERAÇÃO 03 · CRATERA NORTE/)).toBeInTheDocument();
  });

  it("usa unlockedPhaseIndex quando currentPhaseId é inválido", () => {
    renderPage(makeCampaign({ unlockedPhaseIndex: 8, currentPhaseId: "inválida" }));
    expect(screen.getByRole("heading", { name: "Costa de Obsidiana" })).toBeInTheDocument();
  });

  it("exibe os módulos operacionais essenciais", () => {
    renderPage();
    expect(screen.getByRole("heading", { name: "PROGRESSO DOS CAPÍTULOS" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "ÚLTIMO RELATÓRIO" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "INTELIGÊNCIA TÁTICA" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "ACESSO RÁPIDO" })).toBeInTheDocument();
  });

  it("mostra o estado vazio sem operação anterior", () => {
    renderPage();
    expect(screen.getByText("NENHUM RELATÓRIO DE CAMPO REGISTRADO")).toBeInTheDocument();
  });

  it("gera URL completa no botão Abrir mapa orbital", async () => {
    renderPage(makeCampaign({ unlockedPhaseIndex: 8, currentPhaseId: "fase_09" }));
    fireEvent.click(screen.getByRole("button", { name: /^ABRIR MAPA ORBITAL/ }));
    await waitFor(() => expect(screen.getByTestId("location")).toHaveTextContent("/fases?capitulo=2&fase=fase_09"));
  });

  it("gera a rota de loadout no botão Preparar operação", () => {
    renderPage(makeCampaign({ unlockedPhaseIndex: 2, currentPhaseId: "fase_03" }));
    expect(screen.getByRole("link", { name: "PREPARAR OPERAÇÃO" })).toHaveAttribute("href", "/jogar/fase_03");
  });

  it("mantém o marcador acessível e abre a campanha pelo clique", async () => {
    renderPage();
    const marker = screen.getByRole("button", { name: /Operação 01, Perímetro Leste/ });
    marker.focus();
    fireEvent.keyDown(marker, { key: "Enter" });
    fireEvent.click(marker);
    await waitFor(() => expect(screen.getByTestId("location")).toHaveTextContent("/fases?capitulo=1&fase=fase_01"));
  });

  it("preserva onReset dentro da manutenção", () => {
    const { onReset } = renderPage();
    fireEvent.click(screen.getByText("MANUTENÇÃO DO SISTEMA"));
    fireEvent.click(screen.getByRole("button", { name: "APAGAR PROGRESSO LOCAL" }));
    expect(onReset).toHaveBeenCalledOnce();
  });

  it("abre capítulo acessível na fase mais avançada", async () => {
    renderPage(makeCampaign({ unlockedPhaseIndex: 9, currentPhaseId: "fase_10" }));
    fireEvent.click(screen.getByRole("button", { name: /Capítulo 2, Mar de Vidro/ }));
    await waitFor(() => expect(screen.getByTestId("location")).toHaveTextContent("/fases?capitulo=2&fase=fase_10"));
  });

  it("identifica capítulos bloqueados para tecnologias assistivas", () => {
    renderPage();
    expect(screen.getByRole("button", { name: /Capítulo 2, Mar de Vidro. BLOQUEADO/ })).toBeDisabled();
  });
});
