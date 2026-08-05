import { describe, expect, it } from "vitest";
import {
  applyBattleAssetProgress,
  markBattleAssetsReady,
} from "./useBattleAssets.js";

describe("estado de carregamento dos assets da batalha", () => {
  it("mantém a missão pronta durante o carregamento de estados raros", () => {
    const ready = markBattleAssetsReady({
      ready: false,
      percent: 100,
      deferredPercent: 0,
      stage: "critical",
      error: null,
      deferredError: null,
    });

    const deferred = applyBattleAssetProgress(
      ready,
      {
        phase: "deferred",
        percent: 35,
      },
    );

    expect(deferred).toMatchObject({
      ready: true,
      percent: 100,
      deferredPercent: 35,
      stage: "ready",
    });
  });

  it("não volta ao loader quando o carregamento adiado chega a 100%", () => {
    const state = applyBattleAssetProgress(
      {
        ready: true,
        percent: 100,
        deferredPercent: 80,
        stage: "ready",
        error: null,
        deferredError: null,
      },
      {
        phase: "deferred",
        percent: 100,
      },
    );

    expect(state.ready).toBe(true);
    expect(state.percent).toBe(100);
    expect(state.deferredPercent).toBe(100);
  });

  it("mantém o progresso crítico como bloqueante antes da prontidão", () => {
    const state = applyBattleAssetProgress(
      {
        ready: false,
        percent: 0,
        deferredPercent: 0,
        stage: "critical",
        error: null,
        deferredError: null,
      },
      {
        phase: "critical",
        percent: 62,
      },
    );

    expect(state).toMatchObject({
      ready: false,
      percent: 62,
      stage: "critical",
    });
  });
});
