import { CELL, FIELD, VIEWPORT } from "../visualGeometry.js";
import {
  WAVE_OUTRO_PRESENTATION_TIMINGS,
  easeOutCubic,
  getWaveOutroPresentationProfile,
  smoothStep,
} from "./waveOutroProfiles.js";

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

export function getCinematicWaveOutroCameraTransform(session, reduceMotion = false) {
  const outro = session?.waveOutro;
  if (reduceMotion || !outro || !["finalKill", "cleanup"].includes(outro.status)) return null;

  const profile = getWaveOutroPresentationProfile(outro);
  const elapsed = Math.max(0, Number(outro.elapsedMs) || 0);
  const focusIn = easeOutCubic(elapsed / Math.max(1, profile.focusInMs));

  let zoomProgress = focusIn;
  if (outro.status === "finalKill" && elapsed >= profile.focusInMs) {
    const returnStart = profile.focusHoldUntilMs;
    if (elapsed <= returnStart) zoomProgress = 1;
    else {
      const returnProgress = smoothStep(
        (elapsed - returnStart)
          / Math.max(1, WAVE_OUTRO_PRESENTATION_TIMINGS.finalKillMs - returnStart),
      );
      // O fim de finalKill mantém parte do enquadramento para a limpeza.
      zoomProgress = 1 - returnProgress * 0.24;
    }
  }

  if (outro.status === "cleanup") {
    const cleanupElapsed = Math.max(0, elapsed - WAVE_OUTRO_PRESENTATION_TIMINGS.cleanupStartsAt);
    const cleanupProgress = smoothStep(
      cleanupElapsed / Math.max(1, WAVE_OUTRO_PRESENTATION_TIMINGS.cleanupMs),
    );
    zoomProgress = 0.76 * (1 - cleanupProgress);
  }

  const enemy = outro.lastKill?.enemy;
  const rawFocusX = Number(enemy?.x);
  const focusX = Number.isFinite(rawFocusX)
    ? clamp(rawFocusX, FIELD.width * 0.22, FIELD.width * 0.84)
    : FIELD.width * 0.64;
  const row = Number.isInteger(outro.lastKill?.row) ? outro.lastKill.row : 2;
  const focusY = VIEWPORT.fieldOffsetY + (row + 0.5) * CELL.height;

  const impactAge = elapsed - profile.impactAtMs;
  let impact = 0;
  if (impactAge >= 0 && impactAge <= 175) {
    const impactProgress = impactAge / 175;
    impact = Math.sin(impactProgress * Math.PI * 3) * profile.shake * (1 - impactProgress);
  }

  return {
    zoom: 1 + (profile.zoom - 1) * zoomProgress,
    focusX,
    focusY,
    impactX: impact,
    impactY: -impact * 0.42,
  };
}
