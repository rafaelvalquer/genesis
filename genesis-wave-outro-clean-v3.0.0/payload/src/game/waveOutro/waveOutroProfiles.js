import { ENEMIES } from "../content.js";

export const WAVE_OUTRO_PRESENTATION_TIMINGS = Object.freeze({
  finalKillEndMs: 600,
  cleanupEndMs: 1000,
});

export const WAVE_OUTRO_PRESENTATION_PROFILES = Object.freeze({
  standard: Object.freeze({
    id: "standard",
    impactAtMs: 180,
    impactDurationMs: 360,
    zoom: 1.10,
    shockwaveScale: 2.0,
    flashOpacity: 0.65,
    shake: 5,
    duckImpact: 0.36,
    duckCleanup: 0.18,
    letterbox: false,
  }),
  cinematic: Object.freeze({
    id: "cinematic",
    impactAtMs: 160,
    impactDurationMs: 390,
    zoom: 1.12,
    shockwaveScale: 2.5,
    flashOpacity: 0.78,
    shake: 7,
    duckImpact: 0.30,
    duckCleanup: 0.14,
    letterbox: false,
  }),
  missionFinale: Object.freeze({
    id: "missionFinale",
    impactAtMs: 220,
    impactDurationMs: 410,
    zoom: 1.13,
    shockwaveScale: 3.25,
    flashOpacity: 0.90,
    shake: 10,
    duckImpact: 0.18,
    duckCleanup: 0.05,
    letterbox: true,
  }),
  bossFinale: Object.freeze({
    id: "bossFinale",
    impactAtMs: 240,
    impactDurationMs: 430,
    zoom: 1.15,
    shockwaveScale: 3.65,
    flashOpacity: 0.96,
    shake: 12,
    duckImpact: 0.14,
    duckCleanup: 0.04,
    letterbox: true,
  }),
});

const clamp01 = (value) => Math.max(0, Math.min(1, Number(value) || 0));

export function getWaveOutroPresentationProfile(outro) {
  const enemyType = outro?.lastKill?.enemy?.type;
  const enemyConfig = enemyType ? ENEMIES[enemyType] : null;
  const finalWave = Boolean(outro?.finalWave);
  const boss = Boolean(enemyConfig?.boss);
  const cinematic = Boolean(outro?.lastKill?.cinematic);

  if (finalWave && boss) return WAVE_OUTRO_PRESENTATION_PROFILES.bossFinale;
  if (finalWave) return WAVE_OUTRO_PRESENTATION_PROFILES.missionFinale;
  if (cinematic) return WAVE_OUTRO_PRESENTATION_PROFILES.cinematic;
  return WAVE_OUTRO_PRESENTATION_PROFILES.standard;
}

export function getWaveOutroImpactState(outro) {
  if (!outro || !["finalKill", "cleanup"].includes(outro.status)) {
    return { active: false, progress: 0, opacity: 0 };
  }

  const profile = getWaveOutroPresentationProfile(outro);
  const elapsed = Math.max(0, Number(outro.elapsedMs) || 0);
  if (elapsed < profile.impactAtMs) {
    return { active: false, progress: 0, opacity: 0 };
  }

  const progress = clamp01((elapsed - profile.impactAtMs) / profile.impactDurationMs);
  if (progress >= 1) return { active: false, progress: 1, opacity: 0 };

  return {
    active: true,
    progress,
    opacity: 1 - progress,
  };
}
