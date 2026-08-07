const clamp01 = (value) => Math.max(0, Math.min(1, Number(value) || 0));

// Mantidos alinhados com WAVE_OUTRO_TIMINGS do motor atual.
// O pacote não altera a duração lógica da onda nem do resultado da fase.
export const WAVE_OUTRO_PRESENTATION_TIMINGS = Object.freeze({
  finalKillMs: 600,
  cleanupMs: 400,
  bannerMs: 2000,
  introMs: 1100,
  cleanupStartsAt: 600,
  bannerStartsAt: 1000,
  introStartsAt: 3000,
  totalMs: 4100,
});

export const WAVE_OUTRO_PRESENTATION_PROFILES = Object.freeze({
  standard: Object.freeze({
    id: "standard",
    impactAtMs: 180,
    focusInMs: 150,
    focusHoldUntilMs: 460,
    zoom: 1.09,
    shake: 2.6,
    impactLifeMs: 430,
    shockwaveScale: 2.15,
    flashOpacity: 0.24,
    musicDuckStartsAtMs: 95,
    musicAtImpact: 0.36,
    musicFloor: 0.12,
    letterbox: false,
  }),
  cinematic: Object.freeze({
    id: "cinematic",
    impactAtMs: 170,
    focusInMs: 135,
    focusHoldUntilMs: 485,
    zoom: 1.115,
    shake: 3.8,
    impactLifeMs: 500,
    shockwaveScale: 2.55,
    flashOpacity: 0.31,
    musicDuckStartsAtMs: 80,
    musicAtImpact: 0.29,
    musicFloor: 0.09,
    letterbox: false,
  }),
  missionFinale: Object.freeze({
    id: "missionFinale",
    impactAtMs: 220,
    focusInMs: 180,
    focusHoldUntilMs: 520,
    zoom: 1.14,
    shake: 5.4,
    impactLifeMs: 680,
    shockwaveScale: 3.3,
    flashOpacity: 0.46,
    musicDuckStartsAtMs: 120,
    musicAtImpact: 0.16,
    musicFloor: 0.035,
    letterbox: true,
  }),
});

export function getWaveOutroPresentationProfile(outro) {
  if (outro?.finalWave) return WAVE_OUTRO_PRESENTATION_PROFILES.missionFinale;
  if (outro?.lastKill?.cinematic) return WAVE_OUTRO_PRESENTATION_PROFILES.cinematic;
  return WAVE_OUTRO_PRESENTATION_PROFILES.standard;
}

export function getWaveOutroImpactState(outro) {
  if (!outro || !["finalKill", "cleanup"].includes(outro.status)) {
    return { active: false, progress: 1, opacity: 0 };
  }
  const profile = getWaveOutroPresentationProfile(outro);
  const age = Math.max(0, (Number(outro.elapsedMs) || 0) - profile.impactAtMs);
  if ((Number(outro.elapsedMs) || 0) < profile.impactAtMs || age > profile.impactLifeMs) {
    return { active: false, progress: 1, opacity: 0 };
  }
  const progress = clamp01(age / Math.max(1, profile.impactLifeMs));
  return {
    active: true,
    progress,
    opacity: 1 - progress,
  };
}

export function smoothStep(value) {
  const t = clamp01(value);
  return t * t * (3 - 2 * t);
}

export function easeOutCubic(value) {
  const t = clamp01(value);
  return 1 - ((1 - t) ** 3);
}
