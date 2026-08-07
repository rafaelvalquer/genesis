import { CELL, FIELD, VIEWPORT } from "../visualGeometry.js";
import {
  getWaveOutroPresentationProfile,
  WAVE_OUTRO_PRESENTATION_TIMINGS,
} from "./waveOutroProfiles.js";

const clamp01 = (value) => Math.max(0, Math.min(1, Number(value) || 0));
export const easeOutCubic = (value) => 1 - (1 - clamp01(value)) ** 3;
export const smoothStep = (value) => {
  const t = clamp01(value);
  return t * t * (3 - 2 * t);
};

export function getCinematicWaveOutroCameraTransform(session, reduceMotion = false) {
  const outro = session?.waveOutro;
  if (reduceMotion || !outro || !["finalKill", "cleanup"].includes(outro.status)) return null;

  const profile = getWaveOutroPresentationProfile(outro);
  const elapsed = Math.max(0, Number(outro.elapsedMs) || 0);
  const enterEnd = Math.min(profile.impactAtMs, WAVE_OUTRO_PRESENTATION_TIMINGS.finalKillEndMs);

  let zoomProgress = elapsed < enterEnd
    ? easeOutCubic(elapsed / Math.max(1, enterEnd))
    : 1;

  if (elapsed > WAVE_OUTRO_PRESENTATION_TIMINGS.finalKillEndMs) {
    zoomProgress = 1 - smoothStep(
      (elapsed - WAVE_OUTRO_PRESENTATION_TIMINGS.finalKillEndMs)
      / Math.max(
        1,
        WAVE_OUTRO_PRESENTATION_TIMINGS.cleanupEndMs
          - WAVE_OUTRO_PRESENTATION_TIMINGS.finalKillEndMs,
      ),
    );
  }

  const enemy = outro.lastKill?.enemy;
  const row = Number.isInteger(outro.lastKill?.row) ? outro.lastKill.row : 2;
  const enemyX = Number(enemy?.x);
  const focusX = Math.max(
    FIELD.width * 0.25,
    Math.min(FIELD.width * 0.82, Number.isFinite(enemyX) ? enemyX : FIELD.width * 0.65),
  );
  const focusY = VIEWPORT.fieldOffsetY + (row + 0.5) * CELL.height;

  return {
    zoom: 1 + (profile.zoom - 1) * zoomProgress,
    focusX,
    focusY,
    impactX: 0,
    impactY: 0,
  };
}
