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

export function getKillCinematicCameraTransform({
  status,
  elapsedMs = 0,
  lastKill = null,
  profile = { zoom: 1.1, impactAtMs: 180 },
  enterEndMs = 600,
  exitStartMs = 600,
  endMs = 1000,
  focusX = null,
  focusRow = 2,
} = {}) {
  if (!status || !["finalKill", "cleanup"].includes(status)) return null;
  const elapsed = Math.max(0, Number(elapsedMs) || 0);
  const enterEnd = Math.min(profile.impactAtMs || enterEndMs, enterEndMs);
  let zoomProgress = elapsed < enterEnd ? easeOutCubic(elapsed / Math.max(1, enterEnd)) : 1;
  if (elapsed > exitStartMs) zoomProgress = 1 - smoothStep((elapsed - exitStartMs) / Math.max(1, endMs - exitStartMs));
  const enemy = lastKill?.enemy;
  const enemyX = Number(enemy?.x);
  const resolvedFocusX = Number.isFinite(enemyX) ? enemyX : Number(focusX);
  const resolvedRow = Number.isInteger(lastKill?.row) ? lastKill.row : focusRow;
  const clampedFocusX = Math.max(FIELD.width * 0.25, Math.min(FIELD.width * 0.82, Number.isFinite(resolvedFocusX) ? resolvedFocusX : FIELD.width * 0.65));
  return {
    zoom: 1 + ((profile.zoom || 1.1) - 1) * zoomProgress,
    focusX: clampedFocusX,
    focusY: VIEWPORT.fieldOffsetY + (resolvedRow + 0.5) * CELL.height,
    impactX: 0, impactY: 0,
  };
}

export function getCinematicWaveOutroCameraTransform(session, reduceMotion = false) {
  const outro = session?.waveOutro;
  if (reduceMotion || !outro || !["finalKill", "cleanup"].includes(outro.status)) return null;

  const profile = getWaveOutroPresentationProfile(outro);
  return getKillCinematicCameraTransform({
    status: outro.status,
    elapsedMs: outro.elapsedMs,
    lastKill: outro.lastKill,
    profile,
    enterEndMs: WAVE_OUTRO_PRESENTATION_TIMINGS.finalKillEndMs,
    exitStartMs: WAVE_OUTRO_PRESENTATION_TIMINGS.finalKillEndMs,
    endMs: WAVE_OUTRO_PRESENTATION_TIMINGS.cleanupEndMs,
  });
}
