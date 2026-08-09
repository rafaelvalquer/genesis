import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SandboxPanel } from "../../GameCanvas.jsx";

const settings = {
  rulesMode: "free", mechanicMode: "none", invulnerableBase: true,
  enemyHpMultiplier: 1, enemySpeedMultiplier: 1, enemyDamageMultiplier: 1,
  troopDamageMultiplier: 1, magmaThermalState: "auto", magmaCrustCoverage: 0.48,
  magmaFlowMultiplier: 1, magmaWarpMultiplier: 1, magmaVentLimit: 7,
  magmaParticleLimit: 60, magmaPaused: false, magmaShowHeatmap: false,
  magmaShowRegionMask: false,
};

function renderPanel(onSetting = vi.fn()) {
  render(<SandboxPanel
    selectedEnemy="medu" onSelectEnemy={vi.fn()} row={0} onRow={vi.fn()}
    count={1} onCount={vi.fn()} alpha={false} onAlpha={vi.fn()}
    grouped={false} onGrouped={vi.fn()} settings={settings} onSetting={onSetting}
    onRulesMode={vi.fn()} onSpawn={vi.fn()} onForceCombo={vi.fn()}
    onInjure={vi.fn()} onClear={vi.fn()} onReset={vi.fn()}
    fortuneTier="critical" onFortuneTier={vi.fn()} onSimulateFortune={vi.fn()}
    fortuneDisabled={false} magmaEnabled
  />);
}

describe("controles de laboratório do magma", () => {
  it("expõe estados, sliders, pausa e visualizações de depuração", () => {
    const onSetting = vi.fn();
    renderPanel(onSetting);
    fireEvent.click(screen.getByRole("button", { name: "Eruption" }));
    expect(onSetting).toHaveBeenCalledWith("magmaThermalState", "eruption");
    expect(screen.getByText("Crosta")).toBeInTheDocument();
    expect(screen.getByText("Fluxo")).toBeInTheDocument();
    expect(screen.getByText("Warp")).toBeInTheDocument();
    expect(screen.getByText("Vents")).toBeInTheDocument();
    expect(screen.getByText("Partículas")).toBeInTheDocument();
    expect(screen.getByText("Pausar magma")).toBeInTheDocument();
    expect(screen.getByText("Mostrar heatmap")).toBeInTheDocument();
    expect(screen.getByText("Mostrar máscara")).toBeInTheDocument();
  });
});
