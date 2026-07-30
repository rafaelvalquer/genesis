import { describe, expect, it } from "vitest";
import { CHAPTERS, PHASES } from "../game/content.js";
import {
  deriveOperationEnemies,
  formatCommandTime,
  getChapterProgress,
  getCommandCurrentPhase,
  getCommandMetrics,
  getLastOperation,
} from "./commandMetrics.js";

const campaign = (overrides = {}) => ({
  unlockedPhaseIndex: 0,
  currentPhaseId: "fase_01",
  phaseStats: {},
  ...overrides,
});

describe("métricas do Comando Orbital", () => {
  it("prioriza currentPhaseId sobre a fase desbloqueada mais alta", () => {
    expect(getCommandCurrentPhase(campaign({ unlockedPhaseIndex: 9, currentPhaseId: "fase_03" })).id).toBe("fase_03");
  });

  it("usa unlockedPhaseIndex para saves com currentPhaseId inválido", () => {
    expect(getCommandCurrentPhase(campaign({ unlockedPhaseIndex: 8, currentPhaseId: "inexistente" })).id).toBe("fase_09");
  });

  it("protege índices antigos fora dos limites", () => {
    expect(getCommandCurrentPhase(campaign({ unlockedPhaseIndex: 999, currentPhaseId: null })).id).toBe(PHASES.at(-1).id);
  });

  it("conta conclusão por vitória e soma a melhor quantidade de estrelas", () => {
    const metrics = getCommandMetrics(campaign({
      unlockedPhaseIndex: 2,
      phaseStats: {
        fase_01: { victories: 1, bestStars: 3 },
        fase_02: { victories: 0, bestStars: 1 },
      },
    }));
    expect(metrics.completedPhases).toBe(1);
    expect(metrics.stars).toBe(4);
    expect(metrics.overallPercent).toBe(3);
  });

  it("determina capítulo atual pela fase principal", () => {
    expect(getCommandMetrics(campaign({ unlockedPhaseIndex: 19, currentPhaseId: "fase_17" })).currentChapter.id).toBe("chapter_03");
  });

  it("marca capítulo concluído somente quando todas as fases venceram", () => {
    const phaseStats = Object.fromEntries(CHAPTERS[0].phaseIds.map((id) => [id, { victories: 1 }]));
    expect(getChapterProgress(campaign({ unlockedPhaseIndex: 8, phaseStats }), CHAPTERS[0], "chapter_02").state).toBe("CONCLUÍDO");
  });

  it("marca capítulos sem fase acessível como bloqueados", () => {
    expect(getChapterProgress(campaign(), CHAPTERS[1], "chapter_01")).toMatchObject({
      state: "BLOQUEADO", unlocked: false, accessible: 0,
    });
  });

  it("identifica o capítulo em operação", () => {
    expect(getChapterProgress(campaign(), CHAPTERS[0], "chapter_01").state).toBe("EM OPERAÇÃO");
  });

  it("seleciona a última operação por lastPlayedAt e não pelo índice", () => {
    const last = getLastOperation(campaign({
      phaseStats: {
        fase_12: { lastPlayedAt: 10 },
        fase_02: { lastPlayedAt: 30 },
      },
    }));
    expect(last.phase.id).toBe("fase_02");
  });

  it("retorna estado vazio sem registro de batalha", () => {
    expect(getLastOperation(campaign())).toBeNull();
  });

  it("agrupa inimigos, quantidades e primeira onda", () => {
    const enemies = deriveOperationEnemies({
      waves: [
        { enemies: [{ type: "medu", count: 2 }] },
        { enemies: [{ type: "medu", count: 3 }, { type: "vespoide", count: 1 }] },
      ],
    });
    expect(enemies[0]).toMatchObject({ id: "medu", count: 5, firstWave: 1 });
    expect(enemies[1]).toMatchObject({ id: "vespoide", count: 1, firstWave: 2 });
  });

  it("formata tempos de relatório", () => {
    expect(formatCommandTime(125000)).toBe("2:05");
    expect(formatCommandTime(null)).toBe("—");
  });

  it("calcula tropas, inimigos catalogados e distância do chefe", () => {
    const metrics = getCommandMetrics(campaign({ unlockedPhaseIndex: 0 }));
    expect(metrics.troopsUnlocked).toBeGreaterThan(0);
    expect(metrics.catalogedEnemies).toBeGreaterThan(0);
    expect(metrics.nextBossDistance).toBeGreaterThanOrEqual(0);
  });
});
