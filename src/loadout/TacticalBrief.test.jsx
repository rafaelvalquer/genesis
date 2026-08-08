import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PHASES, getChapterForPhase } from "../game/content.js";
import TacticalBrief from "./TacticalBrief.jsx";

describe("briefing tático", () => {
  it("expõe os riscos da maré de Nereida", () => {
    const phase = PHASES.find((entry) => entry.environmentHazard?.id === "tide_cycle");
    render(<TacticalBrief
      phase={phase}
      chapter={getChapterForPhase(phase)}
      arenaUrl="/arena.png"
      troops={[]}
      canConfirm={false}
      confirming={false}
      onConfirm={() => {}}
    />);

    expect(screen.getByText("MARÉ DE NEREIDA")).toBeInTheDocument();
    expect(screen.getByText("Células alagadas bloqueiam novas implantações.")).toBeInTheDocument();
    expect(screen.getByText("UNIDADES ANFÍBIAS RECOMENDADAS")).toBeInTheDocument();
  });
});
