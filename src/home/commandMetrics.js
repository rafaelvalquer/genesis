import {
  CHAPTERS, ENEMIES, PHASES, TROOPS,
  getChapterForPhase, getPhase, getPhaseIndex, getUnlockedTroops,
} from "../game/content.js";
import { getEnemyUnlockAt } from "../game/enemyInfo.js";

export const formatCommandTime = (milliseconds) => {
  if (!milliseconds) return "—";
  const seconds = Math.floor(milliseconds / 1000);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
};

export const formatCommandDate = (timestamp) => {
  if (!timestamp) return "—";
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(timestamp);
};

export function getCommandCurrentPhase(campaign) {
  return getPhase(campaign?.currentPhaseId)
    || PHASES[Math.max(0, Math.min(PHASES.length - 1, Number(campaign?.unlockedPhaseIndex) || 0))]
    || PHASES[0];
}

export function deriveOperationEnemies(phase) {
  const records = new Map();
  phase?.waves?.forEach((wave, waveIndex) => {
    (wave.enemies || []).forEach((entry) => {
      const key = `${entry.type}:${entry.variant || ""}`;
      const current = records.get(key) || {
        id: entry.type,
        variant: entry.variant,
        enemy: ENEMIES[entry.type],
        count: 0,
        firstWave: waveIndex + 1,
      };
      current.count += Number(entry.count || 0);
      records.set(key, current);
    });
  });
  return [...records.values()].sort((left, right) => right.count - left.count);
}

export function getChapterProgress(campaign, chapter, currentChapterId) {
  const phases = chapter.phaseIds.map(getPhase).filter(Boolean);
  const completed = phases.filter((phase) => Number(campaign.phaseStats?.[phase.id]?.victories || 0) > 0);
  const accessible = phases.filter((phase) => getPhaseIndex(phase.id) <= campaign.unlockedPhaseIndex);
  const stars = phases.reduce((sum, phase) => sum + Number(campaign.phaseStats?.[phase.id]?.bestStars || 0), 0);
  const unlocked = accessible.length > 0;
  const concluded = completed.length === phases.length;
  const current = chapter.id === currentChapterId;
  return {
    chapter,
    phases,
    completed: completed.length,
    accessible: accessible.length,
    total: phases.length,
    stars,
    percent: phases.length ? Math.round(completed.length / phases.length * 100) : 0,
    unlocked,
    current,
    state: concluded ? "CONCLUÍDO" : current ? "EM OPERAÇÃO" : unlocked ? "DISPONÍVEL" : "BLOQUEADO",
    latestAccessible: accessible.at(-1) || null,
  };
}

export function getLastOperation(campaign) {
  return Object.entries(campaign.phaseStats || {})
    .filter(([phaseId, stats]) => getPhase(phaseId) && Number(stats.lastPlayedAt || 0) > 0)
    .sort(([, left], [, right]) => Number(right.lastPlayedAt) - Number(left.lastPlayedAt))
    .map(([phaseId, stats]) => ({ phase: getPhase(phaseId), stats }))[0] || null;
}

export function getCommandMetrics(campaign) {
  const currentPhase = getCommandCurrentPhase(campaign);
  const currentChapter = getChapterForPhase(currentPhase) || CHAPTERS[0];
  const completedPhases = PHASES.filter((phase) => Number(campaign.phaseStats?.[phase.id]?.victories || 0) > 0).length;
  const stars = PHASES.reduce((sum, phase) => sum + Number(campaign.phaseStats?.[phase.id]?.bestStars || 0), 0);
  const catalogEnemies = Object.values(ENEMIES).filter((enemy) => !enemy.hiddenFromCatalog);
  const catalogedEnemies = catalogEnemies.filter((enemy) => {
    const unlockAt = getEnemyUnlockAt(enemy.id, enemy);
    return unlockAt >= 0 && unlockAt <= campaign.unlockedPhaseIndex;
  }).length;
  const nextBossIndex = PHASES.findIndex((phase, index) => index >= campaign.unlockedPhaseIndex && phase.boss);
  return {
    currentPhase,
    currentChapter,
    completedPhases,
    stars,
    troopsUnlocked: getUnlockedTroops(campaign.unlockedPhaseIndex).length,
    troopsTotal: Object.keys(TROOPS).length,
    catalogedEnemies,
    enemiesTotal: catalogEnemies.length,
    overallPercent: Math.round(completedPhases / PHASES.length * 100),
    phasesTotal: PHASES.length,
    starsTotal: PHASES.length * 3,
    nextBossDistance: nextBossIndex < 0 ? null : Math.max(0, nextBossIndex - campaign.unlockedPhaseIndex),
    chapters: CHAPTERS.map((chapter) => getChapterProgress(campaign, chapter, currentChapter.id)),
    lastOperation: getLastOperation(campaign),
  };
}
