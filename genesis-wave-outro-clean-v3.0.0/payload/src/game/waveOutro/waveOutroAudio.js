import {
  getWaveOutroPresentationProfile,
  WAVE_OUTRO_PRESENTATION_TIMINGS,
} from "./waveOutroProfiles.js";

const ACTIVE_CUE_STATUSES = new Set([
  "finalKill",
  "cleanup",
  "waveCompleteBanner",
  "decisionIntro",
  "victoryIntro",
]);

const clamp01 = (value) => Math.max(0, Math.min(1, Number(value) || 0));
const easeOutCubic = (value) => 1 - (1 - clamp01(value)) ** 3;
const smoothStep = (value) => {
  const t = clamp01(value);
  return t * t * (3 - 2 * t);
};

export function getWaveOutroMusicVolumeFactor(outro) {
  if (!outro || ["idle", "completed"].includes(outro.status)) return 1;

  const profile = getWaveOutroPresentationProfile(outro);
  const elapsed = Math.max(0, Number(outro.elapsedMs) || 0);

  if (elapsed <= profile.impactAtMs) {
    return 1 - (1 - profile.duckImpact)
      * easeOutCubic(elapsed / Math.max(1, profile.impactAtMs));
  }

  if (elapsed < WAVE_OUTRO_PRESENTATION_TIMINGS.cleanupEndMs) {
    const progress = smoothStep(
      (elapsed - profile.impactAtMs)
      / Math.max(1, WAVE_OUTRO_PRESENTATION_TIMINGS.cleanupEndMs - profile.impactAtMs),
    );
    return profile.duckImpact
      + (profile.duckCleanup - profile.duckImpact) * progress;
  }

  return 0;
}

export function getWaveOutroCueState(outro) {
  if (!outro || !ACTIVE_CUE_STATUSES.has(outro.status)) return {};

  const profile = getWaveOutroPresentationProfile(outro);
  const elapsed = Math.max(0, Number(outro.elapsedMs) || 0);
  const startedAt = Number.isFinite(Number(outro.startedAt)) ? Number(outro.startedAt) : 0;
  const completedWave = Number.isFinite(Number(outro.completedWave)) ? Number(outro.completedWave) : 0;

  return {
    impactReady: elapsed >= profile.impactAtMs,
    finalWave: Boolean(outro.finalWave),
    cinematic: Boolean(outro.lastKill?.cinematic),
    shake: profile.shake,
    key: `wave-outro-cue-${completedWave}-${startedAt}`,
  };
}
