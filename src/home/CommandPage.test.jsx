import { afterEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import CommandPage from "./CommandPage.jsx";

vi.mock("./CommandGlobe.jsx", () => ({
  default: ({
    phase,
    chapter,
    phases,
    onSelectPhase,
  }) => <div
    aria-label="Mapa tático orbital"
    data-chapter-id={chapter.id}
    data-phase-id={phase.id}
  >
    {phases.map((entry) => <button
      key={entry.id}
      type="button"
      aria-pressed={entry.id === phase.id}
      onClick={() => onSelectPhase(entry)}
    >
      {entry.name}
    </button>)}
    <a href={`/fases?capitulo=${chapter.number}&fase=${phase.id}`}>
      EXPLORAR NO MAPA
    </a>
  </div>,
}));

vi.mock("./useCommandAnimations.js", () => ({
  useCommandAnimations: () => ({
    focusRuntime: vi.fn(),
    scheduleReturn: vi.fn(),
  }),
}));

const makeCampaign = (overrides = {}) => ({
  unlockedPhaseIndex: 0,
  currentPhaseId: "fase_01",
  phaseStats: {},
  ...overrides,
});

function renderPage(campaign = makeCampaign()) {
  return render(
    <MemoryRouter>
      <CommandPage campaign={campaign} />
    </MemoryRouter>,
  );
}

afterEach(() => {
  cleanup();
  localStorage.clear();
  sessionStorage.clear();
});

describe("página Comando Orbital", () => {
  it("renderiza a fase indicada por currentPhaseId", () => {
    renderPage(makeCampaign({
      unlockedPhaseIndex: 8,
      currentPhaseId: "fase_03",
    }));

    expect(
      screen.getByRole("heading", { name: "Cratera Norte" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/OPERAÇÃO 03 · CRATERA NORTE/),
    ).toBeInTheDocument();
  });

  it("usa unlockedPhaseIndex quando currentPhaseId é inválido", () => {
    renderPage(makeCampaign({
      unlockedPhaseIndex: 8,
      currentPhaseId: "inválida",
    }));

    expect(
      screen.getByRole("heading", { name: "Costa de Obsidiana" }),
    ).toBeInTheDocument();
  });

  it("mantém somente os dois módulos inferiores definitivos", () => {
    renderPage();

    expect(
      screen.getByRole("heading", { name: "PROGRESSO DA CAMPANHA" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "ÚLTIMA OPERAÇÃO" }),
    ).toBeInTheDocument();
    expect(screen.queryByText("INTELIGÊNCIA TÁTICA")).not.toBeInTheDocument();
    expect(screen.queryByText("ACESSO RÁPIDO")).not.toBeInTheDocument();
  });

  it("mostra o estado vazio sem criar outro CTA", () => {
    renderPage();

    expect(
      screen.getByText("NENHUM RELATÓRIO DE CAMPO REGISTRADO"),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "REPETIR OPERAÇÃO" }),
    ).not.toBeInTheDocument();
  });

  it("mantém um único CTA primário para preparar o esquadrão", () => {
    renderPage(makeCampaign({
      unlockedPhaseIndex: 2,
      currentPhaseId: "fase_03",
    }));

    expect(
      screen.getByRole("link", {
        name: /PREPARAR ESQUADRÃO: Cratera Norte/i,
      }),
    ).toHaveAttribute("href", "/jogar/fase_03");
    expect(
      document.querySelectorAll(".command-primary-action"),
    ).toHaveLength(1);
  });

  it("clicar em uma missão orbital atualiza o card direito e o mapa", () => {
    renderPage(makeCampaign({
      unlockedPhaseIndex: 7,
      currentPhaseId: "fase_01",
    }));

    fireEvent.click(
      screen.getByRole("button", { name: "Floresta Exterior" }),
    );

    expect(
      screen.getByRole("heading", { name: "Floresta Exterior" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("OPERAÇÃO SELECIONADA"),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", {
        name: /PREPARAR ESQUADRÃO: Floresta Exterior/i,
      }),
    ).toHaveAttribute("href", "/jogar/fase_02");
    expect(
      screen.getByRole("link", { name: "EXPLORAR NO MAPA" }),
    ).toHaveAttribute(
      "href",
      "/fases?capitulo=1&fase=fase_02",
    );
  });

  it("selecionar capítulo troca missões, seleção orbital e card lateral juntos", () => {
    renderPage(makeCampaign({
      unlockedPhaseIndex: 9,
      currentPhaseId: "fase_10",
    }));

    const chapter = screen.getByRole("tab", {
      name: /Capítulo 1, Cerco da Colmeia/i,
    });
    fireEvent.click(chapter);

    expect(chapter).toHaveAttribute("aria-selected", "true");

    const map = screen.getByLabelText("Mapa tático orbital");
    expect(map).toHaveAttribute("data-chapter-id", "chapter_01");

    const selectedMission = within(map).getByRole("button", {
      pressed: true,
    });

    expect(
      screen.getByRole("heading", {
        name: selectedMission.textContent,
      }),
    ).toBeInTheDocument();

    expect(
      screen.getByRole("link", { name: "EXPLORAR NO MAPA" }),
    ).toHaveAttribute(
      "href",
      expect.stringContaining("capitulo=1"),
    );
  });

  it("selecionar o capítulo 3 envia o mesmo capítulo ao globo e ao tema", () => {
    renderPage(makeCampaign({
      unlockedPhaseIndex: 20,
      currentPhaseId: "fase_01",
    }));

    const chapterTabs = screen.getAllByRole("tab");
    fireEvent.click(chapterTabs[2]);

    const map = screen.getByLabelText("Mapa tático orbital");
    expect(map).toHaveAttribute("data-chapter-id", "chapter_03");
    expect(document.querySelector(".command-page")).toHaveAttribute(
      "data-selected-chapter",
      "chapter_03",
    );
  });

  it("identifica capítulos bloqueados para tecnologias assistivas", () => {
    renderPage();

    expect(
      screen.getByRole("tab", {
        name: /Capítulo 2, Mar de Vidro. BLOQUEADO/,
      }),
    ).toBeDisabled();
  });
});
