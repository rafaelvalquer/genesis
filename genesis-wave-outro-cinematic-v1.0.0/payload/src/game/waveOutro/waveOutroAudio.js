import {
  WAVE_OUTRO_PRESENTATION_TIMINGS,
  getWaveOutroPresentationProfile,
  smoothStep,
} from "./waveOutroProfiles.js";

const clamp01 = (value) => Math.max(0, Math.min(1, Number(value) || 0));

export function getWaveOutroMusicVolumeFactor(outro) {
  if (!outro || ["idle", "completed"].includes(outro.status)) return 1;
  const profile = getWaveOutroPresentationProfile(outro);
  const elapsed = Math.max(0, Number(outro.elapsedMs) || 0);

  if (outro.status === "finalKill") {
    if (elapsed <= profile.musicDuckStartsAtMs) return 1;
    const denominator = Math.max(1, profile.impactAtMs - profile.musicDuckStartsAtMs);
    const t = smoothStep((elapsed - profile.musicDuckStartsAtMs) / denominator);
    return 1 - (1 - profile.musicAtImpact) * t;
  }

  if (outro.status === "cleanup") {
    const cleanupElapsed = Math.max(0, elapsed - WAVE_OUTRO_PRESENTATION_TIMINGS.cleanupStartsAt);
    const t = smoothStep(cleanupElapsed / Math.max(1, WAVE_OUTRO_PRESENTATION_TIMINGS.cleanupMs));
    return profile.musicAtImpact + (profile.musicFloor - profile.musicAtImpact) * t;
  }

  return profile.musicFloor;
}

export function getWaveOutroCueState(outro) {
  if (!outro || ["idle", "completed"].includes(outro.status)) return null;
  const profile = getWaveOutroPresentationProfile(outro);
  const elapsed = Math.max(0, Number(outro.elapsedMs) || 0);
  const startedAt = Number(outro.startedAt) || 0;
  const completedWave = Number(outro.completedWave) || 0;
  const finalWave = Boolean(outro.finalWave);
  return {
    key: `${completedWave}:${startedAt}:${finalWave ? "final" : profile.id}`,
    impactReady: elapsed >= profile.impactAtMs,
    finalWave,
    cinematic: Boolean(outro.lastKill?.cinematic),
    shake: profile.shake,
    intensity: clamp01(
      0.56
        + (outro.lastKill?.cinematic ? 0.16 : 0)
        + (finalWave ? 0.24 : 0),
    ),
  };
}
