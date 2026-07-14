import { beforeEach, describe, expect, it } from "vitest";
import { PHASES } from "../game/content.js";
import { createDefaultSave, loadCampaign, migrateSave, recordBattleResult, resetCampaign, SAVE_KEY } from "./storage.js";

describe("save local", () => {
  beforeEach(() => localStorage.clear());

  it("recupera save inválido com segurança", () => {
    localStorage.setItem(SAVE_KEY, "{inválido");
    expect(loadCampaign()).toEqual(createDefaultSave());
    expect(migrateSave({ unlockedPhaseIndex: 99 }).unlockedPhaseIndex).toBe(PHASES.length - 1);
  });

  it("registra vitória, recordes e desbloqueia a fase seguinte", () => {
    const save = recordBattleResult(createDefaultSave(), {
      phaseId: "fase_01", outcome: "victory", stars: 3, durationMs: 1000, integrity: 90,
    });
    expect(save.unlockedPhaseIndex).toBe(1);
    expect(save.phaseStats.fase_01).toMatchObject({ attempts: 1, victories: 1, bestStars: 3, bestTimeMs: 1000 });
    expect(loadCampaign()).toEqual(save);
  });

  it("não desbloqueia fase após derrota e permite reset", () => {
    const save = recordBattleResult(createDefaultSave(), {
      phaseId: "fase_01", outcome: "defeat", stars: 0, durationMs: 1000, integrity: 0,
    });
    expect(save.unlockedPhaseIndex).toBe(0);
    expect(resetCampaign()).toEqual(createDefaultSave());
  });
});
