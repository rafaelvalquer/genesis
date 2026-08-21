import {
  beforeEach,
  describe,
  expect,
  it,
} from "vitest";
import { PHASES } from "../game/content.js";
import {
  createDefaultSave,
  loadCampaign,
  migrateSave,
  recordBattleResult,
  resetCampaign,
  SAVE_KEY,
} from "./storage.js";

describe("save local", () => {
  beforeEach(() => localStorage.clear());

  it("recupera save inválido com segurança", () => {
    localStorage.setItem(SAVE_KEY, "{inválido");

    expect(loadCampaign()).toEqual(createDefaultSave());
    expect(
      migrateSave({
        unlockedPhaseIndex: 99,
      }).unlockedPhaseIndex,
    ).toBe(PHASES.length - 1);
  });

  it("migra a campanha antiga e libera o Capítulo 2", () => {
    const migrated = migrateSave({
      version: 1,
      unlockedPhaseIndex: 7,
      currentPhaseId: "fase_08",
      phaseStats: {
        fase_08: {
          victories: 1,
          bestStars: 3,
        },
      },
    });

    expect(migrated).toMatchObject({
      version: 2,
      unlockedPhaseIndex: 8,
      currentPhaseId: "fase_09",
    });
  });

  it("libera a fase 33 para quem concluiu a fase 32", () => {
    const migrated = migrateSave({
      version: 2,
      unlockedPhaseIndex: 31,
      currentPhaseId: "fase_32",
      phaseStats: {
        fase_32: {
          victories: 1,
          bestStars: 2,
        },
      },
    });

    expect(migrated).toMatchObject({
      unlockedPhaseIndex: 32,
      currentPhaseId: "fase_33",
    });
  });

  it("registra vitória e desbloqueia a fase seguinte", () => {
    const save = recordBattleResult(
      createDefaultSave(),
      {
        phaseId: "fase_01",
        outcome: "victory",
        stars: 3,
        durationMs: 1000,
        integrity: 90,
      },
    );

    expect(save.unlockedPhaseIndex).toBe(1);
    expect(save.phaseStats.fase_01).toMatchObject({
      attempts: 1,
      victories: 1,
      bestStars: 3,
      bestTimeMs: 1000,
    });
    expect(loadCampaign()).toEqual(save);
  });

  it("libera a fase 34 após vencer a fase 33", () => {
    const previous = migrateSave({
      unlockedPhaseIndex: 32,
      currentPhaseId: "fase_33",
      phaseStats: {
        fase_32: { victories: 1 },
      },
    });

    const save = recordBattleResult(previous, {
      phaseId: "fase_33",
      outcome: "victory",
      stars: 2,
      durationMs: 120000,
      integrity: 72,
    });

    expect(save.unlockedPhaseIndex).toBe(33);
    expect(save.currentPhaseId).toBe("fase_34");
  });

  it("migra a conclusão da fase 48 e persiste o comboio até o fim da campanha", () => {
    const migrated = migrateSave({
      version: 2,
      unlockedPhaseIndex: 47,
      currentPhaseId: "fase_48",
      phaseStats: { fase_48: { victories: 1, bestStars: 3 } },
    });
    expect(migrated).toMatchObject({ unlockedPhaseIndex: 48, currentPhaseId: "fase_49" });

    const finalSave = recordBattleResult({
      ...migrated,
      unlockedPhaseIndex: 55,
      currentPhaseId: "fase_56",
    }, {
      phaseId: "fase_56",
      outcome: "victory",
      stars: 3,
      durationMs: 420000,
      integrity: 78,
    });
    expect(finalSave).toMatchObject({ unlockedPhaseIndex: 55, currentPhaseId: "fase_56" });
    expect(finalSave.phaseStats.fase_56).toMatchObject({ victories: 1, bestStars: 3, bestIntegrity: 78 });
  });

  it("não desbloqueia após derrota e permite reset", () => {
    const save = recordBattleResult(
      createDefaultSave(),
      {
        phaseId: "fase_01",
        outcome: "defeat",
        stars: 0,
        durationMs: 1000,
        integrity: 0,
      },
    );

    expect(save.unlockedPhaseIndex).toBe(0);
    expect(resetCampaign()).toEqual(createDefaultSave());
  });
});
