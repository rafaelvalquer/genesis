import { describe, expect, it, vi } from "vitest";
import { handleBattleStepEvents } from "./battleStepEvents.js";

function createContext() {
  return {
    audioRef: { current: {} },
    play: vi.fn(),
    sessionRef: { current: { enemies: [] } },
    setBanner: vi.fn(),
    setMessage: vi.fn(),
    setRemoveMode: vi.fn(),
    setRepositionTroopId: vi.fn(),
    setSelectedTroop: vi.fn(),
    settings: { masterVolume: 1, effectsVolume: 1 },
  };
}

describe("handleBattleStepEvents", () => {
  it("mantém as reações de checkpoint fora do loop de simulação", () => {
    const context = createContext();

    handleBattleStepEvents([{ type: "checkpointPreparation" }], context);

    expect(context.setSelectedTroop).toHaveBeenCalledWith(null);
    expect(context.setRepositionTroopId).toHaveBeenCalledWith(null);
    expect(context.setRemoveMode).toHaveBeenCalledWith(false);
    expect(context.setMessage).toHaveBeenCalledWith("CHECKPOINT ALCANÇADO", { tone: "info" });
  });

  it("preserva o som e o banner do lock do Ícaro", () => {
    const context = createContext();

    handleBattleStepEvents([{ type: "icaroTargetLock" }, { type: "waveComplete" }], context);

    expect(context.play).toHaveBeenCalledWith("icaroInterceptionLock", 0.5);
    expect(context.setBanner).toHaveBeenCalledWith("PERÍMETRO SEGURO · REORGANIZAÇÃO EM CURSO");
  });

  it("mantém reações únicas mesmo quando o mesmo evento aparece várias vezes no step", () => {
    const context = createContext();

    handleBattleStepEvents([
      { type: "convoyHit" },
      { type: "convoyHit" },
      { type: "icaroTargetLock" },
      { type: "icaroTargetLock" },
    ], context);

    expect(context.play.mock.calls.filter(([name]) => name === "convoyHit")).toHaveLength(1);
    expect(context.play.mock.calls.filter(([name]) => name === "icaroInterceptionLock")).toHaveLength(1);
  });
});
