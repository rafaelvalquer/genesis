import { PHASES } from "../game/content.js";

export const SAVE_KEY = "genesis-defense:campaign:v1";
export const SETTINGS_KEY = "genesis-defense:settings:v1";

export const DEFAULT_SETTINGS = {
  masterVolume: 0.8,
  musicVolume: 0.55,
  effectsVolume: 0.8,
  quality: "high",
  cameraShake: true,
  reduceMotion: false,
  colorMode: "normal",
};

export function createDefaultSave() {
  return {
    version: 2,
    unlockedPhaseIndex: 0,
    currentPhaseId: PHASES[0].id,
    phaseStats: {},
  };
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function migrateSave(value) {
  if (!isPlainObject(value)) return createDefaultSave();
  const phaseStats = isPlainObject(value.phaseStats) ? value.phaseStats : {};
  const completedLegacyCampaign = Number(phaseStats.fase_08?.victories || 0) > 0;
  const migratedIndex = Math.max(Number(value.unlockedPhaseIndex) || 0, completedLegacyCampaign ? 8 : 0);
  const unlocked = Math.max(0, Math.min(PHASES.length - 1, migratedIndex));
  return {
    version: 2,
    unlockedPhaseIndex: unlocked,
    currentPhaseId: PHASES[unlocked]?.id || PHASES[0].id,
    phaseStats,
  };
}

export function loadCampaign(storage = window.localStorage) {
  try {
    return migrateSave(JSON.parse(storage.getItem(SAVE_KEY) || "null"));
  } catch {
    return createDefaultSave();
  }
}

export function saveCampaign(save, storage = window.localStorage) {
  const migrated = migrateSave(save);
  storage.setItem(SAVE_KEY, JSON.stringify(migrated));
  return migrated;
}

export function resetCampaign(storage = window.localStorage) {
  storage.removeItem(SAVE_KEY);
  return createDefaultSave();
}

export function recordBattleResult(save, result, storage = window.localStorage) {
  const phaseIndex = PHASES.findIndex((phase) => phase.id === result.phaseId);
  if (phaseIndex < 0) return migrateSave(save);
  const previous = save.phaseStats?.[result.phaseId] || {};
  const won = result.outcome === "victory";
  const next = {
    ...migrateSave(save),
    unlockedPhaseIndex: won ? Math.max(save.unlockedPhaseIndex, Math.min(PHASES.length - 1, phaseIndex + 1)) : save.unlockedPhaseIndex,
    currentPhaseId: won ? PHASES[Math.min(PHASES.length - 1, phaseIndex + 1)].id : result.phaseId,
    phaseStats: {
      ...save.phaseStats,
      [result.phaseId]: {
        attempts: Number(previous.attempts || 0) + 1,
        victories: Number(previous.victories || 0) + (won ? 1 : 0),
        bestStars: Math.max(Number(previous.bestStars || 0), Number(result.stars || 0)),
        bestTimeMs: won && (!previous.bestTimeMs || result.durationMs < previous.bestTimeMs) ? result.durationMs : previous.bestTimeMs || null,
        bestIntegrity: Math.max(Number(previous.bestIntegrity || 0), Number(result.integrity || 0)),
        lastOutcome: result.outcome,
        lastPlayedAt: Date.now(),
      },
    },
  };
  return saveCampaign(next, storage);
}

export function loadSettings(storage = window.localStorage) {
  try {
    const value = JSON.parse(storage.getItem(SETTINGS_KEY) || "{}");
    return { ...DEFAULT_SETTINGS, ...(isPlainObject(value) ? value : {}) };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(settings, storage = window.localStorage) {
  const next = { ...DEFAULT_SETTINGS, ...settings };
  storage.setItem(SETTINGS_KEY, JSON.stringify(next));
  return next;
}
