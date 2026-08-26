#!/usr/bin/env node
import {
  createDefaultSave,
  migrateSave,
  recordBattleResult,
} from "../src/campaign/storage.js";
import { PHASES } from "../src/game/content.js";
import {
  planLoadoutForPhase,
  resolveStrategyProfile,
  runBattleSimulation,
} from "../src/game/simulation/index.js";

const chapterSeven = PHASES.filter(
  (phase) => phase.chapterId === "chapter_07",
);

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function createMemoryStorage() {
  const values = new Map();

  return {
    getItem(key) {
      return values.has(key) ? values.get(key) : null;
    },
    setItem(key, value) {
      values.set(key, String(value));
    },
    removeItem(key) {
      values.delete(key);
    },
  };
}

function victoryResult(phaseId, durationMs = 1) {
  return {
    phaseId,
    outcome: "victory",
    stars: 3,
    durationMs,
    integrity: 100,
  };
}

function progressFreshSaveToChapterSeven() {
  const storage = createMemoryStorage();
  let save = createDefaultSave();

  assert(
    save.currentPhaseId === "fase_01"
      && save.unlockedPhaseIndex === 0,
    "save novo não começou na fase 1",
  );

  for (let index = 0; index < 48; index += 1) {
    const phase = PHASES[index];
    save = recordBattleResult(
      save,
      victoryResult(phase.id, index + 1),
      storage,
    );

    const expectedIndex = Math.min(
      PHASES.length - 1,
      index + 1,
    );

    assert(
      save.unlockedPhaseIndex === expectedIndex,
      `${phase.id}: liberação sequencial incorreta no save novo`,
    );
  }

  assert(
    save.currentPhaseId === "fase_49"
      && save.unlockedPhaseIndex === 48,
    "F48 vencida não liberou F49 no save novo",
  );

  return { save, storage };
}

function migrateLegacySaveAtPhase48() {
  const storage = createMemoryStorage();
  const save = migrateSave({
    version: 1,
    unlockedPhaseIndex: 47,
    currentPhaseId: "fase_48",
    phaseStats: {
      fase_48: {
        attempts: 1,
        victories: 1,
        bestStars: 3,
        bestTimeMs: 360_000,
        bestIntegrity: 100,
        lastOutcome: "victory",
      },
    },
  });

  assert(
    save.currentPhaseId === "fase_49"
      && save.unlockedPhaseIndex === 48,
    "migração de save legado com F48 vencida não liberou F49",
  );

  return { save, storage };
}

async function playChapterSeven(label, initialState) {
  let { save } = initialState;
  const { storage } = initialState;
  const phases = [];

  for (const phase of chapterSeven) {
    const phaseIndex = PHASES.findIndex(
      (candidate) => candidate.id === phase.id,
    );
    const phaseNumber = phaseIndex + 1;

    assert(
      save.currentPhaseId === phase.id
        && save.unlockedPhaseIndex >= phaseIndex,
      `${label}/${phase.id}: fase não estava liberada antes da partida`,
    );
    assert(
      typeof phase.subtitle === "string"
        && phase.subtitle.trim().length > 0,
      `${label}/${phase.id}: briefing ausente`,
    );
    assert(
      phase.progressionMode === "convoy"
        && phase.sectors?.length === 4,
      `${label}/${phase.id}: contrato de quatro setores inválido`,
    );

    const profile = resolveStrategyProfile("balanced");
    const loadoutPlan = planLoadoutForPhase({
      phase,
      phaseIndex,
      profile,
      seed: phaseNumber,
    });

    assert(
      loadoutPlan.loadout.length > 0
        && loadoutPlan.loadout.length <= phase.loadoutLimit,
      `${label}/${phase.id}: loadout inválido`,
    );

    const result = await runBattleSimulation({
      phase,
      loadout: loadoutPlan.loadout,
      seed: phaseNumber,
      strategy: "balanced",
      config: {
        maximumDurationMs: 900_000,
        allowAdaptiveAid: true,
      },
    });

    assert(
      result.outcome === "victory"
        && !result.timeout
        && !result.deadlock
        && !result.invalidState,
      `${label}/${phase.id}: partida não terminou em vitória (${result.failureReason || result.outcome || "sem resultado"})`,
    );
    assert(
      result.events.checkpointReached === 3
        && result.events.checkpointPreparation === 3,
      `${label}/${phase.id}: checkpoints incompletos`,
    );

    const repositionCount = result.actions.filter(
      (action) => action.type === "reposition" && action.ok,
    ).length;

    assert(
      repositionCount >= 3,
      `${label}/${phase.id}: reposicionamento não foi exercitado`,
    );
    assert(
      result.convoy?.progress === 1
        && result.convoy?.flowState === "victory"
        && result.convoy?.sectorIndex === 3,
      `${label}/${phase.id}: comboio não alcançou o destino após quatro setores`,
    );

    if (phase.id === "fase_56") {
      assert(!phase.bossEncounter && phase.boss !== true, "F56 deve ser objetivo de comboio sem boss");
    }

    save = recordBattleResult(
      save,
      result,
      storage,
    );

    const nextIndex = Math.min(
      PHASES.length - 1,
      phaseIndex + 1,
    );
    assert(
      save.unlockedPhaseIndex === nextIndex
        && save.currentPhaseId === PHASES[nextIndex].id,
      `${label}/${phase.id}: resultado não atualizou a campanha corretamente`,
    );

    phases.push({
      phaseId: phase.id,
      loadout: loadoutPlan.loadout,
      durationMs: result.durationMs,
      stars: result.stars,
      convoyIntegrity: Math.round(
        result.convoy.hp / result.convoy.maxHp * 100,
      ),
      checkpoints: result.events.checkpointReached,
      repositionCount,
      destinationProgress: result.convoy.progress,
    });
  }

  assert(
    save.currentPhaseId === "fase_56"
      && save.unlockedPhaseIndex === 55
      && save.phaseStats.fase_56?.victories === 1,
    `${label}: campanha não permaneceu concluída em F56`,
  );

  return {
    label,
    startingPoint: "fase_49",
    endingPoint: save.currentPhaseId,
    campaignCompleted: true,
    phases,
  };
}

assert(
  chapterSeven.length === 8
    && chapterSeven[0]?.id === "fase_49"
    && chapterSeven.at(-1)?.id === "fase_56",
  "Capítulo 7 deve conter exatamente F49–F56",
);

const fresh = await playChapterSeven(
  "save-novo",
  progressFreshSaveToChapterSeven(),
);
const migrated = await playChapterSeven(
  "save-legado-f48-vencida",
  migrateLegacySaveAtPhase48(),
);

console.log(JSON.stringify({
  status: "PASS",
  scenarios: [fresh, migrated],
}, null, 2));
